import { Modal, Notice, Setting } from 'obsidian';
import { formatCalendarDate, getTodayCanonical } from './date';
import type { CreateEventInput, EventNoteCreationService } from './event-creation';
import type CalendarNoteViewPlugin from './main';

export class CreateEventModal extends Modal {
	private input: CreateEventInput;
	private previewEl?: HTMLElement;
	private readonly textInputs = new Map<'type' | 'icon' | 'backgroundColor' | 'textColor', HTMLInputElement>();

	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly creationService: EventNoteCreationService,
		initialDate = getTodayCanonical(plugin.settings.timeZone),
	) {
		super(plugin.app);
		const profile = plugin.settings.sourceProfiles.find((candidate) => candidate.enabled && candidate.allowCreate);
		this.input = {
			profileId: profile?.id ?? '',
			title: '',
			startDate: initialDate,
			endDate: initialDate,
			type: profile?.defaultType ?? '',
			icon: profile?.defaultIcon ?? '',
			backgroundColor: profile?.defaultBackgroundColor ?? '',
			textColor: profile?.defaultTextColor ?? '',
			collision: 'append-number',
		};
	}

	onOpen(): void {
		this.setTitle('Create event');
		this.modalEl.addClass('calendar-note-create-modal');
		const profiles = this.plugin.settings.sourceProfiles.filter((profile) => profile.enabled && profile.allowCreate);
		if (profiles.length === 0) {
			this.contentEl.createEl('p', { text: 'No enabled source profile allows event creation.' });
			return;
		}

		new Setting(this.contentEl)
			.setName('Source profile')
			.setDesc('Controls the folder, template, property mapping, and defaults.')
			.addDropdown((dropdown) => {
				for (const profile of profiles) dropdown.addOption(profile.id, profile.name);
				dropdown.setValue(this.input.profileId).onChange((value) => {
					this.input.profileId = value;
					const profile = profiles.find((candidate) => candidate.id === value);
					this.input.type = profile?.defaultType ?? '';
					this.input.icon = profile?.defaultIcon ?? '';
					this.input.backgroundColor = profile?.defaultBackgroundColor ?? '';
					this.input.textColor = profile?.defaultTextColor ?? '';
					for (const key of ['type', 'icon', 'backgroundColor', 'textColor'] as const) {
						const input = this.textInputs.get(key);
						if (input) input.value = this.input[key] ?? '';
					}
					this.refreshPreview();
				});
			});
		this.addTextSetting('Event title', 'Required.', 'Title', 'title');
		this.addDateSetting('Start date', 'Required calendar date.', 'startDate');
		this.addDateSetting('End date', 'Clear this value for a single-day event.', 'endDate');
		this.addTextSetting('Event type', 'Plain text or a wiki link.', '[[Holiday]]', 'type');
		this.addTextSetting('Icon', 'Obsidian icon name.', 'calendar', 'icon');
		this.addTextSetting('Background color', 'Hex, rgb(), hsl(), or a CSS variable.', 'var(--interactive-accent)', 'backgroundColor');
		this.addTextSetting('Text color', 'Hex, rgb(), hsl(), or a CSS variable.', 'var(--text-on-accent)', 'textColor');
		new Setting(this.contentEl)
			.setName('If the filename already exists')
			.addDropdown((dropdown) => dropdown
				.addOption('append-number', 'Append a number')
				.addOption('cancel', 'Cancel')
				.setValue(this.input.collision ?? 'append-number')
				.onChange((value) => { this.input.collision = value === 'cancel' ? 'cancel' : 'append-number'; }));

		this.previewEl = this.contentEl.createDiv({ cls: 'calendar-note-create-preview' });
		this.refreshPreview();
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((button) => button.setButtonText('Create event').setCta().onClick(async () => {
				try {
					const result = await this.creationService.create(this.input);
					if (result.status === 'cancelled') {
						new Notice('An event note with that filename already exists.');
						return;
					}
					this.close();
					if (result.file) await this.app.workspace.getLeaf(false).openFile(result.file);
				} catch (error) {
					new Notice(error instanceof Error ? error.message : 'Could not create the event note.');
				}
			}));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private addTextSetting(
		name: string,
		description: string,
		placeholder: string,
		key: 'title' | 'type' | 'icon' | 'backgroundColor' | 'textColor',
	): void {
		new Setting(this.contentEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => text
				.setPlaceholder(placeholder)
				.setValue(this.input[key] ?? '')
				.onChange((value) => {
					this.input[key] = value;
					this.refreshPreview();
				}).then((text) => {
					if (key !== 'title') this.textInputs.set(key, text.inputEl);
				}));
	}

	private addDateSetting(name: string, description: string, key: 'startDate' | 'endDate'): void {
		new Setting(this.contentEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.inputEl.type = 'date';
				text.setValue(this.input[key] ?? '').onChange((value) => {
					this.input[key] = value;
					this.refreshPreview();
				});
			});
	}

	private refreshPreview(): void {
		if (!this.previewEl) return;
		this.previewEl.empty();
		this.previewEl.createEl('h3', { text: 'Preview' });
		try {
			const preview = this.creationService.preview(this.input);
			this.addPreviewRow('Generated title', preview.generatedTitle);
			this.addPreviewRow('File name', preview.fileName);
			this.addPreviewRow('Create folder', preview.createFolder || 'Vault root');
			this.addPreviewRow('Template', preview.templatePath || 'None');
			const formattedStart = formatCalendarDate(this.input.startDate, this.plugin.settings.displayDateFormat);
			if (formattedStart) this.addPreviewRow('Displayed start date', formattedStart);
		} catch (error) {
			this.previewEl.createEl('p', { cls: 'calendar-note-create-preview-error', text: error instanceof Error ? error.message : 'Complete the required fields.' });
		}
	}

	private addPreviewRow(label: string, value: string): void {
		if (!this.previewEl) return;
		const row = this.previewEl.createDiv({ cls: 'calendar-note-create-preview-row' });
		row.createSpan({ cls: 'calendar-note-create-preview-label', text: label });
		row.createSpan({ text: value });
	}
}
