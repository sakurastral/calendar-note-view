import { Modal, Setting, setIcon, type TFile } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import { parseCalendarPropertyDate } from './date';
import type CalendarNoteViewPlugin from './main';
import type { CalendarDiagnostic, CalendarItem, CalendarMetadata, CalendarSourceProfile, ResolvedCalendarItemStyleSources } from './models';
import { CalendarItemNormalizer } from './normalizer';
import type { CalendarSourceMatchEvaluation } from './matcher';
import { CalendarStyleResolver } from './style-resolver';
import { CalendarInputSuggest } from './suggestions';
import { normalizeWikiLinkTarget } from './value-normalizers';

export interface SourceProfileInspectionResult {
	filePath: string;
	match: CalendarSourceMatchEvaluation;
	startParses: boolean;
	endParses: boolean | null;
	item?: CalendarItem;
	matchingRule?: string;
	styleSources?: ResolvedCalendarItemStyleSources;
	diagnostics: CalendarDiagnostic[];
}

export function inspectSourceProfileFile(
	plugin: CalendarNoteViewPlugin,
	profile: CalendarSourceProfile,
	file: TFile,
): SourceProfileInspectionResult {
	const metadata = plugin.app.metadataCache.getFileCache(file);
	const calendarMetadata: CalendarMetadata | null = metadata ? {
		frontmatter: toUnknownRecord(metadata.frontmatter),
		tags: metadata.tags,
	} : null;
	const match = plugin.sourceMatcher.evaluate({ path: file.path, basename: file.basename, extension: file.extension }, calendarMetadata, profile);
	const frontmatter = calendarMetadata?.frontmatter ?? {};
	const startParses = Boolean(profile.startProperty.trim() && parseCalendarPropertyDate(
		frontmatter[profile.startProperty], plugin.settings.eventPropertyDateFormat,
	));
	const endValue = profile.endProperty?.trim() ? frontmatter[profile.endProperty] : undefined;
	const endParses = profile.endProperty?.trim() && endValue !== undefined
		? Boolean(parseCalendarPropertyDate(endValue, plugin.settings.eventPropertyDateFormat))
		: null;
	const normalizer = new CalendarItemNormalizer();
	const normalized = calendarMetadata?.frontmatter
		? normalizer.normalize({ path: file.path, basename: file.basename, extension: file.extension }, calendarMetadata, profile, plugin.settings.eventPropertyDateFormat)
		: { diagnostics: [] as CalendarDiagnostic[] };
	const item = normalized.item;
	const rule = item ? plugin.settings.typeStyleRules.find((candidate) => candidate.enabled &&
		normalizeWikiLinkTarget(candidate.typeValue) === normalizeWikiLinkTarget(item.type)) : undefined;
	const resolution = item ? new CalendarStyleResolver().resolve(item, profile, plugin.settings.typeStyleRules) : undefined;
	return {
		filePath: file.path,
		match,
		startParses,
		endParses,
		item,
		matchingRule: rule?.typeValue,
		styleSources: resolution?.sources,
		diagnostics: [...normalized.diagnostics, ...(resolution?.diagnostics ?? [])],
	};
}

export class ProfileMatchingInspectorModal extends Modal {
	private selectedPath = '';
	private resultEl?: HTMLElement;
	private suggest?: CalendarInputSuggest;

	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly profile: CalendarSourceProfile,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.setTitle(this.text('matchingInspector'));
		this.modalEl.addClass('calendar-note-inspector-modal');
		this.contentEl.createEl('p', { text: this.profile.name });
		new Setting(this.contentEl)
			.setName(this.text('chooseNote'))
			.addSearch((search) => {
				search.setPlaceholder('Events/Example.md').onChange((value) => { this.selectedPath = value.trim(); });
				this.suggest = new CalendarInputSuggest(
					this.app,
					search.inputEl,
					(query) => this.plugin.suggestions.getMarkdownFileSuggestions(query),
					undefined,
					(value) => { this.selectedPath = value; },
				);
				window.setTimeout(() => search.inputEl.focus(), 0);
			})
			.addButton((button) => button.setButtonText(this.text('testNote')).setCta().onClick(() => this.run()));
		this.resultEl = this.contentEl.createDiv({ cls: 'calendar-note-inspector-results' });
	}

	onClose(): void {
		this.suggest?.close();
		this.suggest = undefined;
		this.contentEl.empty();
	}

	private run(): void {
		if (!this.resultEl) return;
		this.resultEl.empty();
		const normalizedPath = this.selectedPath.toLowerCase().endsWith('.md') ? this.selectedPath : `${this.selectedPath}.md`;
		const file = this.app.vault.getFileByPath(normalizedPath);
		if (!file) {
			this.resultEl.createDiv({ cls: 'calendar-note-validation-row is-error', text: this.text('fileNotFound') });
			return;
		}
		const result = inspectSourceProfileFile(this.plugin, this.profile, file);
		if (!this.profile.enabled) this.resultEl.createDiv({ cls: 'calendar-note-inspector-note', text: this.text('disabledAssumption') });
		this.renderCheck(this.text('profileEnabled'), result.match.enabled);
		this.renderCheck(this.text('markdownFile'), result.match.markdown);
		this.renderCheck(this.text('frontmatterExists'), result.match.frontmatterExists);
		this.renderCheck(this.text('startConfigured'), result.match.startPropertyConfigured);
		this.renderCheck(this.text('containsStart'), result.match.containsStartProperty);
		this.renderCheck(this.text('startParse'), result.startParses);
		this.renderCheck(this.text('endParse'), result.endParses);
		this.renderCheck(this.text('folderGroup'), groupValue(result.match.folder));
		this.renderCheck(this.text('tagGroup'), groupValue(result.match.tag));
		this.renderCheck(this.text('wikiLinkGroup'), groupValue(result.match.wikiLink));
		this.renderCheck(this.text('startOnlyActive'), result.match.startOnlyActive);
		this.renderCheck(`${this.text('finalMatch')} (${result.match.matchMode})`, result.match.matchesIfEnabled);
		if (result.item) {
			this.renderValue(this.text('normalizedEvent'), `${result.item.title} · ${result.item.startDate} – ${result.item.endDate} · ${result.item.type ?? '—'}`);
		}
		this.renderValue(this.text('matchedTypeRule'), result.matchingRule ?? this.text('none'));
		if (result.styleSources) {
			this.renderValue(this.text('styleSources'), `Icon: ${result.styleSources.icon} · Background: ${result.styleSources.backgroundColor} · Text: ${result.styleSources.textColor}`);
		}
		this.renderValue(this.text('diagnosticsLabel'), result.diagnostics.length > 0
			? result.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`).join('\n')
			: this.text('none'));
	}

	private renderCheck(label: string, value: boolean | null): void {
		if (!this.resultEl) return;
		const row = this.resultEl.createDiv({ cls: 'calendar-note-inspector-row' });
		const icon = row.createSpan({ cls: 'calendar-note-inspector-icon' });
		setIcon(icon, value === null ? 'minus' : value ? 'check' : 'x');
		row.toggleClass('is-pass', value === true);
		row.toggleClass('is-fail', value === false);
		row.createSpan({ cls: 'calendar-note-inspector-label', text: label });
		row.createSpan({ text: value === null ? this.text('notApplicable') : value ? this.text('pass') : this.text('fail') });
	}

	private renderValue(label: string, value: string): void {
		if (!this.resultEl) return;
		const row = this.resultEl.createDiv({ cls: 'calendar-note-inspector-value' });
		row.createDiv({ cls: 'calendar-note-inspector-label', text: label });
		row.createEl('pre', { text: value });
	}

	private text(key: CalendarTextKey): string {
		return calendarText(this.plugin.settings.calendarLocale, key);
	}
}

function groupValue(group: { configured: boolean; matched: boolean }): boolean | null {
	return group.configured ? group.matched : null;
}

function toUnknownRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}
