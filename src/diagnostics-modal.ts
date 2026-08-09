import { Modal, setIcon } from 'obsidian';
import type CalendarNoteViewPlugin from './main';

export class CalendarDiagnosticsModal extends Modal {
	constructor(private readonly plugin: CalendarNoteViewPlugin) {
		super(plugin.app);
	}

	onOpen(): void {
		this.setTitle('Calendar diagnostics');
		this.contentEl.addClass('calendar-note-diagnostics');
		const diagnostics = this.plugin.diagnostics.getAll();
		if (diagnostics.length === 0) {
			this.contentEl.createDiv({ cls: 'calendar-note-empty-state', text: 'No calendar diagnostics.' });
			return;
		}
		const table = this.contentEl.createEl('table', { cls: 'calendar-note-diagnostics-table' });
		const header = table.createTHead().insertRow();
		for (const label of ['Code', 'Message', 'File', 'Source profile']) header.createEl('th', { text: label });
		const body = table.createTBody();
		for (const diagnostic of diagnostics) {
			const row = body.insertRow();
			row.dataset.severity = diagnostic.severity;
			row.insertCell().setText(diagnostic.code);
			row.insertCell().setText(diagnostic.message);
			const fileCell = row.insertCell();
			if (diagnostic.filePath) {
				const fileButton = fileCell.createEl('button', { cls: 'calendar-note-diagnostic-file' });
				const icon = fileButton.createSpan();
				setIcon(icon, 'file-text');
				fileButton.createSpan({ text: diagnostic.filePath });
				fileButton.addEventListener('click', () => { void this.openFile(diagnostic.filePath); });
			} else {
				fileCell.setText('Profile setting');
			}
			const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === diagnostic.sourceProfileId);
			row.insertCell().setText(profile?.name ?? diagnostic.sourceProfileId);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async openFile(filePath: string): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(filePath);
		if (!file) return;
		await this.plugin.app.workspace.getLeaf(false).openFile(file);
		this.close();
	}
}
