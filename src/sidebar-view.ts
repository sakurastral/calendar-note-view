import {
	ItemView,
	Menu,
	moment,
	Notice,
	setIcon,
	type WorkspaceLeaf,
} from 'obsidian';
import { buildCalendarMonthGrid, moveCalendarMonth } from './calendar-grid';
import { CreateEventModal } from './create-event-modal';
import { formatCalendarDate, getCalendarDateParts, getTodayCanonical } from './date';
import type { CalendarItem } from './models';
import { getSidebarIndicatorPresentation } from './sidebar-indicator';
import { CalendarStyleResolver } from './style-resolver';
import type CalendarNoteViewPlugin from './main';

export const CALENDAR_SIDEBAR_VIEW_TYPE = 'calendar-note-sidebar';

export class CalendarSidebarView extends ItemView {
	private year: number;
	private month: number;
	private unsubscribe?: () => void;
	private refreshing = false;
	private longPressTimer?: number;
	private suppressNextClick = false;
	private readonly styleResolver = new CalendarStyleResolver();

	constructor(leaf: WorkspaceLeaf, private readonly plugin: CalendarNoteViewPlugin) {
		super(leaf);
		const today = getCalendarDateParts(getTodayCanonical(plugin.settings.timeZone));
		this.year = today.year;
		this.month = today.month;
	}

	getViewType(): string {
		return CALENDAR_SIDEBAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Calendar note view';
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.index.subscribe(() => this.renderCalendar());
		this.renderCalendar();
		await Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
		if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
		await Promise.resolve();
	}

	renderCalendar(): void {
		this.contentEl.empty();
		this.contentEl.addClass('calendar-note-sidebar');
		const header = this.contentEl.createDiv({ cls: 'calendar-note-sidebar-header' });
		this.addHeaderButton(header, 'chevron-left', 'Previous month', () => this.moveMonth(-1));
		this.renderPicker(header);
		this.addHeaderButton(header, 'calendar-check', 'Today', () => this.goToToday());
		this.addHeaderButton(header, 'chevron-right', 'Next month', () => this.moveMonth(1));
		const refresh = this.addHeaderButton(header, 'refresh-cw', 'Refresh calendar', () => { void this.refresh(refresh); });
		refresh.disabled = this.refreshing;
		refresh.toggleClass('is-loading', this.refreshing);

		const settings = this.plugin.settings;
		const grid = buildCalendarMonthGrid(this.year, this.month, settings.firstDayOfWeek, settings.weekendDays);
		const today = getTodayCanonical(settings.timeZone);
		const dailyNotes = this.plugin.dailyNotes.getAll();
		const calendar = this.contentEl.createDiv({ cls: 'calendar-note-month-grid' });
		for (const weekday of grid.weekdays) {
			calendar.createDiv({ cls: 'calendar-note-weekday', text: moment.weekdaysMin()[weekday] ?? '' });
		}
		for (const cell of grid.cells) {
			const wrapper = calendar.createDiv({ cls: 'calendar-note-date-cell' });
			wrapper.toggleClass('is-adjacent-month', !cell.inCurrentMonth);
			wrapper.toggleClass('is-weekend', cell.isWeekend);
			wrapper.toggleClass('is-today', cell.date === today);
			wrapper.dataset.date = cell.date;
			const button = wrapper.createEl('button', {
				cls: 'calendar-note-date-button',
				attr: { 'aria-label': this.dateLabel(cell.date) },
			});
			button.createSpan({ cls: 'calendar-note-date-number', text: String(cell.day) });
			const add = button.createSpan({ cls: 'calendar-note-date-add', attr: { 'aria-label': `Create event on ${cell.date}` } });
			setIcon(add, 'plus');
			if (this.plugin.dailyNotes.find(cell.date, dailyNotes)) {
				button.createSpan({ cls: 'calendar-note-daily-indicator', attr: { title: 'Daily note exists' } });
			}
			const items = this.plugin.index.getItemsForDate(cell.date);
			this.renderIndicators(button, items);
			button.addEventListener('click', (event) => {
				if (this.suppressNextClick) {
					this.suppressNextClick = false;
					return;
				}
				if ((event.target as HTMLElement).closest('.calendar-note-date-add')) {
					new CreateEventModal(this.plugin, this.plugin.eventCreation, cell.date).open();
					return;
				}
				if (!(event.target as HTMLElement).closest('.calendar-note-indicator')) void this.plugin.dailyNotes.open(cell.date);
			});
			button.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				this.showDateMenu(cell.date, items, event);
			});
			this.bindLongPress(button, cell.date, items);
		}
	}

	private renderPicker(container: HTMLElement): void {
		const picker = container.createDiv({ cls: 'calendar-note-month-picker' });
		const year = picker.createEl('input', {
			cls: 'calendar-note-year-input',
			attr: { type: 'number', min: '1', max: '9999', 'aria-label': 'Calendar year' },
		});
		year.value = String(this.year);
		year.addEventListener('change', () => {
			const value = Number(year.value);
			if (Number.isInteger(value) && value >= 1 && value <= 9999) {
				this.year = value;
				this.renderCalendar();
			}
		});
		const month = picker.createEl('select', { cls: 'calendar-note-month-select', attr: { 'aria-label': 'Calendar month' } });
		for (let value = 1; value <= 12; value += 1) {
			const option = month.createEl('option', { text: moment.monthsShort()[value - 1] ?? String(value) });
			option.value = String(value);
		}
		month.value = String(this.month);
		month.addEventListener('change', () => {
			this.month = Number(month.value);
			this.renderCalendar();
		});
	}

	private renderIndicators(container: HTMLElement, items: CalendarItem[]): void {
		const indicators = container.createDiv({ cls: 'calendar-note-indicators' });
		const maximum = this.plugin.settings.maxIndicatorsPerDay;
		for (const item of items.slice(0, maximum)) {
			const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === item.sourceProfileId);
			if (!profile) continue;
			const resolution = this.styleResolver.resolve(item, profile, this.plugin.settings.typeStyleRules);
			this.plugin.diagnostics.replaceStyleForFileAndProfile(item.filePath, profile.id, resolution.diagnostics);
			const resolved = resolution.style;
			const presentation = getSidebarIndicatorPresentation(profile, resolved.icon);
			const indicator = indicators.createSpan({
				cls: `calendar-note-indicator ${presentation.className}`,
				attr: { title: item.title, 'aria-label': item.title },
			});
			indicator.style.setProperty('--calendar-note-item-bg', resolved.backgroundColor);
			indicator.style.setProperty('--calendar-note-item-text', resolved.textColor);
			if (presentation.icon) setIcon(indicator, presentation.icon);
			indicator.addEventListener('click', (event) => {
				event.stopPropagation();
				void this.openEvent(item, false);
			});
			indicator.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.showEventMenu(item, event);
			});
		}
		if (items.length > maximum) indicators.createSpan({ cls: 'calendar-note-overflow', text: `+${items.length - maximum}` });
	}

	private addHeaderButton(container: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-nav-button', attr: { 'aria-label': label } });
		setIcon(button, icon);
		button.addEventListener('click', action);
		return button;
	}

	private moveMonth(amount: number): void {
		const next = moveCalendarMonth(this.year, this.month, amount);
		this.year = next.year;
		this.month = next.month;
		this.renderCalendar();
	}

	private goToToday(): void {
		const today = getCalendarDateParts(getTodayCanonical(this.plugin.settings.timeZone));
		this.year = today.year;
		this.month = today.month;
		this.renderCalendar();
	}

	private async refresh(button: HTMLButtonElement): Promise<void> {
		if (this.refreshing) return;
		this.refreshing = true;
		button.disabled = true;
		button.addClass('is-loading');
		try {
			await this.plugin.index.refresh();
		} catch {
			new Notice('Could not refresh the calendar index.');
		} finally {
			this.refreshing = false;
			this.renderCalendar();
		}
	}

	private showDateMenu(date: string, items: CalendarItem[], event: MouseEvent | PointerEvent): void {
		const menu = new Menu();
		const existing = this.plugin.dailyNotes.find(date);
		menu.addItem((item) => item
			.setTitle('Open daily note')
			.setIcon('calendar-check')
			.setDisabled(!existing)
			.onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item
			.setTitle('Create daily note')
			.setIcon('calendar-plus')
			.setDisabled(Boolean(existing))
			.onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item.setTitle('Create event').setIcon('calendar-plus').onClick(() => {
			new CreateEventModal(this.plugin, this.plugin.eventCreation, date).open();
		}));
		menu.addSeparator();
		menu.addItem((item) => item.setTitle('Events on this date').setIsLabel(true));
		if (items.length === 0) menu.addItem((item) => item.setTitle('No events').setDisabled(true));
		for (const calendarItem of items) {
			menu.addItem((item) => item
				.setTitle(calendarItem.title)
				.setIcon(calendarItem.icon ?? 'calendar')
				.onClick(() => this.openEvent(calendarItem, false)));
		}
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	}

	private showEventMenu(item: CalendarItem, event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((menuItem) => menuItem.setTitle('Open note').setIcon('file-text').onClick(() => this.openEvent(item, false)));
		menu.addItem((menuItem) => menuItem.setTitle('Open in new tab').setIcon('file-plus').onClick(() => this.openEvent(item, true)));
		menu.addItem((menuItem) => menuItem.setTitle('Copy Obsidian link').setIcon('copy').onClick(() => this.copyEventLink(item)));
		this.plugin.app.workspace.handleLinkContextMenu(menu, item.filePath, '');
		menu.showAtMouseEvent(event);
	}

	private async openEvent(item: CalendarItem, newTab: boolean): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.filePath);
		if (file) await this.plugin.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
	}

	private async copyEventLink(item: CalendarItem): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.filePath);
		if (!file) return;
		const link = this.plugin.app.fileManager.generateMarkdownLink(file, '');
		await navigator.clipboard.writeText(link);
		new Notice('Copied Obsidian link.');
	}

	private bindLongPress(button: HTMLButtonElement, date: string, items: CalendarItem[]): void {
		button.addEventListener('pointerdown', (event) => {
			if (event.pointerType === 'mouse') return;
			if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
			this.longPressTimer = window.setTimeout(() => {
				this.suppressNextClick = true;
				this.showDateMenu(date, items, event);
			}, 550);
		});
		for (const eventName of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
			button.addEventListener(eventName, () => {
				if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
				this.longPressTimer = undefined;
			});
		}
	}

	private dateLabel(date: string): string {
		return formatCalendarDate(date, this.plugin.settings.displayDateFormat) ?? date;
	}
}
