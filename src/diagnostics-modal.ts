import { apiVersion, Modal, Notice, Platform, Setting, setIcon, setTooltip } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import type CalendarNoteViewPlugin from './main';
import { createCalendarSupportSummary } from './support-summary';

export function buildCalendarSupportSummary(plugin: CalendarNoteViewPlugin, includeFilePaths = false): string {
	const diagnostics = plugin.diagnostics.getAll();
	return createCalendarSupportSummary({
		pluginVersion: plugin.manifest.version,
		obsidianApiVersion: apiVersion,
		platform: Platform.isMobile ? 'Mobile' : 'Desktop',
		indexState: plugin.index.getStatus(),
		profileCount: plugin.settings.sourceProfiles.length,
		enabledProfileCount: plugin.settings.sourceProfiles.filter((profile) => profile.enabled).length,
		eventCount: plugin.index.getAllItems().length,
		diagnostics,
		settingsSchemaVersion: plugin.settings.schemaVersion,
	}, includeFilePaths);
}

export class CalendarDiagnosticsModal extends Modal {
	private includeFilePaths = false;

	constructor(private readonly plugin: CalendarNoteViewPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.setTitle(this.text('calendarDiagnostics'));
		this.modalEl.addClass('calendar-note-diagnostics-modal');
		this.contentEl.addClass('calendar-note-diagnostics');
		const diagnostics = this.plugin.diagnostics.getAll();
		const counts = { error: 0, warning: 0, info: 0 };
		for (const diagnostic of diagnostics) counts[diagnostic.severity] += 1;
		this.contentEl.createDiv({
			cls: 'calendar-note-diagnostics-summary',
			text: this.text('severitySummary', { errors: counts.error, warnings: counts.warning, info: counts.info }),
		});
		new Setting(this.contentEl)
			.setName(this.text('copySupportSummary'))
			.addToggle((toggle) => toggle.setTooltip(this.text('includeFilePaths')).setValue(false).onChange((value) => { this.includeFilePaths = value; }))
			.addButton((button) => button.setButtonText(this.text('copySupportSummary')).setIcon('copy').onClick(() => { void this.copySupportSummary(); }));
		if (diagnostics.length === 0) {
			this.contentEl.createDiv({ cls: 'calendar-note-empty-state', text: this.text('noDiagnostics') });
			return;
		}
		const table = this.contentEl.createEl('table', { cls: 'calendar-note-diagnostics-table' });
		const header = table.createTHead().insertRow();
		for (const label of [this.text('codeLabel'), this.text('messageLabel'), this.text('fileLabel'), this.text('sourceProfileColumn')]) header.createEl('th', { text: label });
		const body = table.createTBody();
		for (const diagnostic of diagnostics) {
			const row = body.insertRow();
			row.dataset.severity = diagnostic.severity;
			row.insertCell().setText(diagnostic.code);
			row.insertCell().setText(diagnostic.message);
			const fileCell = row.insertCell();
			if (diagnostic.filePath) this.renderFileActions(fileCell, diagnostic.filePath);
			else fileCell.setText(this.text('profileSetting'));
			const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === diagnostic.sourceProfileId);
			const profileCell = row.insertCell();
			profileCell.createSpan({ text: profile?.name ?? diagnostic.sourceProfileId });
			if (diagnostic.sourceProfileId) {
				const copy = profileCell.createEl('button', { cls: 'clickable-icon calendar-note-diagnostic-copy-profile' });
				copy.type = 'button';
				setIcon(copy, 'copy');
				setTooltip(copy, this.text('copyProfileId'));
				copy.addEventListener('click', () => { void navigator.clipboard.writeText(diagnostic.sourceProfileId); });
			}
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderFileActions(container: HTMLElement, filePath: string): void {
		const open = container.createEl('button', { cls: 'clickable-icon calendar-note-diagnostic-file' });
		open.type = 'button';
		setIcon(open, 'file-text');
		setTooltip(open, this.text('openNote'));
		open.addEventListener('click', () => { void this.openFile(filePath, false); });
		const newTab = container.createEl('button', { cls: 'clickable-icon calendar-note-diagnostic-file' });
		newTab.type = 'button';
		setIcon(newTab, 'file-plus');
		setTooltip(newTab, this.text('openInNewTab'));
		newTab.addEventListener('click', () => { void this.openFile(filePath, true); });
	}

	private async copySupportSummary(): Promise<void> {
		await navigator.clipboard.writeText(buildCalendarSupportSummary(this.plugin, this.includeFilePaths));
		new Notice(this.text('supportSummaryCopied'));
	}

	private async openFile(filePath: string, newTab: boolean): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(filePath);
		if (!file) return;
		await this.plugin.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}
