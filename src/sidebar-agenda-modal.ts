import { Menu, Modal, Notice, setIcon, setTooltip } from 'obsidian';
import { calendarText, type CalendarTextKey } from './calendar-locale';
import { formatCalendarDate } from './date';
import type CalendarNoteViewPlugin from './main';
import type { CalendarItem } from './models';
import { getSidebarAgendaDetails } from './sidebar-agenda';

export class SidebarAgendaModal extends Modal {
	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly date: string,
		private readonly items: readonly CalendarItem[],
		private readonly returnFocus?: HTMLElement,
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const date = this.dateLabel(this.date);
		this.setTitle(this.text('agendaTitle', { date, count: this.items.length }));
		this.modalEl.addClass('calendar-note-sidebar-agenda-modal');
		this.contentEl.addClass('calendar-note-sidebar-agenda');
		if (this.items.length === 0) {
			this.contentEl.createDiv({ cls: 'calendar-note-empty-state', text: this.text('noEvents') });
			return;
		}
		for (const item of this.items) this.renderEvent(item);
		window.setTimeout(() => this.contentEl.querySelector<HTMLElement>('button')?.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
		window.setTimeout(() => this.returnFocus?.isConnected && this.returnFocus.focus(), 0);
	}

	private renderEvent(item: CalendarItem): void {
		const row = this.contentEl.createDiv({ cls: 'calendar-note-sidebar-agenda-item' });
		const main = row.createEl('button', { cls: 'calendar-note-sidebar-agenda-main' });
		main.type = 'button';
		const range = item.startDate === item.endDate
			? this.dateLabel(item.startDate)
			: `${this.dateLabel(item.startDate)} – ${this.dateLabel(item.endDate)}`;
		main.createDiv({ cls: 'calendar-note-sidebar-agenda-meta', text: range });
		const details = getSidebarAgendaDetails(item);
		main.createDiv({ cls: 'calendar-note-sidebar-agenda-title', text: details.join(' · ') });
		setTooltip(main, [item.title, range, item.type].filter(Boolean).join('\n'));
		main.addEventListener('click', () => { void this.openEvent(item, false); });
		const more = row.createEl('button', { cls: 'clickable-icon calendar-note-sidebar-agenda-more' });
		more.type = 'button';
		more.setAttribute('aria-label', this.text('moreActions'));
		setIcon(more, 'more-horizontal');
		more.addEventListener('click', (event) => this.openMenu(item, event));
	}

	private openMenu(item: CalendarItem, event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((entry) => entry.setTitle(this.text('openNote')).setIcon('file-text').onClick(() => this.openEvent(item, false)));
		menu.addItem((entry) => entry.setTitle(this.text('openInNewTab')).setIcon('file-plus').onClick(() => this.openEvent(item, true)));
		menu.addItem((entry) => entry.setTitle(this.text('copyObsidianLink')).setIcon('copy').onClick(() => this.copyLink(item)));
		menu.showAtMouseEvent(event);
	}

	private async openEvent(item: CalendarItem, newTab: boolean): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.filePath);
		if (!file) return;
		await this.plugin.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
		this.close();
	}

	private async copyLink(item: CalendarItem): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.filePath);
		if (!file) return;
		await navigator.clipboard.writeText(this.plugin.app.fileManager.generateMarkdownLink(file, ''));
		new Notice(this.text('copiedObsidianLink'));
	}

	private dateLabel(date: string): string {
		return formatCalendarDate(date, this.plugin.settings.displayDateFormat) ?? date;
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}
