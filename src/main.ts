import { getAllTags, Plugin, type CachedMetadata, type WorkspaceLeaf } from 'obsidian';
import { CalendarBasesView, CALENDAR_BASES_VIEW_TYPE, getBasesCalendarOptions } from './bases-view';
import { CreateEventModal } from './create-event-modal';
import { DailyNoteService } from './daily-notes';
import { CalendarDiagnosticsModal } from './diagnostics-modal';
import { CalendarDiagnosticsService } from './diagnostics';
import { EventNoteCreationService } from './event-creation';
import { CalendarIndexService } from './index-service';
import { CalendarSourceMatcher } from './matcher';
import type { CalendarSettings } from './models';
import { loadCalendarSettings } from './settings-data';
import {
	CalendarSettingsPersistence,
	type CalendarSettingsImpact,
	type CalendarSettingsSaveState,
} from './settings-persistence';
import { CalendarNoteSettingTab } from './settings';
import { CALENDAR_SIDEBAR_VIEW_TYPE, CalendarSidebarView } from './sidebar-view';
import { CalendarSuggestionProvider } from './suggestions';

export default class CalendarNoteViewPlugin extends Plugin {
	private settingsPersistence!: CalendarSettingsPersistence;
	private settingTab!: CalendarNoteSettingTab;
	private unloading = false;
	settings!: CalendarSettings;
	diagnostics!: CalendarDiagnosticsService;
	index!: CalendarIndexService;
	suggestions!: CalendarSuggestionProvider;
	dailyNotes!: DailyNoteService;
	eventCreation!: EventNoteCreationService;

	async onload(): Promise<void> {
		const loaded = loadCalendarSettings(await this.loadData());
		this.settings = loaded.settings;
		if (loaded.migrated) await this.saveData(this.settings);

		this.diagnostics = new CalendarDiagnosticsService();
		this.suggestions = new CalendarSuggestionProvider(this.app);
		this.suggestions.initialize();
		const sourceMatcher = new CalendarSourceMatcher(
			this.app.metadataCache,
			(metadata) => getAllTags(metadata as CachedMetadata) ?? [],
		);
		this.index = new CalendarIndexService(
			this.app,
			() => this.settings,
			this.diagnostics,
			undefined,
			undefined,
			sourceMatcher,
		);
		this.dailyNotes = new DailyNoteService(this.app, () => this.settings.confirmBeforeCreatingDailyNote);
		this.eventCreation = new EventNoteCreationService(this.app, () => this.settings, this.index);
		this.settingsPersistence = new CalendarSettingsPersistence({
			getSettings: () => this.settings,
			saveData: (settings) => this.saveData(settings),
			applyImpact: async (previous, next, impact) => {
				if (this.unloading) return;
				if (impact === 'index') await this.index.handleSettingsChanged(previous, next);
				if (impact !== 'save') this.renderSidebarCalendars();
			},
			onStatusChange: (status) => this.settingTab?.setSaveStatus(status),
		});

		this.settingTab = new CalendarNoteSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		this.register(() => this.settingTab.dispose());
		this.registerView(CALENDAR_SIDEBAR_VIEW_TYPE, (leaf) => new CalendarSidebarView(leaf, this));
		this.registerBasesView(CALENDAR_BASES_VIEW_TYPE, {
			name: 'Calendar',
			icon: 'calendar-days',
			factory: (controller, containerEl) => new CalendarBasesView(controller, containerEl, this),
			options: getBasesCalendarOptions,
		});
		this.addRibbonIcon('calendar-days', 'Open calendar note view', () => { void this.activateSidebar(); });
		this.addCommand({
			id: 'open-sidebar-calendar',
			name: 'Open sidebar calendar',
			callback: () => { void this.activateSidebar(); },
		});
		this.addCommand({
			id: 'create-event',
			name: 'Create event',
			callback: () => new CreateEventModal(this, this.eventCreation).open(),
		});
		this.addCommand({
			id: 'open-calendar-diagnostics',
			name: 'Open calendar diagnostics',
			callback: () => new CalendarDiagnosticsModal(this).open(),
		});
		this.app.workspace.onLayoutReady(() => {
			void this.index.initialize();
		});
	}

	onunload(): void {
		this.unloading = true;
		void this.flushSettings().catch(() => undefined);
		this.index?.dispose();
		this.suggestions?.dispose();
	}

	async saveSettings(
		previous: CalendarSettings,
		impact: CalendarSettingsImpact = 'index',
		flush = false,
	): Promise<void> {
		this.settingsPersistence.schedule(previous, impact);
		if (flush) await this.settingsPersistence.flush();
	}

	async flushSettings(): Promise<void> {
		if (this.settingsPersistence) await this.settingsPersistence.flush();
	}

	getSettingsSaveState(): CalendarSettingsSaveState {
		return this.settingsPersistence?.getStatus() ?? 'saved';
	}

	private renderSidebarCalendars(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(CALENDAR_SIDEBAR_VIEW_TYPE)) {
			if (leaf.view instanceof CalendarSidebarView) leaf.view.renderCalendar();
		}
	}

	async activateSidebar(): Promise<void> {
		let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(CALENDAR_SIDEBAR_VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: CALENDAR_SIDEBAR_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}
}
