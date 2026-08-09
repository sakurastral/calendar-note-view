import { type App, Modal, Setting } from 'obsidian';
import type { SourceProfilePreset } from './settings-helpers';

const PROFILE_PRESETS: Array<{ value: SourceProfilePreset; name: string; description: string }> = [
	{ value: 'folder', name: 'Folder-based', description: 'Start with a profile that matches one or more vault folders.' },
	{ value: 'tag', name: 'Tag-based', description: 'Start with a profile that matches Properties or inline tags.' },
	{ value: 'wiki-link', name: 'Wiki Link-based', description: 'Start with a property-scoped Wiki Link target profile.' },
	{ value: 'start-only', name: 'Start-property-only', description: 'Match any Markdown note containing the configured Start property.' },
	{ value: 'advanced', name: 'Empty / advanced', description: 'Start with an empty, disabled profile and configure every field yourself.' },
];

export class AddSourceProfileModal extends Modal {
	constructor(
		app: App,
		private readonly onSelect: (preset: SourceProfilePreset) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Add source profile');
		this.contentEl.addClass('calendar-note-profile-preset-modal');
		this.contentEl.createEl('p', { text: 'Choose a starting point. You can change every field later.' });
		for (const preset of PROFILE_PRESETS) {
			new Setting(this.contentEl)
				.setName(preset.name)
				.setDesc(preset.description)
				.addButton((button) => button
					.setButtonText('Choose')
					.onClick(() => {
						this.close();
						this.onSelect(preset.value);
					}));
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class ConfirmSettingsActionModal extends Modal {
	constructor(
		app: App,
		private readonly title: string,
		private readonly message: string,
		private readonly confirmLabel: string,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.title);
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button
				.setButtonText(this.confirmLabel)
				.setDestructive()
				.onClick(() => {
					this.close();
					this.onConfirm();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
