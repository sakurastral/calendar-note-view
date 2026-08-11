import { Modal, Notice, Setting, type App, type BasesPropertyId } from 'obsidian';
import { compareCalendarDates, formatCalendarDate, isCanonicalDate } from './date';
import type { CalendarTextKey } from './calendar-locale';
import { CalendarInputSuggest } from './suggestions';

export interface BasesEventWritableMappings {
	start: BasesPropertyId;
	end?: BasesPropertyId | null;
	title?: BasesPropertyId | null;
	type?: BasesPropertyId | null;
}

export interface BasesEventCreateInput {
	title: string;
	startDate: string;
	endDate: string;
	type: string;
}

type Text = (key: CalendarTextKey, values?: Record<string, string | number>) => string;

export class BasesEventCreateModal extends Modal {
	private readonly input: BasesEventCreateInput;
	private typeSuggest?: CalendarInputSuggest;

	constructor(
		app: App,
		initialDate: string,
		private readonly typeSuggestions: readonly string[],
		private readonly text: Text,
		private readonly createEvent: (input: BasesEventCreateInput) => Promise<void>,
	) {
		super(app);
		this.input = { title: '', startDate: initialDate, endDate: initialDate, type: '' };
	}

	onOpen(): void {
		this.setTitle(this.text('baseCreateTitle'));
		this.modalEl.addClass('calendar-note-bases-create-modal');
		this.addText(this.text('eventTitleLabel'), 'title');
		this.addDate(this.text('startDateLabel'), 'startDate');
		this.addDate(this.text('endDateLabel'), 'endDate');
		this.addText(this.text('eventTypeOptional'), 'type');
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(this.text('cancel')).onClick(() => this.close()))
			.addButton((button) => button.setButtonText(this.text('create')).setCta().onClick(() => { void this.submit(); }));
	}

	onClose(): void {
		this.typeSuggest?.close();
		this.typeSuggest = undefined;
		this.contentEl.empty();
	}

	private addText(label: string, key: 'title' | 'type'): void {
		new Setting(this.contentEl).setName(label).addText((control) => control
			.setValue(this.input[key])
			.onChange((value) => { this.input[key] = value; })
			.then((text) => {
				if (key !== 'type') return;
				this.typeSuggest = new CalendarInputSuggest(
					this.app,
					text.inputEl,
					(query) => filterSuggestions(query, this.typeSuggestions),
					undefined,
					(value) => { this.input.type = value; },
				);
			}));
	}

	private addDate(label: string, key: 'startDate' | 'endDate'): void {
		new Setting(this.contentEl).setName(label).addText((control) => {
			control.inputEl.type = 'date';
			control.setValue(this.input[key]).onChange((value) => { this.input[key] = value; });
		});
	}

	private async submit(): Promise<void> {
		if (!isCanonicalDate(this.input.startDate) || !isCanonicalDate(this.input.endDate) || compareCalendarDates(this.input.endDate, this.input.startDate) < 0) {
			new Notice(this.text('endBeforeStart'));
			return;
		}
		try {
			await this.createEvent({ ...this.input });
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : this.text('baseCreateFailed'));
		}
	}
}

export function writableNoteProperty(property: BasesPropertyId | null | undefined): string | null {
	if (!property?.startsWith('note.')) return null;
	const name = property.slice('note.'.length).trim();
	return name || null;
}

export function applyBasesEventFrontmatter(
	frontmatter: unknown,
	mappings: BasesEventWritableMappings,
	input: BasesEventCreateInput,
	propertyDateFormat: string,
): void {
	if (!isRecord(frontmatter)) return;
	setMapped(frontmatter, mappings.start, formatCalendarDate(input.startDate, propertyDateFormat) ?? input.startDate);
	setMapped(frontmatter, mappings.end, formatCalendarDate(input.endDate, propertyDateFormat) ?? input.endDate);
	if (input.title.trim()) setMapped(frontmatter, mappings.title, input.title.trim());
	if (input.type.trim()) setMapped(frontmatter, mappings.type, input.type.trim());
}

function setMapped(frontmatter: Record<string, unknown>, property: BasesPropertyId | null | undefined, value: string): void {
	const name = writableNoteProperty(property);
	if (name) frontmatter[name] = value;
}

function filterSuggestions(query: string, values: readonly string[]): string[] {
	const normalized = query.trim().toLocaleLowerCase();
	if (!normalized) return [];
	return values.filter((value) => value.toLocaleLowerCase().includes(normalized)).slice(0, 50);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
