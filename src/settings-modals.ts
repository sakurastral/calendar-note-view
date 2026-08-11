import { type App, Modal, Setting } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import type { CalendarLocale } from './models';
import type { SourceProfilePreset } from './settings-helpers';

const PROFILE_PRESETS: Array<{ value: SourceProfilePreset; key: CalendarTextKey }> = [
	{ value: 'folder', key: 'folderBased' },
	{ value: 'tag', key: 'tagBased' },
	{ value: 'wiki-link', key: 'wikiLinkBased' },
	{ value: 'start-only', key: 'startPropertyOnly' },
	{ value: 'advanced', key: 'advancedEmpty' },
];

export class AddSourceProfileModal extends Modal {
	constructor(
		app: App,
		private readonly onSelect: (preset: SourceProfilePreset) => void,
		private readonly locale: CalendarLocale = 'en',
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(calendarText(this.locale, 'addSourceProfile'));
		this.contentEl.addClass('calendar-note-profile-preset-modal');
		this.contentEl.createEl('p', { text: calendarText(this.locale, 'choosePresetDescription') });
		for (const preset of PROFILE_PRESETS) {
			new Setting(this.contentEl)
				.setName(calendarText(this.locale, preset.key))
				.addButton((button) => button
					.setButtonText(calendarText(this.locale, 'next'))
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
