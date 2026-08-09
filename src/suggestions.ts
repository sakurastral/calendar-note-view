import { AbstractInputSuggest, type App, type EventRef, TFolder } from 'obsidian';
import { rankSuggestions } from './suggestion-ranking';

export class CalendarSuggestionProvider {
	private folders: string[] = [];
	private properties: string[] = [];
	private wikiLinks: string[] = [];
	private refs: Array<{ owner: 'vault' | 'metadata'; ref: EventRef }> = [];

	constructor(private readonly app: App) {}

	initialize(): void {
		this.refreshFolders();
		this.refreshProperties();
		this.refreshWikiLinks();
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
		input: HTMLInputElement,
		private readonly getValues: (query: string) => string[],
		private readonly applySelection: (value: string, inputValue: string) => string = (value) => value,
	) {
		super(app, input);
		this.limit = 50;
	}

	protected getSuggestions(query: string): string[] {
		return this.getValues(query);
	}

	renderSuggestion(value: string, element: HTMLElement): void {
		element.setText(value);
	}

	selectSuggestion(value: string): void {
		this.setValue(this.applySelection(value, this.getValue()));
		this.close();
	}
}
