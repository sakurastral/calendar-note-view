import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { CalendarBasesView, CALENDAR_BASES_VIEW_TYPE, getBasesCalendarOptions } from './bases-view';
import { CreateEventModal } from './create-event-modal';
import { DailyNoteService } from './daily-notes';
import { CalendarDiagnosticsModal } from './diagnostics-modal';
import { CalendarDiagnosticsService } from './diagnostics';
import { EventNoteCreationService } from './event-creation';
import { CalendarIndexService } from './index-service';
import type { CalendarSettings } from './models';
import { loadCalendarSettings } from './settings-data';
import { CalendarNoteSettingTab } from './settings';
import { CALENDAR_SIDEBAR_VIEW_TYPE, CalendarSidebarView } from './sidebar-view';
import { CalendarSuggestionProvider } from './suggestions';

export default class CalendarNoteViewPlugin extends Plugin {
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
		this.index = new CalendarIndexService(this.app, () => this.settings, this.diagnostics);
		this.dailyNotes = new DailyNoteService(this.app, () => this.settings.confirmBeforeCreatingDailyNote);
		this.eventCreation = new EventNoteCreationService(this.app, () => this.settings, this.index);

		this.addSettingTab(new CalendarNoteSettingTab(this.app, this));
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
		this.index?.dispose();
		this.suggestions?.dispose();
	}

	async saveSettings(previous: CalendarSettings): Promise<void> {
		await this.saveData(this.settings);
		await this.index.handleSettingsChanged(previous, this.settings);
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
