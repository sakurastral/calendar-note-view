import {
	BasesView,
	Menu,
	Notice,
	setIcon,
	setTooltip,
	type BasesPropertyId,
	type QueryController,
} from 'obsidian';
export { getBasesCalendarOptions } from './bases-options';
import {
	BasesAgendaModal,
	BasesInvalidEntriesModal,
	copyObsidianLink,
	type BasesAgendaItem,
	type BasesInvalidEntry,
} from './bases-agenda-modal';
import {
	applyBasesEventFrontmatter,
	BasesEventCreateModal,
	writableNoteProperty,
	type BasesEventCreateInput,
} from './bases-event-create-modal';
import {
	readEventDisplayMode,
	readEventRowLimit,
	readLayoutDensity,
	readWeekendDays,
	resolveCompactLayout,
	resolveResponsiveSize,
	resolveVisibleRows,
	type BasesEventDisplayMode,
	type BasesEventRowLimit,
	type BasesLayoutDensity,
	type BasesResponsiveSize,
} from './bases-options';
import {
	BasesCalendarNormalizer,
	basesPropertyDetails,
	type BasesCalendarPropertyMap,
	type BasesPropertyDetail,
} from './bases-normalizer';
import { buildCalendarMonthGrid, moveCalendarMonth } from './calendar-grid';
import { calendarMonthLabels, calendarText, calendarWeekdayLabels, type CalendarTextKey } from './calendar-locale';
import {
	compareCalendarDates,
	canonicalDateFromParts,
	daysInMonth,
	formatCalendarDate,
	getCalendarDateParts,
	getTodayCanonical,
} from './date';
import type CalendarNoteViewPlugin from './main';
import type { CalendarItem, CalendarSourceProfile } from './models';
import { allocateCalendarLanes, segmentCalendarItems, type CalendarRangeSegment } from './range-layout';
import { CalendarStyleResolver } from './style-resolver';

export const CALENDAR_BASES_VIEW_TYPE = 'calendar-note-month';

interface BasesCalendarViewOptions {
	properties?: BasesCalendarPropertyMap;
	firstDayOfWeek: number;
	weekendDays: number[];
	showAdjacentMonthDates: boolean;
	eventRowLimit: BasesEventRowLimit;
	eventDisplayMode: BasesEventDisplayMode;
	visibleProperties: BasesPropertyId[];
	layoutDensity: BasesLayoutDensity;
	showInvalidEntryNotice: boolean;
}

interface NormalizedBasesItems {
	items: CalendarItem[];
	invalidEntries: BasesInvalidEntry[];
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
	private readonly propertyDetailsByItemId = new Map<string, BasesPropertyDetail[]>();
	private readonly focusTargets = new Map<string, HTMLElement>();
	private year: number;
	private month: number;
	private selectedDate?: string;
	private responsiveSize: BasesResponsiveSize;
	private agendaModal?: BasesAgendaModal;
	private resizeObserver?: ResizeObserver;

	constructor(
		controller: QueryController,
		parentEl: HTMLElement,
		private readonly plugin: CalendarNoteViewPlugin,
	) {
		super(controller);
		this.containerEl = parentEl.createDiv({ cls: 'calendar-note-bases' });
		this.responsiveSize = resolveResponsiveSize(parentEl.clientWidth || 900);
		const today = getCalendarDateParts(getTodayCanonical(plugin.settings.timeZone));
		this.year = today.year;
		this.month = today.month;
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver((entries) => {
				const width = entries[0]?.contentRect.width ?? this.containerEl.clientWidth;
				const next = resolveResponsiveSize(width);
				if (next === this.responsiveSize) return;
				this.responsiveSize = next;
				this.renderCalendar();
			});
			this.resizeObserver.observe(this.containerEl);
			this.register(() => this.resizeObserver?.disconnect());
		}
		const unsubscribeRollover = this.plugin.dayRollover?.subscribe(() => this.renderCalendar());
		if (unsubscribeRollover) this.register(unsubscribeRollover);
	}

	onDataUpdated(): void {
		this.renderCalendar();
	}

	private renderCalendar(): void {
		const restoreFocus = this.focusKeyForActiveElement();
		this.containerEl.empty();
		this.focusTargets.clear();
		this.plugin.diagnostics.removeStyleForProfile(BASES_STYLE_PROFILE.id);
		const options = this.readOptions();
		const compact = resolveCompactLayout(options.layoutDensity, this.responsiveSize);
		this.containerEl.toggleClass('is-layout-compact', compact);
		this.containerEl.toggleClass('is-layout-comfortable', !compact && (options.layoutDensity === 'comfortable' || this.responsiveSize === 'wide'));
		this.containerEl.toggleClass('is-layout-medium', !compact && this.responsiveSize === 'medium');
		this.renderHeader();
		if (!options.properties) {
			this.renderEmptyState(this.text('chooseStartProperty'));
			this.restoreFocus(restoreFocus);
			return;
		}
		if (!this.isPropertyAvailable(options.properties.start)) {
			this.renderEmptyState(this.text('invalidStartProperty'));
			this.restoreFocus(restoreFocus);
			return;
		}

		const normalized = this.getItems(options, true);
		if (this.data.data.length === 0) this.renderFeedback(this.text('baseQueryEmpty'));
		if (this.data.data.length > 0 && normalized.items.length === 0) this.renderFeedback(this.text('baseDatesEmpty'));
		if (options.showInvalidEntryNotice && normalized.invalidEntries.length > 0) {
			this.renderInvalidFeedback(normalized.invalidEntries);
		}

		const grid = buildCalendarMonthGrid(this.year, this.month, options.firstDayOfWeek, options.weekendDays);
		const visibleCells = options.showAdjacentMonthDates ? grid.cells : grid.cells.filter((cell) => cell.inCurrentMonth);
		const rangeStart = visibleCells[0]?.date;
		const rangeEnd = visibleCells[visibleCells.length - 1]?.date;
		if (!rangeStart || !rangeEnd) return;
		const monthItems = normalized.items.filter((item) =>
			compareCalendarDates(item.startDate, rangeEnd) <= 0 && compareCalendarDates(item.endDate, rangeStart) >= 0);
		const currentMonthStart = canonicalDateFromParts(this.year, this.month, 1);
		const currentMonthEnd = canonicalDateFromParts(this.year, this.month, daysInMonth(this.year, this.month));
		const hasCurrentMonthEvent = normalized.items.some((item) =>
			compareCalendarDates(item.startDate, currentMonthEnd) <= 0 && compareCalendarDates(item.endDate, currentMonthStart) >= 0);
		if (normalized.items.length > 0 && !hasCurrentMonthEvent) this.renderFeedback(this.text('monthEventsEmpty'));
		const segments = segmentCalendarItems(
			monthItems,
			grid.cells[0]?.date ?? rangeStart,
			grid.cells[grid.cells.length - 1]?.date ?? rangeEnd,
			rangeStart,
			rangeEnd,
		);
		const weekLayouts = new Map(allocateCalendarLanes(segments).map((layout) => [layout.weekIndex, layout]));
		const today = getTodayCanonical(this.plugin.settings.timeZone);
		const dailyNotes = this.plugin.dailyNotes.getAll();
		const visibleRows = resolveVisibleRows(options.eventRowLimit, options.layoutDensity, this.responsiveSize);
		const canCreate = writableNoteProperty(options.properties.start) !== null;

		const weekdayHeader = this.containerEl.createDiv({ cls: 'calendar-note-bases-weekdays', attr: { role: 'row' } });
		const weekdayLabels = calendarWeekdayLabels(this.plugin.settings.calendarLocale);
		for (const weekday of grid.weekdays) {
			weekdayHeader.createDiv({ cls: 'calendar-note-bases-weekday', text: weekdayLabels[weekday] ?? '', attr: { role: 'columnheader' } });
		}
		const monthGrid = this.containerEl.createDiv({ cls: 'calendar-note-bases-month', attr: { role: 'grid', tabindex: '0' } });
		this.registerFocusTarget(monthGrid, 'grid');
		monthGrid.addEventListener('keydown', (event) => this.handleGridKeydown(event));
		for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
			const weekCells = grid.cells.slice(weekIndex * 7, weekIndex * 7 + 7);
			const layout = weekLayouts.get(weekIndex);
			const week = monthGrid.createDiv({ cls: 'calendar-note-bases-week', attr: { role: 'row' } });
			const displayedLaneCount = Number.isFinite(visibleRows) ? Math.min(visibleRows, layout?.laneCount ?? 0) : layout?.laneCount ?? 0;
			week.style.setProperty('--calendar-note-week-lanes', String(displayedLaneCount));
			const dates = week.createDiv({ cls: 'calendar-note-bases-dates' });
			for (const cell of weekCells) {
				const hiddenAdjacent = !options.showAdjacentMonthDates && !cell.inCurrentMonth;
				const dateItems = this.itemsForDate(monthItems, cell.date);
				const dateCell = dates.createDiv({ cls: 'calendar-note-bases-date-cell', attr: { role: 'gridcell', tabindex: hiddenAdjacent ? '-1' : '0' } });
				dateCell.toggleClass('is-adjacent-month', !cell.inCurrentMonth);
				dateCell.toggleClass('is-hidden-adjacent', hiddenAdjacent);
				dateCell.toggleClass('is-weekend', cell.isWeekend);
				dateCell.toggleClass('is-today', cell.date === today);
				dateCell.toggleClass('is-selected', cell.date === this.selectedDate);
				dateCell.dataset.date = cell.date;
				dateCell.setAttribute('aria-label', this.dateCellAriaLabel(cell.date, dateItems.length));
				dateCell.setAttribute('aria-selected', String(cell.date === this.selectedDate));
				this.registerFocusTarget(dateCell, `date:${cell.date}`);
				if (hiddenAdjacent) continue;
				dateCell.addEventListener('click', (event) => {
					if (event.target === dateCell) this.openAgenda(cell.date, dateItems);
				});
				dateCell.addEventListener('keydown', (event) => {
					if (event.target !== dateCell || (event.key !== 'Enter' && event.key !== ' ')) return;
					event.preventDefault();
					this.openAgenda(cell.date, dateItems);
				});
				const dateButton = dateCell.createEl('button', {
					cls: 'calendar-note-bases-date-number',
					text: String(cell.day),
					attr: { 'aria-label': this.plugin.dailyNotes.find(cell.date, dailyNotes) ? this.text('openDailyNote') : this.text('createDailyNote') },
				});
				this.registerFocusTarget(dateButton, `daily:${cell.date}`);
				setTooltip(dateButton, this.plugin.dailyNotes.find(cell.date, dailyNotes) ? this.text('openDailyNote') : this.text('createDailyNote'));
				dateButton.addEventListener('click', () => { void this.plugin.dailyNotes.open(cell.date); });
				if (this.plugin.dailyNotes.find(cell.date, dailyNotes)) {
					const indicator = dateCell.createEl('button', { cls: 'calendar-note-bases-daily-indicator', attr: { 'aria-label': this.text('openDailyNote') } });
					this.registerFocusTarget(indicator, `daily-indicator:${cell.date}`);
					setTooltip(indicator, this.text('dailyNoteExists'));
					indicator.addEventListener('click', () => { void this.plugin.dailyNotes.open(cell.date); });
				}
				const addButton = dateCell.createEl('button', {
					cls: 'clickable-icon calendar-note-bases-add',
					attr: { 'aria-label': this.text('createEventOn', { date: this.dateLabel(cell.date) }) },
				});
				setIcon(addButton, 'plus');
				this.registerFocusTarget(addButton, `add:${cell.date}`);
				addButton.disabled = !canCreate;
				if (!canCreate) addButton.setAttribute('aria-label', this.text('baseStartNotWritable'));
				setTooltip(addButton, canCreate ? this.text('createEventOn', { date: this.dateLabel(cell.date) }) : this.text('baseStartNotWritable'));
				addButton.addEventListener('click', () => this.openCreateModal(cell.date, options, normalized.items));
				dateCell.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					this.showDateMenu(cell.date, dateItems, options, normalized.items, event);
				});
				if (compact && dateItems.length > 0) this.renderCompactIndicator(dateCell, cell.date, dateItems);
			}
			if (!compact) this.renderWeekEvents(week, layout?.segments ?? [], weekCells.map((cell) => cell.date), monthItems, options, visibleRows);
		}
		this.restoreFocus(restoreFocus);
	}

	private renderHeader(): void {
		const header = this.containerEl.createDiv({ cls: 'calendar-note-bases-header' });
		this.addHeaderButton(header, 'chevron-left', this.text('previousMonth'), 'previous', () => this.moveMonth(-1));
		const picker = header.createDiv({ cls: 'calendar-note-bases-picker' });
		const year = picker.createEl('input', {
			cls: 'calendar-note-bases-year',
			attr: { type: 'number', min: '1', max: '9999', 'aria-label': this.text('calendarYear') },
		});
		this.registerFocusTarget(year, 'year');
		year.value = String(this.year);
		year.addEventListener('change', () => {
			const value = Number(year.value);
			if (Number.isInteger(value) && value >= 1 && value <= 9999) {
				this.year = value;
				this.renderCalendar();
			}
		});
		const month = picker.createEl('select', { cls: 'calendar-note-bases-month-select', attr: { 'aria-label': this.text('calendarMonth') } });
		this.registerFocusTarget(month, 'month');
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
		this.addHeaderButton(header, 'calendar-check', this.text('today'), 'today', () => this.goToToday());
		this.addHeaderButton(header, 'chevron-right', this.text('nextMonth'), 'next', () => this.moveMonth(1));
		const announcement = header.createSpan({ cls: 'calendar-note-bases-live', text: `${monthLabels[this.month - 1] ?? this.month} ${this.year}` });
		announcement.setAttribute('aria-live', 'polite');
		announcement.setAttribute('aria-atomic', 'true');
	}

	private renderWeekEvents(
		week: HTMLElement,
		segments: CalendarRangeSegment[],
		weekDates: string[],
		items: CalendarItem[],
		options: BasesCalendarViewOptions,
		visibleRows: number,
	): void {
		const layer = week.createDiv({ cls: 'calendar-note-bases-events' });
		const visible = segments.filter((segment) => segment.lane < visibleRows);
		const actualRows = Math.max(0, ...segments.map((segment) => segment.lane + 1));
		const displayedRows = Number.isFinite(visibleRows) ? Math.min(visibleRows, actualRows) : actualRows;
		const hasHidden = Number.isFinite(visibleRows) && segments.some((segment) => segment.lane >= visibleRows);
		week.style.setProperty('--calendar-note-week-rows', String(displayedRows + (hasHidden ? 1 : 0)));
		for (const segment of visible) {
			const resolution = this.styleResolver.resolve(segment.item, BASES_STYLE_PROFILE, this.plugin.settings.typeStyleRules);
			this.plugin.diagnostics.replaceStyleForFileAndProfile(segment.item.filePath, BASES_STYLE_PROFILE.id, resolution.diagnostics);
			const style = resolution.style;
			const range = this.formatRange(segment.item);
			const details = this.propertyDetailsByItemId.get(segment.item.id) ?? [];
			const eventButton = layer.createEl('button', {
				cls: 'calendar-note-bases-event',
				attr: { 'aria-label': `${segment.item.title}, ${range}` },
			});
			this.registerFocusTarget(eventButton, `event:${segment.item.id}:${segment.weekIndex}`);
			setTooltip(eventButton, this.eventTooltip(segment.item, range, details));
			eventButton.toggleClass('continues-before', segment.continuesBefore);
			eventButton.toggleClass('continues-after', segment.continuesAfter);
			eventButton.style.gridColumn = `${segment.startColumn + 1} / ${segment.endColumn + 2}`;
			eventButton.style.gridRow = String(segment.lane + 1);
			eventButton.style.setProperty('--calendar-note-item-bg', style.backgroundColor);
			eventButton.style.setProperty('--calendar-note-item-text', style.textColor);
			this.renderEventContent(eventButton, segment.item, details, options.eventDisplayMode, style.icon);
			eventButton.addEventListener('click', () => { void this.openEvent(segment.item, false); });
			eventButton.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				this.showEventMenu(segment.item, event);
			});
		}
		if (!Number.isFinite(visibleRows)) return;
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
			more.style.gridRow = String(visibleRows + 1);
			this.registerFocusTarget(more, `more:${date}`);
			more.addEventListener('click', () => this.openAgenda(date, dateItems));
		}
	}

	private renderEventContent(
		button: HTMLElement,
		item: CalendarItem,
		details: readonly BasesPropertyDetail[],
		mode: BasesEventDisplayMode,
		iconName: string,
	): void {
		if (mode !== 'title' && mode !== 'properties') {
			const icon = button.createSpan({ cls: 'calendar-note-bases-event-icon' });
			setIcon(icon, iconName);
		}
		if (mode === 'icon') return;
		const summary = details.map((detail) => `${detail.displayName}: ${detail.text}`).join(' · ');
		if (mode === 'properties') {
			button.createSpan({ cls: 'calendar-note-bases-event-properties', text: summary || item.title });
			return;
		}
		const content = button.createSpan({ cls: 'calendar-note-bases-event-content' });
		content.createSpan({ cls: 'calendar-note-bases-event-title', text: item.title });
		if (mode === 'title-properties' && summary) content.createSpan({ cls: 'calendar-note-bases-event-properties', text: summary });
	}

	private renderCompactIndicator(dateCell: HTMLElement, date: string, items: CalendarItem[]): void {
		const indicator = dateCell.createEl('button', {
			cls: 'calendar-note-bases-compact-indicator',
			text: String(items.length),
			attr: { 'aria-label': this.text('openAgenda', { date: this.dateLabel(date) }) },
		});
		this.registerFocusTarget(indicator, `agenda:${date}`);
		indicator.toggleClass('continues-before', items.some((item) => compareCalendarDates(item.startDate, date) < 0));
		indicator.toggleClass('continues-after', items.some((item) => compareCalendarDates(item.endDate, date) > 0));
		setTooltip(indicator, this.text('agendaTitle', { date: this.dateLabel(date), count: items.length }));
		indicator.addEventListener('click', () => this.openAgenda(date, items));
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
			weekendDays: readWeekendDays(this.config.get('weekendPreset'), this.config.get('weekendDays'), this.plugin.settings.weekendDays),
			showAdjacentMonthDates: booleanOption(this.config.get('showAdjacentMonthDates'), true),
			eventRowLimit: readEventRowLimit(this.config.get('eventRowLimit'), this.config.get('maximumVisibleEvents')),
			eventDisplayMode: readEventDisplayMode(this.config.get('eventDisplayMode')),
			visibleProperties: [...this.data.properties],
			layoutDensity: readLayoutDensity(this.config.get('layoutDensity')),
			showInvalidEntryNotice: booleanOption(this.config.get('showInvalidEntryNotice'), true),
		};
	}

	private getItems(options: BasesCalendarViewOptions): CalendarItem[];
	private getItems(options: BasesCalendarViewOptions, includeIssues: true): NormalizedBasesItems;
	private getItems(options: BasesCalendarViewOptions, includeIssues = false): CalendarItem[] | NormalizedBasesItems {
		this.propertyDetailsByItemId.clear();
		if (!options.properties) return includeIssues ? { items: [], invalidEntries: [] } : [];
		const items: CalendarItem[] = [];
		const invalidEntries: BasesInvalidEntry[] = [];
		for (const entry of this.data.data) {
			const result = this.normalizer.normalizeWithResult(entry, options.properties, this.plugin.settings.eventPropertyDateFormat);
			if (!result.item) {
				if (result.issue) invalidEntries.push({ filePath: entry.file.path, issue: result.issue });
				continue;
			}
			items.push(result.item);
			this.propertyDetailsByItemId.set(result.item.id, basesPropertyDetails(
				entry,
				options.visibleProperties,
				(property) => this.config.getDisplayName(property),
			));
		}
		return includeIssues ? { items, invalidEntries } : items;
	}

	private itemsForDate(items: readonly CalendarItem[], date: string): CalendarItem[] {
		return items.filter((item) => compareCalendarDates(item.startDate, date) <= 0 && compareCalendarDates(item.endDate, date) >= 0);
	}

	private moveMonth(amount: number): void {
		const next = moveCalendarMonth(this.year, this.month, amount);
		this.year = next.year;
		this.month = next.month;
		this.renderCalendar();
	}

	private goToToday(): void {
		const todayDate = getTodayCanonical(this.plugin.settings.timeZone);
		const today = getCalendarDateParts(todayDate);
		this.year = today.year;
		this.month = today.month;
		this.selectedDate = todayDate;
		this.renderCalendar();
	}

	private addHeaderButton(container: HTMLElement, icon: string, label: string, focusKey: string, action: () => void): HTMLButtonElement {
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-bases-nav', attr: { 'aria-label': label } });
		this.registerFocusTarget(button, focusKey);
		setIcon(button, icon);
		setTooltip(button, label);
		button.addEventListener('click', action);
		return button;
	}

	private showDateMenu(
		date: string,
		items: CalendarItem[],
		options: BasesCalendarViewOptions,
		allItems: CalendarItem[],
		event: MouseEvent,
	): void {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(this.text('openAgenda', { date: this.dateLabel(date) })).setIcon('list').onClick(() => this.openAgenda(date, items)));
		menu.addItem((item) => item.setTitle(this.plugin.dailyNotes.find(date) ? this.text('openDailyNote') : this.text('createDailyNote')).setIcon('calendar-check').onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item
			.setTitle(writableNoteProperty(options.properties?.start) ? this.text('createEvent') : this.text('baseStartNotWritable'))
			.setIcon('calendar-plus')
			.setDisabled(!writableNoteProperty(options.properties?.start))
			.onClick(() => this.openCreateModal(date, options, allItems)));
		menu.showAtMouseEvent(event);
	}

	private showEventMenu(item: CalendarItem, event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((menuItem) => menuItem.setTitle(this.text('openNote')).setIcon('file-text').onClick(() => this.openEvent(item, false)));
		menu.addItem((menuItem) => menuItem.setTitle(this.text('openInNewTab')).setIcon('file-plus').onClick(() => this.openEvent(item, true)));
		menu.addItem((menuItem) => menuItem.setTitle(this.text('copyObsidianLink')).setIcon('copy').onClick(() => copyObsidianLink(item, (key, values) => this.text(key, values))));
		this.plugin.app.workspace.handleLinkContextMenu(menu, item.filePath, '');
		menu.showAtMouseEvent(event);
	}

	private openAgenda(date: string, items: CalendarItem[]): void {
		this.selectedDate = date;
		this.renderCalendar();
		this.agendaModal?.close();
		const agendaItems: BasesAgendaItem[] = items.map((item) => ({
			item,
			details: this.propertyDetailsByItemId.get(item.id) ?? [],
		}));
		this.agendaModal = new BasesAgendaModal(
			this.plugin.app,
			this.dateLabel(date),
			agendaItems,
			(item) => this.formatRange(item),
			(key, values) => this.text(key, values),
			(item, newTab) => this.openEvent(item, newTab),
		);
		this.agendaModal.open();
	}

	private openCreateModal(date: string, options: BasesCalendarViewOptions, items: CalendarItem[]): void {
		if (!options.properties || !writableNoteProperty(options.properties.start)) {
			new Notice(this.text('baseStartNotWritable'));
			return;
		}
		const mappings = options.properties;
		const types = basesEventTypeValues(
			this.plugin.settings.typeStyleRules.map((rule) => rule.typeValue),
			items.map((item) => item.type),
		);
		new BasesEventCreateModal(
			this.plugin.app,
			date,
			types,
			(key, values) => this.text(key, values),
			(input) => this.createBaseEvent(mappings, input),
		).open();
	}

	private async createBaseEvent(mappings: BasesCalendarPropertyMap, input: BasesEventCreateInput): Promise<void> {
		const baseFileName = input.title.trim() || input.startDate;
		await this.createFileForView(baseFileName, (frontmatter: unknown) => {
			applyBasesEventFrontmatter(frontmatter, mappings, input, this.plugin.settings.eventPropertyDateFormat);
		});
	}

	private renderInvalidFeedback(entries: BasesInvalidEntry[]): void {
		const notice = this.containerEl.createDiv({ cls: 'calendar-note-bases-inline-feedback is-warning' });
		notice.createSpan({ text: this.text('skippedInvalidEntries', { count: entries.length }) });
		const button = notice.createEl('button', { cls: 'mod-ghost', text: this.text('viewSkippedEntries') });
		button.addEventListener('click', () => new BasesInvalidEntriesModal(
			this.plugin.app,
			entries,
			(key, values) => this.text(key, values),
			(path) => this.openPath(path, false),
		).open());
	}

	private renderFeedback(message: string): void {
		this.containerEl.createDiv({ cls: 'calendar-note-bases-inline-feedback', text: message });
	}

	private renderEmptyState(message: string): void {
		this.containerEl.createDiv({ cls: 'calendar-note-empty-state', text: message });
	}

	private handleGridKeydown(event: KeyboardEvent): void {
		if (isTextInput(event.target)) return;
		if (event.key === 'Escape' && this.agendaModal) {
			event.preventDefault();
			this.agendaModal.close();
			this.agendaModal = undefined;
			return;
		}
		if (event.key === 'Home') {
			event.preventDefault();
			this.goToToday();
			return;
		}
		if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
		event.preventDefault();
		const direction = event.key === 'PageUp' ? -1 : 1;
		this.moveMonth(direction * (event.shiftKey ? 12 : 1));
	}

	private registerFocusTarget(element: HTMLElement, key: string): void {
		element.dataset.focusKey = key;
		this.focusTargets.set(key, element);
	}

	private focusKeyForActiveElement(): string | undefined {
		const active = this.containerEl.ownerDocument.activeElement;
		return active instanceof HTMLElement && this.containerEl.contains(active) ? active.dataset.focusKey : undefined;
	}

	private restoreFocus(key: string | undefined): void {
		if (key) this.focusTargets.get(key)?.focus();
	}

	private isPropertyAvailable(property: BasesPropertyId): boolean {
		return !Array.isArray(this.allProperties) || this.allProperties.length === 0 || this.allProperties.includes(property);
	}

	private async openEvent(item: CalendarItem, newTab: boolean): Promise<void> {
		await this.openPath(item.filePath, newTab);
	}

	private async openPath(path: string, newTab: boolean): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(path);
		if (file) await this.plugin.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file);
	}

	private formatRange(item: CalendarItem): string {
		const start = this.dateLabel(item.startDate);
		const end = this.dateLabel(item.endDate);
		return item.startDate === item.endDate ? start : `${start} – ${end}`;
	}

	private eventTooltip(item: CalendarItem, range: string, details: readonly BasesPropertyDetail[]): string {
		const lines = [item.title, range];
		if (item.type) lines.push(`${this.text('eventTypeLabel')}: ${item.type}`);
		for (const detail of details) lines.push(`${detail.displayName}: ${detail.text}`);
		return lines.join('\n');
	}

	private dateCellAriaLabel(date: string, count: number): string {
		return count > 0 ? this.text('agendaTitle', { date: this.dateLabel(date), count }) : this.dateLabel(date);
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

function isTextInput(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function basesEventTypeValues(...groups: ReadonlyArray<readonly (string | undefined)[]>): string[] {
	const values = new Set<string>();
	for (const group of groups) {
		for (const value of group) {
			const normalized = value?.trim();
			if (normalized) values.add(normalized);
		}
	}
	return [...values].sort((left, right) => left.localeCompare(right));
}
