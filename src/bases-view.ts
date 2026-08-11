import {
	BasesView,
	Menu,
	setIcon,
	type BasesPropertyId,
	type QueryController,
} from 'obsidian';
export { getBasesCalendarOptions } from './bases-options';
import { BasesCalendarNormalizer, basesPropertiesToDisplayText, type BasesCalendarPropertyMap } from './bases-normalizer';
import { buildCalendarMonthGrid, moveCalendarMonth } from './calendar-grid';
import { calendarMonthLabels, calendarText, calendarWeekdayLabels, type CalendarTextKey } from './calendar-locale';
import { sortCalendarItems } from './calendar-sort';
import { CreateEventModal } from './create-event-modal';
import {
	compareCalendarDates,
	formatCalendarDate,
	getCalendarDateParts,
	getTodayCanonical,
} from './date';
import type CalendarNoteViewPlugin from './main';
import type { CalendarItem, CalendarSourceProfile } from './models';
import { allocateCalendarLanes, segmentCalendarItems, type CalendarRangeSegment } from './range-layout';
import { CalendarStyleResolver } from './style-resolver';

export const CALENDAR_BASES_VIEW_TYPE = 'calendar-note-month';

type EventDisplayMode = 'icon' | 'title' | 'icon-title' | 'properties';

interface BasesCalendarViewOptions {
	properties?: BasesCalendarPropertyMap;
	firstDayOfWeek: number;
	weekendDays: number[];
	showAdjacentMonthDates: boolean;
	maximumVisibleEvents: number;
	eventDisplayMode: EventDisplayMode;
	visibleProperties: BasesPropertyId[];
}

const BASES_STYLE_PROFILE: CalendarSourceProfile = {
	id: 'bases-calendar',
	name: 'Bases calendar',
	order: 1,
	enabled: true,
	sidebarIndicatorMode: 'dots',
	matchMode: 'all',
	folders: [],
	tags: [],
	wikiLinkTargets: [],
	startProperty: '',
	allowCreate: false,
	defaultIcon: 'calendar',
};

export class CalendarBasesView extends BasesView {
	readonly type = CALENDAR_BASES_VIEW_TYPE;
	private readonly normalizer = new BasesCalendarNormalizer();
	private readonly styleResolver = new CalendarStyleResolver();
	private readonly containerEl: HTMLElement;
	private readonly propertyContentByItemId = new Map<string, string>();
	private year: number;
	private month: number;

	constructor(
		controller: QueryController,
		parentEl: HTMLElement,
		private readonly plugin: CalendarNoteViewPlugin,
	) {
		super(controller);
		this.containerEl = parentEl.createDiv({ cls: 'calendar-note-bases' });
		const today = getCalendarDateParts(getTodayCanonical(plugin.settings.timeZone));
		this.year = today.year;
		this.month = today.month;
	}

	onDataUpdated(): void {
		this.renderCalendar();
	}

	private renderCalendar(): void {
		this.containerEl.empty();
		this.plugin.diagnostics.removeStyleForProfile(BASES_STYLE_PROFILE.id);
		const options = this.readOptions();
		this.renderHeader();
		if (!options.properties) {
			this.containerEl.createDiv({ cls: 'calendar-note-empty-state', text: this.text('chooseStartProperty') });
			return;
		}

		const grid = buildCalendarMonthGrid(this.year, this.month, options.firstDayOfWeek, options.weekendDays);
		const visibleCells = options.showAdjacentMonthDates ? grid.cells : grid.cells.filter((cell) => cell.inCurrentMonth);
		const rangeStart = visibleCells[0]?.date;
		const rangeEnd = visibleCells[visibleCells.length - 1]?.date;
		if (!rangeStart || !rangeEnd) return;
		const items = this.getItems(options).filter((item) =>
			compareCalendarDates(item.startDate, rangeEnd) <= 0 && compareCalendarDates(item.endDate, rangeStart) >= 0);
		const segments = segmentCalendarItems(
			items,
			grid.cells[0]?.date ?? rangeStart,
			grid.cells[grid.cells.length - 1]?.date ?? rangeEnd,
			rangeStart,
			rangeEnd,
		);
		const weekLayouts = new Map(allocateCalendarLanes(segments).map((layout) => [layout.weekIndex, layout]));
		const today = getTodayCanonical(this.plugin.settings.timeZone);
		const dailyNotes = this.plugin.dailyNotes.getAll();

		const weekdayHeader = this.containerEl.createDiv({ cls: 'calendar-note-bases-weekdays' });
		const weekdayLabels = calendarWeekdayLabels(this.plugin.settings.calendarLocale);
		for (const weekday of grid.weekdays) {
			weekdayHeader.createDiv({ cls: 'calendar-note-bases-weekday', text: weekdayLabels[weekday] ?? '' });
		}
		const monthGrid = this.containerEl.createDiv({ cls: 'calendar-note-bases-month' });
		for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
			const weekCells = grid.cells.slice(weekIndex * 7, weekIndex * 7 + 7);
			const layout = weekLayouts.get(weekIndex);
			const week = monthGrid.createDiv({ cls: 'calendar-note-bases-week' });
			week.style.setProperty('--calendar-note-week-lanes', String(Math.min(options.maximumVisibleEvents, layout?.laneCount ?? 0)));
			const dates = week.createDiv({ cls: 'calendar-note-bases-dates' });
			for (const cell of weekCells) {
				const hiddenAdjacent = !options.showAdjacentMonthDates && !cell.inCurrentMonth;
				const dateCell = dates.createDiv({ cls: 'calendar-note-bases-date-cell' });
				dateCell.toggleClass('is-adjacent-month', !cell.inCurrentMonth);
				dateCell.toggleClass('is-hidden-adjacent', hiddenAdjacent);
				dateCell.toggleClass('is-weekend', cell.isWeekend);
				dateCell.toggleClass('is-today', cell.date === today);
				dateCell.dataset.date = cell.date;
				if (hiddenAdjacent) continue;
				const dateButton = dateCell.createEl('button', {
					cls: 'calendar-note-bases-date-number',
					text: String(cell.day),
					attr: { 'aria-label': this.dateLabel(cell.date) },
				});
				dateButton.addEventListener('click', () => { void this.plugin.dailyNotes.open(cell.date); });
				if (this.plugin.dailyNotes.find(cell.date, dailyNotes)) {
					dateCell.createSpan({ cls: 'calendar-note-bases-daily-indicator', attr: { title: this.text('dailyNoteExists') } });
				}
				const addButton = dateCell.createEl('button', {
					cls: 'clickable-icon calendar-note-bases-add',
					attr: { 'aria-label': this.text('createEventOn', { date: this.dateLabel(cell.date) }) },
				});
				setIcon(addButton, 'plus');
				addButton.addEventListener('click', () => new CreateEventModal(this.plugin, this.plugin.eventCreation, cell.date).open());
				dateCell.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					this.showDateMenu(cell.date, this.itemsForDate(items, cell.date), event);
				});
			}
			this.renderWeekEvents(week, layout?.segments ?? [], weekCells.map((cell) => cell.date), items, options);
		}
	}

	private renderHeader(): void {
		const header = this.containerEl.createDiv({ cls: 'calendar-note-bases-header' });
		this.addHeaderButton(header, 'chevron-left', this.text('previousMonth'), () => this.moveMonth(-1));
		const picker = header.createDiv({ cls: 'calendar-note-bases-picker' });
		const year = picker.createEl('input', {
			cls: 'calendar-note-bases-year',
			attr: { type: 'number', min: '1', max: '9999', 'aria-label': this.text('calendarYear') },
		});
		year.value = String(this.year);
		year.addEventListener('change', () => {
			const value = Number(year.value);
			if (Number.isInteger(value) && value >= 1 && value <= 9999) {
				this.year = value;
				this.renderCalendar();
			}
		});
		const month = picker.createEl('select', { cls: 'calendar-note-bases-month-select', attr: { 'aria-label': this.text('calendarMonth') } });
		const monthLabels = calendarMonthLabels(this.plugin.settings.calendarLocale);
		for (let value = 1; value <= 12; value += 1) {
			const option = month.createEl('option', { text: monthLabels[value - 1] ?? String(value) });
			option.value = String(value);
		}
		month.value = String(this.month);
		month.addEventListener('change', () => {
			this.month = Number(month.value);
			this.renderCalendar();
		});
		this.addHeaderButton(header, 'calendar-check', this.text('today'), () => this.goToToday());
		this.addHeaderButton(header, 'chevron-right', this.text('nextMonth'), () => this.moveMonth(1));
	}

	private renderWeekEvents(
		week: HTMLElement,
		segments: CalendarRangeSegment[],
		weekDates: string[],
		items: CalendarItem[],
		options: BasesCalendarViewOptions,
	): void {
		const layer = week.createDiv({ cls: 'calendar-note-bases-events' });
		const visible = segments.filter((segment) => segment.lane < options.maximumVisibleEvents);
		week.style.setProperty('--calendar-note-week-rows', String(Math.min(options.maximumVisibleEvents, Math.max(0, ...segments.map((segment) => segment.lane + 1))) +
			(segments.some((segment) => segment.lane >= options.maximumVisibleEvents) ? 1 : 0)));
		for (const segment of visible) {
			const resolution = this.styleResolver.resolve(segment.item, BASES_STYLE_PROFILE, this.plugin.settings.typeStyleRules);
			this.plugin.diagnostics.replaceStyleForFileAndProfile(segment.item.filePath, BASES_STYLE_PROFILE.id, resolution.diagnostics);
			const style = resolution.style;
			const eventButton = layer.createEl('button', {
				cls: 'calendar-note-bases-event',
				attr: { title: segment.item.title, 'aria-label': segment.item.title },
			});
			eventButton.toggleClass('continues-before', segment.continuesBefore);
			eventButton.toggleClass('continues-after', segment.continuesAfter);
			eventButton.style.gridColumn = `${segment.startColumn + 1} / ${segment.endColumn + 2}`;
			eventButton.style.gridRow = String(segment.lane + 1);
			eventButton.style.setProperty('--calendar-note-item-bg', style.backgroundColor);
			eventButton.style.setProperty('--calendar-note-item-text', style.textColor);
			if (options.eventDisplayMode !== 'title' && options.eventDisplayMode !== 'properties') {
				const icon = eventButton.createSpan({ cls: 'calendar-note-bases-event-icon' });
				setIcon(icon, style.icon);
			}
			if (options.eventDisplayMode === 'properties') {
				eventButton.createSpan({
					cls: 'calendar-note-bases-event-properties',
					text: this.propertyContentByItemId.get(segment.item.id) || segment.item.title,
				});
			} else if (options.eventDisplayMode !== 'icon') {
				eventButton.createSpan({ cls: 'calendar-note-bases-event-title', text: segment.item.title });
			}
			eventButton.addEventListener('click', () => { void this.openEvent(segment.item, false); });
			eventButton.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				this.showEventMenu(segment.item, event);
			});
		}
		for (const [column, date] of weekDates.entries()) {
			const dateParts = getCalendarDateParts(date);
			if (!options.showAdjacentMonthDates && (dateParts.year !== this.year || dateParts.month !== this.month)) continue;
			const dateItems = this.itemsForDate(items, date);
			const visibleIds = new Set(visible
				.filter((segment) => segment.startColumn <= column && segment.endColumn >= column)
				.map((segment) => segment.item.id));
			const hiddenCount = dateItems.filter((item) => !visibleIds.has(item.id)).length;
			if (hiddenCount === 0) continue;
			const more = layer.createEl('button', {
				cls: 'calendar-note-bases-more',
				text: this.text('more', { count: hiddenCount }),
				attr: { 'aria-label': this.text('moreEventsOn', { count: hiddenCount, date: this.dateLabel(date) }) },
			});
			more.style.gridColumn = String(column + 1);
			more.style.gridRow = String(options.maximumVisibleEvents + 1);
			more.addEventListener('click', (event) => this.showItemsMenu(dateItems, event));
		}
	}

	private readOptions(): BasesCalendarViewOptions {
		const start = this.config.getAsPropertyId('startProperty');
		return {
			properties: start ? {
				start,
				end: this.config.getAsPropertyId('endProperty'),
				title: this.config.getAsPropertyId('titleProperty'),
				type: this.config.getAsPropertyId('typeProperty'),
				icon: this.config.getAsPropertyId('iconProperty'),
				backgroundColor: this.config.getAsPropertyId('backgroundColorProperty'),
				textColor: this.config.getAsPropertyId('textColorProperty'),
			} : undefined,
			firstDayOfWeek: integerOption(this.config.get('firstDayOfWeek'), 0, 6, this.plugin.settings.firstDayOfWeek),
			weekendDays: weekdayOptions(this.config.get('weekendDays'), this.plugin.settings.weekendDays),
			showAdjacentMonthDates: booleanOption(this.config.get('showAdjacentMonthDates'), true),
			maximumVisibleEvents: integerOption(this.config.get('maximumVisibleEvents'), 1, 12, 3),
			eventDisplayMode: displayMode(this.config.get('eventDisplayMode')),
			visibleProperties: [...this.data.properties],
		};
	}

	private getItems(options: BasesCalendarViewOptions): CalendarItem[] {
		this.propertyContentByItemId.clear();
		if (!options.properties) return [];
		const items: CalendarItem[] = [];
		for (const entry of this.data.data) {
			const item = this.normalizer.normalize(entry, options.properties, this.plugin.settings.eventPropertyDateFormat);
			if (!item) continue;
			items.push(item);
			this.propertyContentByItemId.set(item.id, basesPropertiesToDisplayText(
				entry,
				options.visibleProperties ?? [],
				(property) => this.config.getDisplayName(property),
			));
		}
		return sortCalendarItems(items);
	}

	private itemsForDate(items: CalendarItem[], date: string): CalendarItem[] {
		return items.filter((item) => compareCalendarDates(item.startDate, date) <= 0 && compareCalendarDates(item.endDate, date) >= 0);
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

	private addHeaderButton(container: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-bases-nav', attr: { 'aria-label': label } });
		setIcon(button, icon);
		button.addEventListener('click', action);
		return button;
	}

	private showDateMenu(date: string, items: CalendarItem[], event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(this.plugin.dailyNotes.find(date) ? this.text('openDailyNote') : this.text('createDailyNote')).setIcon('calendar-check').onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item.setTitle(this.text('createEvent')).setIcon('calendar-plus').onClick(() => new CreateEventModal(this.plugin, this.plugin.eventCreation, date).open()));
		menu.addSeparator();
		this.addItemsToMenu(menu, items);
		menu.showAtMouseEvent(event);
	}

	private showItemsMenu(items: CalendarItem[], event: MouseEvent): void {
		const menu = new Menu();
		this.addItemsToMenu(menu, items);
		menu.showAtMouseEvent(event);
	}

	private addItemsToMenu(menu: Menu, items: CalendarItem[]): void {
		menu.addItem((item) => item.setTitle(this.text('eventsOnDate')).setIsLabel(true));
		if (items.length === 0) menu.addItem((item) => item.setTitle(this.text('noEvents')).setDisabled(true));
		for (const calendarItem of items) {
			menu.addItem((item) => item.setTitle(calendarItem.title).setIcon(calendarItem.icon ?? 'calendar').onClick(() => this.openEvent(calendarItem, false)));
		}
	}

	private showEventMenu(item: CalendarItem, event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((menuItem) => menuItem.setTitle(this.text('openNote')).setIcon('file-text').onClick(() => this.openEvent(item, false)));
		menu.addItem((menuItem) => menuItem.setTitle(this.text('openInNewTab')).setIcon('file-plus').onClick(() => this.openEvent(item, true)));
		this.plugin.app.workspace.handleLinkContextMenu(menu, item.filePath, '');
		menu.showAtMouseEvent(event);
	}

	private async openEvent(item: CalendarItem, newTab: boolean): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(item.filePath);
		if (file) await this.plugin.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
	}

	private dateLabel(date: string): string {
		return formatCalendarDate(date, this.plugin.settings.displayDateFormat) ?? date;
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}

function booleanOption(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function integerOption(value: unknown, minimum: number, maximum: number, fallback: number): number {
	const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
	return Number.isInteger(parsed) && Number(parsed) >= minimum && Number(parsed) <= maximum ? Number(parsed) : fallback;
}

function weekdayOptions(value: unknown, fallback: number[]): number[] {
	if (!Array.isArray(value)) return [...fallback];
	const weekdays = [...new Set(value.map(Number).filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6))];
	return weekdays.length > 0 ? weekdays : [...fallback];
}

function displayMode(value: unknown): EventDisplayMode {
	return value === 'icon' || value === 'title' || value === 'properties' ? value : 'icon-title';
}
