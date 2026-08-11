import { Modal, Notice, RenderContext, setIcon, type App } from 'obsidian';
import type { BasesNormalizationIssue, BasesPropertyDetail } from './bases-normalizer';
import type { CalendarTextKey } from './calendar-locale';
import type { CalendarItem } from './models';

export interface BasesAgendaItem {
	item: CalendarItem;
	details: readonly BasesPropertyDetail[];
}

export interface BasesInvalidEntry {
	filePath: string;
	issue: BasesNormalizationIssue;
}

type Text = (key: CalendarTextKey, values?: Record<string, string | number>) => string;

export class BasesAgendaModal extends Modal {
	constructor(
		app: App,
		private readonly dateLabel: string,
		private readonly items: readonly BasesAgendaItem[],
		private readonly formatRange: (item: CalendarItem) => string,
		private readonly text: Text,
		private readonly openEvent: (item: CalendarItem, newTab: boolean) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.text('agendaTitle', { date: this.dateLabel, count: this.items.length }));
		this.modalEl.addClass('calendar-note-bases-agenda-modal');
		if (this.items.length === 0) {
			this.contentEl.createDiv({ cls: 'calendar-note-empty-state', text: this.text('noEvents') });
			return;
		}
		const list = this.contentEl.createDiv({ cls: 'calendar-note-bases-agenda-list' });
		for (const agendaItem of this.items) this.renderItem(list, agendaItem);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderItem(container: HTMLElement, agendaItem: BasesAgendaItem): void {
		const { item, details } = agendaItem;
		const card = container.createDiv({ cls: 'calendar-note-bases-agenda-item' });
		const heading = card.createEl('button', {
			cls: 'calendar-note-bases-agenda-open',
			attr: { 'aria-label': `${item.title}, ${this.formatRange(item)}` },
		});
		heading.createSpan({ cls: 'calendar-note-bases-agenda-title', text: item.title });
		heading.createSpan({ cls: 'calendar-note-bases-agenda-range', text: this.formatRange(item) });
		heading.addEventListener('click', () => { void this.openEvent(item, false); });
		if (item.type) this.addPlainDetail(card, this.text('eventTypeLabel'), item.type);
		for (const detail of details) this.addRenderedDetail(card, detail);
		const actions = card.createDiv({ cls: 'calendar-note-bases-agenda-actions' });
		this.addAction(actions, 'file-text', this.text('openNote'), () => { void this.openEvent(item, false); });
		this.addAction(actions, 'file-plus', this.text('openInNewTab'), () => { void this.openEvent(item, true); });
	}

	private addPlainDetail(container: HTMLElement, label: string, value: string): void {
		const row = container.createDiv({ cls: 'calendar-note-bases-agenda-detail' });
		row.createSpan({ cls: 'calendar-note-bases-agenda-label', text: label });
		row.createSpan({ text: value });
	}

	private addRenderedDetail(container: HTMLElement, detail: BasesPropertyDetail): void {
		const row = container.createDiv({ cls: 'calendar-note-bases-agenda-detail' });
		row.createSpan({ cls: 'calendar-note-bases-agenda-label', text: detail.displayName });
		const valueEl = row.createSpan({ cls: 'calendar-note-bases-agenda-value' });
		try {
			detail.value.renderTo(valueEl, new RenderContext());
		} catch {
			valueEl.setText(detail.text);
		}
	}

	private addAction(container: HTMLElement, icon: string, label: string, action: () => void): void {
		const button = container.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': label } });
		setIcon(button, icon);
		button.addEventListener('click', action);
	}
}

export class BasesInvalidEntriesModal extends Modal {
	constructor(
		app: App,
		private readonly entries: readonly BasesInvalidEntry[],
		private readonly text: Text,
		private readonly openPath: (path: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.text('viewSkippedEntries'));
		this.modalEl.addClass('calendar-note-bases-invalid-modal');
		const list = this.contentEl.createEl('ul', { cls: 'calendar-note-bases-invalid-list' });
		for (const entry of this.entries) {
			const row = list.createEl('li');
			if (entry.filePath) {
				const button = row.createEl('button', { cls: 'calendar-note-bases-invalid-file', text: entry.filePath });
				button.addEventListener('click', () => { void this.openPath(entry.filePath); });
			}
			row.createSpan({ cls: 'calendar-note-bases-invalid-reason', text: this.text(issueKey(entry.issue)) });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export async function copyObsidianLink(item: CalendarItem, text: Text): Promise<void> {
	const target = item.filePath.replace(/\.md$/i, '');
	await navigator.clipboard.writeText(`[[${target}]]`);
	new Notice(text('copiedObsidianLink'));
}

function issueKey(issue: BasesNormalizationIssue): CalendarTextKey {
	if (issue === 'invalid-start') return 'invalidStart';
	if (issue === 'invalid-end') return 'invalidEnd';
	if (issue === 'end-before-start') return 'endBeforeStart';
	return 'unreadableValue';
}
