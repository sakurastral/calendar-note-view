import { AbstractInputSuggest, type App, type EventRef, getAllTags, getIconIds, TFolder } from 'obsidian';
import {
	commitInputSuggestion,
	type CommitInputValue,
	getFloatingSuggestionLayout,
	type SuggestionReplacement,
} from './input-events';
import { rankSuggestions } from './suggestion-ranking';

export class CalendarSuggestionProvider {
	private folders: string[] = [];
	private properties: string[] = [];
	private tags: string[] = [];
	private wikiLinks: string[] = [];
	private icons: string[] = [];
	private refs: Array<{ owner: 'vault' | 'metadata'; ref: EventRef }> = [];

	constructor(private readonly app: App) {}

	initialize(): void {
		this.refreshFolders();
		this.refreshProperties();
		this.refreshTags();
		this.refreshWikiLinks();
		this.icons = getIconIds().sort((left, right) => left.localeCompare(right));
		this.refs.push(
			{ owner: 'vault', ref: this.app.vault.on('create', () => this.refreshVaultSuggestions()) },
			{ owner: 'vault', ref: this.app.vault.on('delete', () => this.refreshVaultSuggestions()) },
			{ owner: 'vault', ref: this.app.vault.on('rename', () => this.refreshVaultSuggestions()) },
			{ owner: 'metadata', ref: this.app.metadataCache.on('changed', () => {
				this.refreshProperties();
				this.refreshTags();
			}) },
		);
	}

	dispose(): void {
		for (const { owner, ref } of this.refs) {
			if (owner === 'vault') this.app.vault.offref(ref);
			else this.app.metadataCache.offref(ref);
		}
		this.refs = [];
	}

	getFolderSuggestions(query: string): string[] {
		return rankSuggestions(query, this.folders);
	}

	getPropertySuggestions(query: string): string[] {
		return rankSuggestions(query, this.properties);
	}

	getTagSuggestions(query: string): string[] {
		return rankSuggestions(query.replace(/^#/, ''), this.tags);
	}

	getWikiLinkSuggestions(query: string): string[] {
		const normalized = query.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
		return rankSuggestions(normalized, this.wikiLinks);
	}

	getMarkdownFileSuggestions(query: string): string[] {
		return rankSuggestions(query, this.wikiLinks.map((value) => value.slice(2, -2) + '.md'));
	}

	getIconSuggestions(query: string): string[] {
		return rankSuggestions(query, this.icons);
	}

	getEventTypeSuggestions(query: string, values: Iterable<string>): string[] {
		return rankSuggestions(query, values);
	}

	getTimeZoneSuggestions(query: string): string[] {
		return rankSuggestions(query, getIanaTimeZones());
	}

	private refreshVaultSuggestions(): void {
		this.refreshFolders();
		this.refreshWikiLinks();
	}

	refreshFolders(): void {
		this.folders = this.app.vault.getAllLoadedFiles()
			.filter((file): file is TFolder => file instanceof TFolder && file.path.length > 0)
			.map((folder) => folder.path)
			.sort((left, right) => left.localeCompare(right));
	}

	refreshProperties(): void {
		const properties = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter) continue;
			for (const property of Object.keys(frontmatter)) {
				if (property !== 'position') properties.add(property);
			}
		}
		this.properties = [...properties].sort((left, right) => left.localeCompare(right));
	}

	refreshTags(): void {
		const tags = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const metadata = this.app.metadataCache.getFileCache(file);
			for (const tag of getAllTags(metadata ?? {}) ?? []) {
				const normalized = tag.trim().replace(/^#+/, '');
				if (normalized) tags.add(`#${normalized}`);
			}
		}
		this.tags = [...tags].sort((left, right) => left.localeCompare(right));
	}

	refreshWikiLinks(): void {
		this.wikiLinks = this.app.vault.getMarkdownFiles()
			.map((file) => `[[${file.path.replace(/\.md$/i, '')}]]`)
			.sort((left, right) => left.localeCompare(right));
	}
}

export class CalendarInputSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private readonly input: HTMLInputElement,
		private readonly getValues: (query: string) => string[],
		private readonly applySelection: (value: string, inputValue: string, cursor: number) => string = (value) => value,
		private readonly commitSelection: CommitInputValue = () => undefined,
		private readonly getQuery: (inputValue: string, cursor: number) => string = (value) => value,
	) {
		super(app, input);
		this.limit = 50;
	}

	protected getSuggestions(query: string): string[] {
		return this.getValues(this.getQuery(query, this.input.selectionStart ?? query.length));
	}

	renderSuggestion(value: string, element: HTMLElement): void {
		element.setText(value);
	}

	selectSuggestion(value: string, _event: MouseEvent | KeyboardEvent): void {
		const selectedValue = this.applySelection(value, this.input.value, this.input.selectionStart ?? this.input.value.length);
		commitInputSuggestion(this.input, selectedValue, this.commitSelection);
		this.close();
	}
}

type SuggestInput = HTMLInputElement | HTMLTextAreaElement;

export class CalendarFloatingSuggest {
	private readonly suggestionsEl: HTMLDivElement;
	private readonly ownerWindow: Window;
	private lastCursor: number;
	private values: string[] = [];
	private selectedIndex = 0;
	private clearTimer: number | undefined;
	private readonly handleInput = (): void => {
		this.cancelClearTimer();
		this.captureCursor();
		this.render();
	};
	private readonly handleFocus = (): void => {
		this.cancelClearTimer();
		this.captureCursor();
		this.render();
	};
	private readonly handleSelection = (): void => this.captureCursor();
	private readonly handleBlur = (): void => {
		this.cancelClearTimer();
		this.clearTimer = this.ownerWindow.setTimeout(() => {
			this.clearTimer = undefined;
			this.clear();
		}, 120);
	};
	private readonly handlePositionChange = (): void => this.position();
	private readonly handleKeydown = (event: Event): void => {
		const keyboardEvent = event as KeyboardEvent;
		if (this.values.length === 0) return;
		if (keyboardEvent.key === 'Escape') {
			keyboardEvent.preventDefault();
			this.clear();
			return;
		}
		if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key === 'ArrowUp') {
			keyboardEvent.preventDefault();
			const direction = keyboardEvent.key === 'ArrowDown' ? 1 : -1;
			this.selectedIndex = (this.selectedIndex + direction + this.values.length) % this.values.length;
			this.updateSelectedItem();
			return;
		}
		if (keyboardEvent.key === 'Enter') {
			keyboardEvent.preventDefault();
			const value = this.values[this.selectedIndex];
			if (value) this.select(value);
		}
	};

	constructor(
		private readonly input: SuggestInput,
		private readonly getValues: (query: string) => string[],
		private readonly getQuery: (inputValue: string, cursor: number) => string,
		private readonly applySelection: (value: string, inputValue: string, cursor: number) => SuggestionReplacement,
		private readonly commitSelection: CommitInputValue,
	) {
		this.ownerWindow = input.ownerDocument.defaultView ?? window;
		this.lastCursor = input.selectionStart ?? input.value.length;
		this.suggestionsEl = input.ownerDocument.body.createDiv({ cls: 'calendar-note-settings-suggestions' });
		this.suggestionsEl.id = `calendar-note-suggestions-${Math.random().toString(36).slice(2, 10)}`;
		this.suggestionsEl.setAttribute('role', 'listbox');
		input.setAttribute('aria-autocomplete', 'list');
		input.setAttribute('aria-controls', this.suggestionsEl.id);
		input.setAttribute('aria-expanded', 'false');
		input.addEventListener('input', this.handleInput);
		input.addEventListener('focus', this.handleFocus);
		input.addEventListener('click', this.handleSelection);
		input.addEventListener('keyup', this.handleSelection);
		input.addEventListener('select', this.handleSelection);
		input.addEventListener('keydown', this.handleKeydown);
		input.addEventListener('blur', this.handleBlur);
		this.ownerWindow.addEventListener('resize', this.handlePositionChange);
		this.ownerWindow.visualViewport?.addEventListener('resize', this.handlePositionChange);
		this.ownerWindow.visualViewport?.addEventListener('scroll', this.handlePositionChange);
		input.ownerDocument.addEventListener('scroll', this.handlePositionChange, true);
	}

	dispose(): void {
		this.input.removeEventListener('input', this.handleInput);
		this.input.removeEventListener('focus', this.handleFocus);
		this.input.removeEventListener('click', this.handleSelection);
		this.input.removeEventListener('keyup', this.handleSelection);
		this.input.removeEventListener('select', this.handleSelection);
		this.input.removeEventListener('keydown', this.handleKeydown);
		this.input.removeEventListener('blur', this.handleBlur);
		this.ownerWindow.removeEventListener('resize', this.handlePositionChange);
		this.ownerWindow.visualViewport?.removeEventListener('resize', this.handlePositionChange);
		this.ownerWindow.visualViewport?.removeEventListener('scroll', this.handlePositionChange);
		this.input.ownerDocument.removeEventListener('scroll', this.handlePositionChange, true);
		this.input.removeAttribute('aria-autocomplete');
		this.input.removeAttribute('aria-controls');
		this.input.removeAttribute('aria-expanded');
		this.input.removeAttribute('aria-activedescendant');
		this.cancelClearTimer();
		this.suggestionsEl.remove();
	}

	private render(): void {
		this.clear();
		const query = this.getQuery(this.input.value, this.lastCursor);
		if (!query.trim()) return;
		this.values = this.getValues(query).slice(0, 8);
		for (const [index, value] of this.values.entries()) {
			const button = this.suggestionsEl.createEl('button');
			button.type = 'button';
			button.className = 'suggestion-item';
			button.id = `${this.suggestionsEl.id}-${index}`;
			button.setAttribute('role', 'option');
			button.setAttribute('aria-selected', String(index === this.selectedIndex));
			button.textContent = value;
			button.toggleClass('is-selected', index === this.selectedIndex);
			let selectedOnMouseDown = false;
			button.addEventListener('mousedown', (event) => {
				event.preventDefault();
				selectedOnMouseDown = true;
				this.select(value);
			});
			button.addEventListener('click', () => {
				if (!selectedOnMouseDown) this.select(value);
			});
		}
		this.input.setAttribute('aria-expanded', String(this.values.length > 0));
		if (this.values.length > 0) {
			this.updateSelectedItem();
			this.position();
		}
	}

	private clear(): void {
		this.values = [];
		this.selectedIndex = 0;
		this.suggestionsEl.replaceChildren();
		this.input.setAttribute('aria-expanded', 'false');
		this.input.removeAttribute('aria-activedescendant');
	}

	private captureCursor(): void {
		this.lastCursor = this.input.selectionStart ?? this.input.value.length;
	}

	private select(value: string): void {
		this.cancelClearTimer();
		const replacement = this.applySelection(value, this.input.value, this.lastCursor);
		commitInputSuggestion(this.input, replacement.value, this.commitSelection, replacement.cursor);
		this.lastCursor = replacement.cursor;
		this.input.focus();
		this.clear();
	}

	private cancelClearTimer(): void {
		if (this.clearTimer === undefined) return;
		this.ownerWindow.clearTimeout(this.clearTimer);
		this.clearTimer = undefined;
	}

	private updateSelectedItem(): void {
		for (const [index, element] of Array.from(this.suggestionsEl.children).entries()) {
			element.toggleClass('is-selected', index === this.selectedIndex);
			element.setAttribute('aria-selected', String(index === this.selectedIndex));
		}
		const selected = this.suggestionsEl.children[this.selectedIndex];
		if (selected) {
			this.input.setAttribute('aria-activedescendant', selected.id);
			selected.scrollIntoView({ block: 'nearest' });
		}
	}

	private position(): void {
		if (this.values.length === 0) return;
		const layout = getFloatingSuggestionLayout(
			this.input.getBoundingClientRect(),
			this.ownerWindow.visualViewport?.width ?? this.ownerWindow.innerWidth,
			this.ownerWindow.visualViewport?.height ?? this.ownerWindow.innerHeight,
		);
		this.suggestionsEl.style.left = `${layout.left}px`;
		this.suggestionsEl.style.width = `${layout.width}px`;
		this.suggestionsEl.style.maxHeight = `${layout.maxHeight}px`;
		this.suggestionsEl.style.top = layout.top === undefined ? '' : `${layout.top}px`;
		this.suggestionsEl.style.bottom = layout.bottom === undefined ? '' : `${layout.bottom}px`;
	}
}

function getIanaTimeZones(): string[] {
	const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
	if (supportedValuesOf) return supportedValuesOf('timeZone');
	return [
		'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Hong_Kong', 'Asia/Singapore',
		'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York',
		'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Australia/Sydney',
	];
}
