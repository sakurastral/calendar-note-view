import { AbstractInputSuggest, type App, type EventRef, getIconIds, TFolder } from 'obsidian';
import { commitInputSuggestion, type CommitInputValue } from './input-events';
import { rankSuggestions } from './suggestion-ranking';

export class CalendarSuggestionProvider {
	private folders: string[] = [];
	private properties: string[] = [];
	private wikiLinks: string[] = [];
	private icons: string[] = [];
	private refs: Array<{ owner: 'vault' | 'metadata'; ref: EventRef }> = [];

	constructor(private readonly app: App) {}

	initialize(): void {
		this.refreshFolders();
		this.refreshProperties();
		this.refreshWikiLinks();
		this.icons = getIconIds().sort((left, right) => left.localeCompare(right));
		this.refs.push(
			{ owner: 'vault', ref: this.app.vault.on('create', () => this.refreshVaultSuggestions()) },
			{ owner: 'vault', ref: this.app.vault.on('delete', () => this.refreshVaultSuggestions()) },
			{ owner: 'vault', ref: this.app.vault.on('rename', () => this.refreshVaultSuggestions()) },
			{ owner: 'metadata', ref: this.app.metadataCache.on('changed', () => this.refreshProperties()) },
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

	getWikiLinkSuggestions(query: string): string[] {
		const normalized = query.replace(/^\[\[/, '').replace(/\]\]$/, '').trim();
		return rankSuggestions(normalized, this.wikiLinks);
	}

	getIconSuggestions(query: string): string[] {
		return rankSuggestions(query, this.icons);
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

export class CalendarTextAreaSuggest {
	private readonly suggestionsEl: HTMLDivElement;
	private readonly handleInput = (): void => this.render();
	private readonly handleBlur = (): void => {
		window.setTimeout(() => this.clear(), 120);
	};

	constructor(
		private readonly input: HTMLTextAreaElement,
		container: HTMLElement,
		private readonly getValues: (query: string) => string[],
		private readonly commitSelection: CommitInputValue,
	) {
		this.suggestionsEl = input.ownerDocument.createElement('div');
		this.suggestionsEl.className = 'calendar-note-settings-suggestions';
		container.append(this.suggestionsEl);
		input.addEventListener('input', this.handleInput);
		input.addEventListener('blur', this.handleBlur);
	}

	dispose(): void {
		this.input.removeEventListener('input', this.handleInput);
		this.input.removeEventListener('blur', this.handleBlur);
		this.suggestionsEl.remove();
	}

	private render(): void {
		this.clear();
		const cursor = this.input.selectionStart ?? this.input.value.length;
		const query = getLineQuery(this.input.value, cursor);
		if (!query.trim()) return;
		for (const value of this.getValues(query).slice(0, 8)) {
			const button = this.input.ownerDocument.createElement('button');
			button.type = 'button';
			button.className = 'suggestion-item';
			button.textContent = value;
			button.addEventListener('mousedown', (event) => event.preventDefault());
			button.addEventListener('click', () => {
				const next = replaceLineValue(this.input.value, value, cursor);
				this.input.value = next;
				void this.commitSelection(next);
				this.clear();
			});
			this.suggestionsEl.append(button);
		}
	}

	private clear(): void {
		this.suggestionsEl.replaceChildren();
	}
}

function getLineQuery(inputValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf('\n', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return inputValue.slice(start, end).trim();
}

function replaceLineValue(inputValue: string, selectedValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf('\n', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return `${inputValue.slice(0, start)}${selectedValue}${inputValue.slice(end)}`;
}
