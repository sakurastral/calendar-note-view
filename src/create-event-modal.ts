import { ButtonComponent, Modal, Notice, Setting } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import { formatCalendarDate, getTodayCanonical } from './date';
import {
	applyCreateProfileDefaults,
	isCreateProfile,
	selectInitialCreateProfile,
	validateCreateEventInput,
	type CreateEventDirtyField,
} from './create-event-state';
import type { CreateEventInput, EventNoteCreationService } from './event-creation';
import { collectEventTypeValues } from './event-types';
import type CalendarNoteViewPlugin from './main';
import { sortSourceProfiles } from './source-profile';
import { CalendarStyleResolver } from './style-resolver';
import { CalendarInputSuggest } from './suggestions';
import { SetupAssistantModal } from './setup-assistant-modal';

export class CreateEventModal extends Modal {
	private input: CreateEventInput;
	private readonly dirty = new Set<CreateEventDirtyField>();
	private readonly inputs = new Map<CreateEventDirtyField | 'startDate' | 'endDate', HTMLInputElement>();
	private previewEl?: HTMLElement;
	private validationEl?: HTMLElement;
	private advancedSummaryEl?: HTMLElement;
	private eventTypeSuggest?: CalendarInputSuggest;
	private createButton?: ButtonComponent;
	private submitting = false;
	private readonly keyHandler = (event: KeyboardEvent): void => {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			void this.submit();
		}
	};

	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly creationService: EventNoteCreationService,
		initialDate = getTodayCanonical(plugin.settings.timeZone),
		initialProfileId?: string,
	) {
		super(plugin.app);
		const profile = selectInitialCreateProfile(plugin.settings.sourceProfiles, plugin.settings.lastCreateProfileId, initialProfileId);
		this.input = {
			profileId: profile?.id ?? '',
			title: '',
			startDate: initialDate,
			endDate: initialDate,
			type: profile?.defaultType ?? '',
			icon: '',
			backgroundColor: '',
			textColor: '',
			collision: 'append-number',
		};
	}

	onOpen(): void {
		this.setTitle(this.text('createEvent'));
		this.modalEl.addClass('calendar-note-create-modal');
		this.modalEl.addEventListener('keydown', this.keyHandler);
		const profiles = sortSourceProfiles(this.plugin.settings.sourceProfiles).filter(isCreateProfile);
		if (profiles.length === 0) {
			this.contentEl.createDiv({ cls: 'calendar-note-empty-state', text: this.text('eventCreationUnavailable') });
			new Setting(this.contentEl).addButton((button) => button
				.setButtonText(this.text('configureEventCreation'))
				.onClick(() => {
					this.close();
					new SetupAssistantModal(this.plugin, (profile) => this.plugin.addSetupProfile(profile)).open();
				}));
			return;
		}

		new Setting(this.contentEl)
			.setName(this.text('sourceProfileLabel'))
			.setDesc(this.text('sourceProfileDescription'))
			.addDropdown((dropdown) => {
				for (const profile of profiles) dropdown.addOption(profile.id, profile.name);
				dropdown.setValue(this.input.profileId).onChange((value) => { void this.selectProfile(value); });
			});
		this.addText(this.text('eventTitleLabel'), 'title', 'Title');
		this.addDate(this.text('startDateLabel'), 'startDate');
		this.addDate(this.text('inclusiveEndDateLabel'), 'endDate');
		this.addText(this.text('eventTypeLabelOptional'), 'type', '[[Holiday]]');

		const details = this.contentEl.createEl('details', { cls: 'calendar-note-create-advanced' });
		const summary = details.createEl('summary');
		summary.createSpan({ text: this.text('advancedDetails') });
		this.advancedSummaryEl = summary.createSpan({ cls: 'calendar-note-create-advanced-summary' });
		this.addAdvancedText(details, this.text('iconOverride'), 'icon', 'calendar');
		this.addAdvancedText(details, this.text('backgroundOverride'), 'backgroundColor', 'var(--interactive-accent)');
		this.addAdvancedText(details, this.text('textOverride'), 'textColor', 'var(--text-on-accent)');
		new Setting(details)
			.setName(this.text('collisionBehavior'))
			.addDropdown((dropdown) => dropdown
				.addOption('append-number', this.text('appendNumber'))
				.addOption('cancel', this.text('cancelCreation'))
				.setValue(this.input.collision ?? 'append-number')
				.onChange((value) => { this.input.collision = value === 'cancel' ? 'cancel' : 'append-number'; }));
		this.previewEl = details.createDiv({ cls: 'calendar-note-create-preview' });

		this.validationEl = this.contentEl.createDiv({ cls: 'calendar-note-create-validation', attr: { 'aria-live': 'polite' } });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(this.text('cancel')).onClick(() => this.close()))
			.addButton((button) => {
				this.createButton = button;
				button.setButtonText(this.text('createEvent')).setCta().onClick(() => { void this.submit(); });
			});
		this.refreshState();
		window.setTimeout(() => this.inputs.get('title')?.focus(), 0);
	}

	onClose(): void {
		this.modalEl.removeEventListener('keydown', this.keyHandler);
		this.eventTypeSuggest?.close();
		this.eventTypeSuggest = undefined;
		this.contentEl.empty();
	}

	private async selectProfile(profileId: string): Promise<void> {
		const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === profileId && isCreateProfile(candidate));
		if (!profile) return;
		applyCreateProfileDefaults(this.input, profile, this.dirty);
		for (const key of ['type', 'icon', 'backgroundColor', 'textColor'] as const) {
			const input = this.inputs.get(key);
			if (input) input.value = this.input[key] ?? '';
		}
		await this.rememberProfile(profile.id);
		this.refreshState();
	}

	private addText(name: string, key: 'title' | 'type', placeholder: string): void {
		new Setting(this.contentEl).setName(name).addText((text) => {
			text.setPlaceholder(placeholder).setValue(this.input[key] ?? '').onChange((value) => {
				this.input[key] = value;
				this.dirty.add(key);
				this.refreshState();
			});
			this.inputs.set(key, text.inputEl);
			if (key === 'type') {
				const values = collectEventTypeValues(this.plugin.settings, this.plugin.index.getAllItems(), [this.input.type]);
				this.eventTypeSuggest = new CalendarInputSuggest(this.app, text.inputEl,
					(query) => this.plugin.suggestions.getEventTypeSuggestions(query, values), undefined,
					(value) => { this.input.type = value; this.dirty.add('type'); this.refreshState(); });
			}
		});
	}

	private addAdvancedText(container: HTMLElement, name: string, key: 'icon' | 'backgroundColor' | 'textColor', placeholder: string): void {
		new Setting(container).setName(name).addText((text) => {
			text.setPlaceholder(placeholder).setValue(this.input[key] ?? '').onChange((value) => {
				this.input[key] = value;
				this.dirty.add(key);
				this.refreshState();
			});
			this.inputs.set(key, text.inputEl);
		});
	}

	private addDate(name: string, key: 'startDate' | 'endDate'): void {
		new Setting(this.contentEl).setName(name).addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(this.input[key] ?? '').onChange((value) => {
				this.input[key] = value;
				this.refreshState();
			});
			this.inputs.set(key, text.inputEl);
		});
	}

	private refreshState(): void {
		const validation = validateCreateEventInput(this.input, this.plugin.settings.sourceProfiles);
		if (this.validationEl) {
			this.validationEl.setText(validation.message ? this.text(validation.message) : '');
			this.validationEl.toggleClass('is-visible', !validation.valid);
		}
		this.createButton?.setDisabled(this.submitting || !validation.valid);
		if (this.createButton) this.createButton.setButtonText(this.submitting ? this.text('creating') : this.text('createEvent'));
		const overrideCount = (['icon', 'backgroundColor', 'textColor'] as const).filter((key) => Boolean(this.input[key]?.trim())).length;
		if (this.advancedSummaryEl) this.advancedSummaryEl.setText(overrideCount > 0 ? this.text('advancedOverrides', { count: overrideCount }) : '');
		this.refreshPreview();
	}

	private refreshPreview(): void {
		if (!this.previewEl) return;
		this.previewEl.empty();
		this.previewEl.createEl('h4', { text: this.text('generatedOutput') });
		try {
			const preview = this.creationService.preview(this.input);
			this.previewRow(this.text('generatedTitle'), preview.generatedTitle);
			this.previewRow(this.text('fileName'), preview.fileName);
			this.previewRow(this.text('createFolder'), preview.createFolder || this.text('vaultRoot'));
			this.previewRow(this.text('template'), preview.templatePath || this.text('none'));
			const start = formatCalendarDate(this.input.startDate, this.plugin.settings.displayDateFormat);
			if (start) this.previewRow(this.text('displayedStartDate'), start);
			const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === this.input.profileId);
			if (profile) {
				const resolution = new CalendarStyleResolver().resolve({
					id: 'create-preview', filePath: '', startDate: this.input.startDate, endDate: this.input.endDate || this.input.startDate,
					title: this.input.title || 'Preview', type: this.input.type, icon: this.input.icon || undefined,
					backgroundColor: this.input.backgroundColor || undefined, textColor: this.input.textColor || undefined,
					sourceProfileId: profile.id,
				}, profile, this.plugin.settings.typeStyleRules);
				this.previewRow(this.text('styleSources'), `Icon: ${this.sourceLabel(resolution.sources.icon)} · Background: ${this.sourceLabel(resolution.sources.backgroundColor)} · Text: ${this.sourceLabel(resolution.sources.textColor)}`);
			}
		} catch (error) {
			this.previewEl.createEl('p', { cls: 'calendar-note-create-preview-error', text: error instanceof Error ? error.message : this.text('completeRequiredFields') });
		}
	}

	private async submit(): Promise<void> {
		if (this.submitting) return;
		const validation = validateCreateEventInput(this.input, this.plugin.settings.sourceProfiles);
		if (!validation.valid) {
			this.refreshState();
			if (validation.field && validation.field !== 'profileId') this.inputs.get(validation.field)?.focus();
			return;
		}
		this.submitting = true;
		this.refreshState();
		try {
			await this.rememberProfile(this.input.profileId);
			const result = await this.creationService.create(this.input);
			if (result.status === 'cancelled') {
				new Notice(this.text('filenameExists'));
				return;
			}
			new Notice(this.text('created'));
			this.close();
			if (result.file) await this.app.workspace.getLeaf(false).openFile(result.file);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : this.text('createFailed'));
			this.inputs.get('title')?.focus();
		} finally {
			this.submitting = false;
			if (this.contentEl.isConnected) this.refreshState();
		}
	}

	private async rememberProfile(profileId: string): Promise<void> {
		if (this.plugin.settings.lastCreateProfileId === profileId) return;
		const previous = structuredClone(this.plugin.settings);
		this.plugin.settings.lastCreateProfileId = profileId;
		await this.plugin.saveSettings(previous, 'save');
	}

	private previewRow(label: string, value: string): void {
		if (!this.previewEl) return;
		const row = this.previewEl.createDiv({ cls: 'calendar-note-create-preview-row' });
		row.createSpan({ cls: 'calendar-note-create-preview-label', text: label });
		row.createSpan({ text: value });
	}

	private sourceLabel(source: ReturnType<CalendarStyleResolver['resolve']>['sources']['icon']): string {
		if (source === 'note') return this.text('userOverride');
		if (source === 'type-rule') return this.text('eventTypeRule');
		if (source === 'source-profile') return this.text('profileDefault');
		if (source === 'style-settings') return this.text('styleSettingsFallback');
		return this.text('themeFallback');
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}
