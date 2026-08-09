import { setIcon } from 'obsidian';
import { CalendarFloatingSuggest } from './suggestions';

export interface CalendarMultiValueEditorOptions {
	containerEl: HTMLElement;
	values: readonly string[];
	placeholder: string;
	ariaLabel: string;
	getSuggestions?: (query: string) => string[];
	normalize?: (value: string) => string;
	onChange: (values: string[]) => void | Promise<void>;
	onCommit?: () => void | Promise<void>;
}

/** Accessible token editor used by Source Profile Folder, Tag, and Wiki Link inputs. */
export class CalendarMultiValueEditor {
	private readonly rootEl: HTMLDivElement;
	private readonly chipsEl: HTMLDivElement;
	private readonly inputEl: HTMLInputElement;
	private readonly values: string[];
	private readonly suggestions?: CalendarFloatingSuggest;
	private disposed = false;

	constructor(private readonly options: CalendarMultiValueEditorOptions) {
		this.values = unique(options.values.map((value) => this.normalize(value)).filter(Boolean));
		this.rootEl = options.containerEl.createDiv({ cls: 'calendar-note-token-editor' });
		this.chipsEl = this.rootEl.createDiv({ cls: 'calendar-note-token-list', attr: { role: 'list' } });
		const inputRow = this.rootEl.createDiv({ cls: 'calendar-note-token-input-row' });
		this.inputEl = inputRow.createEl('input', {
			cls: 'calendar-note-token-input',
			attr: {
				type: 'text',
				placeholder: options.placeholder,
				'aria-label': options.ariaLabel,
			},
		});
		const clear = inputRow.createEl('button', {
			cls: 'clickable-icon calendar-note-token-clear',
			attr: { type: 'button', 'aria-label': `Clear ${options.ariaLabel} input` },
		});
		setIcon(clear, 'x');
		clear.addEventListener('click', () => {
			this.inputEl.value = '';
			this.inputEl.focus();
		});
		this.inputEl.addEventListener('keydown', this.handleKeydown);
		this.inputEl.addEventListener('blur', this.handleBlur);
		if (options.getSuggestions) {
			this.suggestions = new CalendarFloatingSuggest(
				this.inputEl,
				(query) => options.getSuggestions!(query).filter((value) => !this.hasValue(value)),
				(value) => value,
				(value) => ({ value, cursor: value.length }),
				(value) => {
					this.add(value);
					this.inputEl.value = '';
				},
			);
		}
		this.renderChips();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.inputEl.removeEventListener('keydown', this.handleKeydown);
		this.inputEl.removeEventListener('blur', this.handleBlur);
		this.suggestions?.dispose();
	}

	private readonly handleKeydown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented) return;
		if (event.key === 'Enter' || event.key === ',') {
			if (!this.inputEl.value.trim()) return;
			event.preventDefault();
			this.add(this.inputEl.value);
			this.inputEl.value = '';
			return;
		}
		if (event.key === 'Backspace' && !this.inputEl.value && this.values.length > 0) {
			event.preventDefault();
			this.remove(this.values.length - 1, true);
		}
	};

	private readonly handleBlur = (): void => {
		if (this.inputEl.value.trim()) {
			this.add(this.inputEl.value);
			this.inputEl.value = '';
		}
		void this.options.onCommit?.();
	};

	private add(rawValue: string): void {
		const value = this.normalize(rawValue.replace(/,$/, ''));
		if (!value || this.hasValue(value)) return;
		this.values.push(value);
		this.renderChips();
		void this.options.onChange([...this.values]);
	}

	private remove(index: number, focusInput: boolean): void {
		if (index < 0 || index >= this.values.length) return;
		this.values.splice(index, 1);
		this.renderChips();
		void this.options.onChange([...this.values]);
		if (focusInput) this.inputEl.focus();
	}

	private hasValue(value: string): boolean {
		const normalized = this.normalize(value).toLocaleLowerCase();
		return this.values.some((candidate) => candidate.toLocaleLowerCase() === normalized);
	}

	private normalize(value: string): string {
		return (this.options.normalize ?? ((candidate: string) => candidate.trim()))(value);
	}

	private renderChips(): void {
		this.chipsEl.empty();
		for (const [index, value] of this.values.entries()) {
			const chip = this.chipsEl.createDiv({ cls: 'calendar-note-token', attr: { role: 'listitem' } });
			chip.createSpan({ cls: 'calendar-note-token-label', text: value });
			const remove = chip.createEl('button', {
				cls: 'clickable-icon calendar-note-token-remove',
				attr: { type: 'button', 'aria-label': `Remove ${value}` },
			});
			setIcon(remove, 'x');
			remove.addEventListener('click', () => this.remove(index, true));
		}
	}
}

function unique(values: string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = value.toLocaleLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
