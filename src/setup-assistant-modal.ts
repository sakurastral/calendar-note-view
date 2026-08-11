import { Modal, Notice, Setting } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import type CalendarNoteViewPlugin from './main';
import type { CalendarSourceProfile } from './models';
import { ProfileMatchingInspectorModal } from './profile-inspector';
import {
	applySourceProfileSetupPreset,
	createSourceProfileSetupDraft,
	finalizeSourceProfileSetupDraft,
	type SourceProfilePreset,
	type SourceProfileSetupDraft,
} from './settings-helpers';

const PRESETS: Array<{ value: SourceProfilePreset; key: CalendarTextKey }> = [
	{ value: 'folder', key: 'folderBased' },
	{ value: 'tag', key: 'tagBased' },
	{ value: 'wiki-link', key: 'wikiLinkBased' },
	{ value: 'start-only', key: 'startPropertyOnly' },
	{ value: 'advanced', key: 'advancedEmpty' },
];

const STEP_KEYS: CalendarTextKey[] = [
	'setupChooseSource', 'setupSourceMatching', 'setupPropertyMapping', 'setupEventCreation', 'setupReview',
];

export class SetupAssistantModal extends Modal {
	private readonly draft: SourceProfileSetupDraft;
	private step = 0;
	private busy = false;

	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly onFinish: (profile: CalendarSourceProfile) => Promise<void>,
	) {
		super(plugin.app);
		this.draft = createSourceProfileSetupDraft(plugin.settings.sourceProfiles);
	}

	onOpen(): void {
		this.modalEl.addClass('calendar-note-setup-modal');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();
		this.setTitle(this.text('setupAssistant'));
		const progress = this.contentEl.createDiv({ cls: 'calendar-note-setup-progress' });
		for (const [index, key] of STEP_KEYS.entries()) {
			const marker = progress.createDiv({ cls: 'calendar-note-setup-step', text: `${index + 1}` });
			marker.setAttribute('aria-label', this.text(key));
			marker.toggleClass('is-active', index === this.step);
			marker.toggleClass('is-complete', index < this.step);
		}
		const heading = this.contentEl.createEl('h3', { text: this.text(STEP_KEYS[this.step] ?? 'setupReview') });
		heading.tabIndex = -1;
		if (this.step === 0) this.renderPresetStep();
		if (this.step === 1) this.renderMatchingStep();
		if (this.step === 2) this.renderMappingStep();
		if (this.step === 3) this.renderCreationStep();
		if (this.step === 4) this.renderReviewStep();
		this.renderNavigation();
		window.setTimeout(() => heading.focus(), 0);
	}

	private renderPresetStep(): void {
		this.contentEl.createEl('p', { text: this.text('choosePresetDescription') });
		const choices = this.contentEl.createDiv({ cls: 'calendar-note-setup-presets', attr: { role: 'radiogroup' } });
		for (const preset of PRESETS) {
			const button = choices.createEl('button', { cls: 'calendar-note-setup-preset', text: this.text(preset.key) });
			button.type = 'button';
			button.setAttribute('role', 'radio');
			button.setAttribute('aria-checked', String(this.draft.preset === preset.value));
			button.toggleClass('is-selected', this.draft.preset === preset.value);
			button.addEventListener('click', () => {
				applySourceProfileSetupPreset(this.draft, preset.value);
				this.render();
			});
		}
		this.addText(this.text('profileName'), this.draft.profile.name, (value) => { this.draft.profile.name = value; });
	}

	private renderMatchingStep(): void {
		const profile = this.draft.profile;
		if (this.draft.preset === 'folder' || this.draft.preset === 'advanced') {
			this.addText(this.text('foldersLabel'), profile.folders.join(', '), (value) => { profile.folders = splitValues(value); }, 'Events, Meetings');
		}
		if (this.draft.preset === 'tag' || this.draft.preset === 'advanced') {
			this.addText(this.text('tagsLabel'), profile.tags.join(', '), (value) => { profile.tags = splitValues(value); }, '#calendar');
		}
		if (this.draft.preset === 'wiki-link' || this.draft.preset === 'advanced') {
			this.addText(this.text('wikiLinkPropertyLabel'), profile.wikiLinkProperty ?? '', (value) => { profile.wikiLinkProperty = value; }, 'calendar-event-type');
			this.addText(this.text('wikiLinkTargetsLabel'), profile.wikiLinkTargets.join(', '), (value) => { profile.wikiLinkTargets = splitValues(value); }, '[[Calendar]]');
		}
		if (this.draft.preset === 'start-only') {
			this.contentEl.createEl('p', { text: this.text('startPropertyOnly') });
		}
	}

	private renderMappingStep(): void {
		const profile = this.draft.profile;
		this.addText(this.text('startPropertyLabel'), profile.startProperty, (value) => { profile.startProperty = value; }, 'event-start');
		this.addText(this.text('endPropertyLabel'), profile.endProperty ?? '', (value) => { profile.endProperty = value || undefined; }, 'event-end');
		this.addText(this.text('titlePropertyLabel'), profile.titleProperty ?? '', (value) => { profile.titleProperty = value || undefined; }, 'title');
		this.addText(this.text('typePropertyLabel'), profile.typeProperty ?? '', (value) => { profile.typeProperty = value || undefined; }, 'event-type');
	}

	private renderCreationStep(): void {
		const profile = this.draft.profile;
		new Setting(this.contentEl)
			.setName(this.text('allowEventCreation'))
			.addToggle((toggle) => toggle.setValue(profile.allowCreate).onChange((value) => {
				profile.allowCreate = value;
				this.render();
			}));
		if (!profile.allowCreate) return;
		this.addText(this.text('createFolder'), profile.createFolder ?? '', (value) => { profile.createFolder = value || undefined; }, 'Events');
		this.addText(this.text('template'), profile.noteTemplatePath ?? '', (value) => { profile.noteTemplatePath = value || undefined; }, 'Templates/Event.md');
	}

	private renderReviewStep(): void {
		const profile = this.draft.profile;
		const review = this.contentEl.createDiv({ cls: 'calendar-note-setup-review' });
		this.reviewRow(review, this.text('profileName'), profile.name);
		this.reviewRow(review, this.text('setupChooseSource'), this.text(PRESETS.find((entry) => entry.value === this.draft.preset)?.key ?? 'advancedEmpty'));
		this.reviewRow(review, this.text('startPropertyLabel'), profile.startProperty || '—');
		this.reviewRow(review, this.text('allowEventCreation'), profile.allowCreate ? this.text('enabled') : this.text('disabled'));
		new Setting(this.contentEl)
			.setName(this.text('testThisProfile'))
			.setDesc(this.text('chooseNote'))
			.addButton((button) => button.setButtonText(this.text('testNote')).setIcon('flask-conical').onClick(() => {
				new ProfileMatchingInspectorModal(this.plugin, profile).open();
			}));
	}

	private renderNavigation(): void {
		const footer = this.contentEl.createDiv({ cls: 'calendar-note-setup-footer' });
		const cancel = footer.createEl('button', { text: this.text('cancel') });
		cancel.type = 'button';
		cancel.addEventListener('click', () => this.close());
		if (this.step > 0) {
			const back = footer.createEl('button', { text: this.text('back') });
			back.type = 'button';
			back.addEventListener('click', () => { this.step -= 1; this.render(); });
		}
		const forward = footer.createEl('button', { cls: 'mod-cta', text: this.text(this.step === 4 ? 'finish' : 'next') });
		forward.type = 'button';
		forward.disabled = this.busy;
		forward.addEventListener('click', () => {
			if (this.step < 4) {
				this.step += 1;
				this.render();
				return;
			}
			void this.finish();
		});
	}

	private async finish(): Promise<void> {
		if (this.busy) return;
		if (!this.draft.profile.startProperty.trim()) {
			new Notice(this.text('startConfigured'));
			this.step = 2;
			this.render();
			return;
		}
		this.busy = true;
		this.render();
		try {
			const profile = finalizeSourceProfileSetupDraft(this.draft, this.plugin.settings.sourceProfiles);
			await this.onFinish(profile);
			this.close();
			new Notice(this.text('profileCreated'));
		} finally {
			this.busy = false;
		}
	}

	private addText(name: string, value: string, onChange: (value: string) => void, placeholder = ''): void {
		new Setting(this.contentEl).setName(name).addText((text) => text
			.setPlaceholder(placeholder)
			.setValue(value)
			.onChange(onChange));
	}

	private reviewRow(container: HTMLElement, label: string, value: string): void {
		const row = container.createDiv({ cls: 'calendar-note-setup-review-row' });
		row.createSpan({ cls: 'calendar-note-setup-review-label', text: label });
		row.createSpan({ text: value });
	}

	private text(key: CalendarTextKey): string {
		return calendarText(this.plugin.settings.calendarLocale, key);
	}
}

function splitValues(value: string): string[] {
	return [...new Set(value.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
}
