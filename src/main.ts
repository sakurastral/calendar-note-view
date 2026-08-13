import { getAllTags, getLanguage, Plugin, type CachedMetadata, type WorkspaceLeaf } from 'obsidian';
import { CalendarBasesView, CALENDAR_BASES_VIEW_TYPE, getBasesCalendarOptions } from './bases-view';
import { calendarText, setCalendarObsidianLocale } from './calendar-locale';
import { registerCalendarCommands } from './commands';
import { CalendarDayRolloverService } from './day-rollover';
import { DailyNoteService } from './daily-notes';
import { CalendarDiagnosticsService } from './diagnostics';
import { EventNoteCreationService } from './event-creation';
import { CalendarIndexService } from './index-service';
import { CalendarSourceMatcher } from './matcher';
import type { CalendarSettings, CalendarSourceProfile } from './models';
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
	private readonly basesCalendars = new Set<CalendarBasesView>();
	private unloading = false;
	settings!: CalendarSettings;
	diagnostics!: CalendarDiagnosticsService;
	index!: CalendarIndexService;
	suggestions!: CalendarSuggestionProvider;
	dailyNotes!: DailyNoteService;
	eventCreation!: EventNoteCreationService;
	dayRollover!: CalendarDayRolloverService;
	sourceMatcher!: CalendarSourceMatcher;

	async onload(): Promise<void> {
		setCalendarObsidianLocale(getLanguage());
		const loaded = loadCalendarSettings(await this.loadData());
		this.settings = loaded.settings;
		if (loaded.migrated) await this.saveData(this.settings);

		this.diagnostics = new CalendarDiagnosticsService();
		this.dayRollover = new CalendarDayRolloverService(() => this.settings.timeZone);
		this.suggestions = new CalendarSuggestionProvider(this.app);
		this.suggestions.initialize();
		this.sourceMatcher = new CalendarSourceMatcher(
			this.app.metadataCache,
			(metadata) => getAllTags(metadata as CachedMetadata) ?? [],
		);
		this.index = new CalendarIndexService(
			this.app,
			() => this.settings,
			this.diagnostics,
			undefined,
			undefined,
			this.sourceMatcher,
		);
		this.dailyNotes = new DailyNoteService(this.app, () => this.settings.confirmBeforeCreatingDailyNote);
		this.eventCreation = new EventNoteCreationService(this.app, () => this.settings, this.index);
		this.settingsPersistence = new CalendarSettingsPersistence({
			getSettings: () => this.settings,
			saveData: (settings) => this.saveData(settings),
			applyImpact: async (previous, next, impact) => {
				if (this.unloading) return;
				if (JSON.stringify(previous.timeZone) !== JSON.stringify(next.timeZone)) this.dayRollover.reschedule(true);
				if (impact === 'index') await this.index.handleSettingsChanged(previous, next);
				if (impact !== 'save') this.renderSidebarCalendars();
				if (basesCalendarSettingsChanged(previous, next)) this.renderBasesCalendars();
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
		this.addRibbonIcon('calendar-days', calendarText(this.settings.calendarLocale, 'openSidebarCalendar'), () => { void this.activateSidebar(); });
		registerCalendarCommands(this);
		this.app.workspace.onLayoutReady(() => {
			void this.index.initialize();
		});
	}

	onunload(): void {
		this.unloading = true;
		void this.flushSettings().catch(() => undefined);
		this.index?.dispose();
		this.suggestions?.dispose();
		this.dayRollover?.dispose();
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

	renderSidebarCalendars(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(CALENDAR_SIDEBAR_VIEW_TYPE)) {
			if (leaf.view instanceof CalendarSidebarView) leaf.view.renderCalendar();
		}
	}

	registerBasesCalendar(view: CalendarBasesView): () => void {
		this.basesCalendars.add(view);
		return () => this.basesCalendars.delete(view);
	}

	renderBasesCalendars(): void {
		for (const view of this.basesCalendars) view.refreshPluginSettings();
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

	async goToToday(): Promise<void> {
		await this.activateSidebar();
		const leaf = this.app.workspace.getLeavesOfType(CALENDAR_SIDEBAR_VIEW_TYPE)[0];
		if (leaf?.view instanceof CalendarSidebarView) leaf.view.goToToday();
	}

	async showTodaysEvents(): Promise<void> {
		await this.activateSidebar();
		const leaf = this.app.workspace.getLeavesOfType(CALENDAR_SIDEBAR_VIEW_TYPE)[0];
		if (leaf?.view instanceof CalendarSidebarView) leaf.view.showAgenda();
	}

	async addSetupProfile(profile: CalendarSourceProfile): Promise<void> {
		const previous = structuredClone(this.settings);
		this.settings.sourceProfiles.push(profile);
		await this.saveSettings(previous, 'index', true);
		this.settingTab?.update();
	}
}

export function basesCalendarSettingsChanged(previous: CalendarSettings, next: CalendarSettings): boolean {
	return previous.firstDayOfWeek !== next.firstDayOfWeek
		|| JSON.stringify(previous.weekendDays) !== JSON.stringify(next.weekendDays)
		|| JSON.stringify(previous.timeZone) !== JSON.stringify(next.timeZone)
		|| previous.calendarLocale !== next.calendarLocale
		|| previous.displayDateFormat !== next.displayDateFormat
		|| previous.eventPropertyDateFormat !== next.eventPropertyDateFormat
		|| JSON.stringify(previous.typeStyleRules) !== JSON.stringify(next.typeStyleRules);
}
