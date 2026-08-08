import { Plugin } from 'obsidian';
import { CalendarDiagnosticsService } from './diagnostics';
import { CalendarIndexService } from './index-service';
import type { CalendarSettings } from './models';
import { loadCalendarSettings } from './settings-data';
import { CalendarNoteSettingTab } from './settings';
import { CalendarSuggestionProvider } from './suggestions';

export default class CalendarNoteViewPlugin extends Plugin {
	settings!: CalendarSettings;
	diagnostics!: CalendarDiagnosticsService;
	index!: CalendarIndexService;
	suggestions!: CalendarSuggestionProvider;

	async onload(): Promise<void> {
		const loaded = loadCalendarSettings(await this.loadData());
		this.settings = loaded.settings;
		if (loaded.migrated) await this.saveData(this.settings);

		this.diagnostics = new CalendarDiagnosticsService();
		this.suggestions = new CalendarSuggestionProvider(this.app);
		this.suggestions.initialize();
		this.index = new CalendarIndexService(this.app, () => this.settings, this.diagnostics);

		this.addSettingTab(new CalendarNoteSettingTab(this.app, this));
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
	}
}
