import { ItemView, Menu, Notice, setIcon, setTooltip, type WorkspaceLeaf } from 'obsidian';
import { buildCalendarMonthGrid, moveCalendarMonth } from './calendar-grid';
import { calendarMonthLabels, calendarText, calendarWeekdayLabels, type CalendarTextKey } from './calendar-locale';
import { CreateEventModal } from './create-event-modal';
import {
	addCalendarDays,
	canonicalDateFromParts,
	daysInMonth,
	formatCalendarDate,
	getCalendarDateParts,
	getTodayCanonical,
} from './date';
import { hasSourceConditions } from './matcher';
import type CalendarNoteViewPlugin from './main';
import type { CalendarItem } from './models';
import { SetupAssistantModal } from './setup-assistant-modal';
import { getSidebarIndicatorFrameSize, getSidebarIndicatorGrid, getSidebarIndicatorPresentation } from './sidebar-indicator';
import { SidebarAgendaModal } from './sidebar-agenda-modal';
import { CalendarStyleResolver } from './style-resolver';

export const CALENDAR_SIDEBAR_VIEW_TYPE = 'calendar-note-sidebar';

export class CalendarSidebarView extends ItemView {
	private year: number;
	private month: number;
	private selectedDate?: string;
	private unsubscribeIndex?: () => void;
	private unsubscribeRollover?: () => void;
	private resizeObserver?: ResizeObserver;
	private indicatorSizingFrame?: number;
	private refreshing = false;
	private longPressTimer?: number;
	private suppressNextClick = false;
	private pendingFocusKey?: string;
	private focusFallbackDate?: string;
	private readonly focusTargets = new Map<string, HTMLElement>();
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
		return this.text('calendarNoteView');
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		this.unsubscribeIndex = this.plugin.index.subscribe(() => this.renderCalendar());
		this.unsubscribeRollover = this.plugin.dayRollover.subscribe(() => this.renderCalendar());
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => this.scheduleIndicatorSizing());
			this.resizeObserver.observe(this.contentEl);
		}
		this.renderCalendar();
		await Promise.resolve();
	}

	async onClose(): Promise<void> {
		this.unsubscribeIndex?.();
		this.unsubscribeIndex = undefined;
		this.unsubscribeRollover?.();
		this.unsubscribeRollover = undefined;
		this.resizeObserver?.disconnect();
		this.resizeObserver = undefined;
		if (this.indicatorSizingFrame !== undefined) window.cancelAnimationFrame(this.indicatorSizingFrame);
		this.indicatorSizingFrame = undefined;
		if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
		await Promise.resolve();
	}

	renderCalendar(): void {
		const restoreKey = this.pendingFocusKey ?? this.focusKeyForActiveElement();
		this.pendingFocusKey = undefined;
		this.contentEl.empty();
		this.focusTargets.clear();
		this.contentEl.addClass('calendar-note-sidebar');
		const live = this.contentEl.createDiv({ cls: 'calendar-note-sr-only', attr: { 'aria-live': 'polite' } });
		live.setText(this.text('monthChanged', { month: this.monthLabel() }));
		const header = this.contentEl.createDiv({ cls: 'calendar-note-sidebar-header' });
		this.addHeaderButton(header, 'chevron-left', this.text('previousMonth'), 'previous', () => this.moveMonth(-1));
		this.renderPicker(header);
		this.addHeaderButton(header, 'calendar-check', this.text('today'), 'today', () => this.goToToday());
		this.addHeaderButton(header, 'chevron-right', this.text('nextMonth'), 'next', () => this.moveMonth(1));
		const refresh = this.addHeaderButton(header, 'refresh-cw', this.text('refreshCalendar'), 'refresh', () => { void this.refresh(); });
		refresh.disabled = this.refreshing;
		refresh.toggleClass('is-loading', this.refreshing);

		if (!this.hasValidSourceProfile()) {
			this.renderSetupEmptyState();
			this.restoreFocus(restoreKey);
			return;
		}
		if (this.plugin.index.getStatus() !== 'ready') {
			const statusKey = this.plugin.index.getStatus() === 'initializing' ? 'indexInitializing' : 'indexNotInitialized';
			this.contentEl.createDiv({ cls: 'calendar-note-inline-status', text: this.text(statusKey) });
		}
		this.renderGrid();
		this.restoreFocus(restoreKey);
		this.scheduleIndicatorSizing();
	}

	goToToday(): void {
		const todayDate = getTodayCanonical(this.plugin.settings.timeZone);
		const today = getCalendarDateParts(todayDate);
		this.year = today.year;
		this.month = today.month;
		this.selectedDate = todayDate;
		this.pendingFocusKey = `date:${todayDate}`;
		this.renderCalendar();
	}

	showAgenda(date = getTodayCanonical(this.plugin.settings.timeZone), returnFocus?: HTMLElement): void {
		this.selectedDate = date;
		this.contentEl.querySelectorAll<HTMLElement>('.calendar-note-date-cell').forEach((cell) => {
			cell.toggleClass('is-selected', cell.dataset.date === date);
		});
		new SidebarAgendaModal(this.plugin, date, this.plugin.index.getItemsForDate(date), returnFocus).open();
	}

	private renderSetupEmptyState(): void {
		const empty = this.contentEl.createDiv({ cls: 'calendar-note-empty-state calendar-note-sidebar-setup-empty' });
		empty.createEl('h3', { text: this.text('sidebarSetupTitle') });
		empty.createEl('p', { text: this.text('sidebarSetupDescription') });
		const button = empty.createEl('button', { cls: 'mod-cta', text: this.text('setupSidebarCalendar') });
		button.type = 'button';
		button.dataset.focusKey = 'setup';
		this.focusTargets.set('setup', button);
		button.addEventListener('click', () => this.openSetupAssistant());
	}

	private openSetupAssistant(): void {
		new SetupAssistantModal(this.plugin, (profile) => this.plugin.addSetupProfile(profile)).open();
	}

	private renderGrid(): void {
		const settings = this.plugin.settings;
		const grid = buildCalendarMonthGrid(this.year, this.month, settings.firstDayOfWeek, settings.weekendDays);
		const today = getTodayCanonical(settings.timeZone);
		const dailyNotes = this.plugin.dailyNotes.getAll();
		const calendar = this.contentEl.createDiv({ cls: 'calendar-note-month-grid', attr: { role: 'grid' } });
		calendar.addEventListener('keydown', (event) => this.handleGridKeydown(event));
		const weekdayLabels = calendarWeekdayLabels(settings.calendarLocale);
		for (const weekday of grid.weekdays) calendar.createDiv({ cls: 'calendar-note-weekday', text: weekdayLabels[weekday] ?? '', attr: { role: 'columnheader' } });
		for (const cell of grid.cells) {
			const wrapper = calendar.createDiv({ cls: 'calendar-note-date-cell', attr: { role: 'gridcell' } });
			wrapper.toggleClass('is-adjacent-month', !cell.inCurrentMonth);
			wrapper.toggleClass('is-weekend', cell.isWeekend);
			wrapper.toggleClass('is-today', cell.date === today);
			wrapper.toggleClass('is-selected', cell.date === this.selectedDate);
			wrapper.dataset.date = cell.date;
			if (this.plugin.dailyNotes.find(cell.date, dailyNotes)) {
				const daily = wrapper.createSpan({ cls: 'calendar-note-daily-indicator', attr: { 'aria-label': this.text('dailyNoteIndicator', { date: this.dateLabel(cell.date) }) } });
				setTooltip(daily, this.text('dailyNoteIndicator', { date: this.dateLabel(cell.date) }));
			}

			const dateAction = wrapper.createEl('button', {
				cls: 'calendar-note-date-button',
				attr: { 'aria-label': this.text('dailyNoteAction', { date: this.dateLabel(cell.date) }) },
			});
			dateAction.type = 'button';
			dateAction.dataset.focusKey = `date:${cell.date}`;
			this.focusTargets.set(`date:${cell.date}`, dateAction);
			dateAction.createSpan({ cls: 'calendar-note-date-number', text: String(cell.day) });
			dateAction.addEventListener('click', () => {
				if (this.suppressNextClick) { this.suppressNextClick = false; return; }
				void this.plugin.dailyNotes.open(cell.date);
			});

			const items = this.plugin.index.getItemsForDate(cell.date);
			this.renderIndicators(wrapper, cell.date, items);
			wrapper.addEventListener('contextmenu', (event) => {
				event.preventDefault();
				this.showDateMenu(cell.date, items, event);
			});
			this.bindLongPress(dateAction, cell.date, items);
		}
	}

	private renderPicker(container: HTMLElement): void {
		const picker = container.createDiv({ cls: 'calendar-note-month-picker' });
		const year = picker.createEl('input', { cls: 'calendar-note-year-input', attr: { type: 'number', min: '1', max: '9999', 'aria-label': this.text('calendarYear') } });
		year.value = String(this.year);
		year.dataset.focusKey = 'year';
		this.focusTargets.set('year', year);
		year.addEventListener('change', () => {
			const value = Number(year.value);
			if (Number.isInteger(value) && value >= 1 && value <= 9999) { this.year = value; this.pendingFocusKey = 'year'; this.renderCalendar(); }
		});
		const month = picker.createEl('select', { cls: 'calendar-note-month-select', attr: { 'aria-label': this.text('calendarMonth') } });
		for (let value = 1; value <= 12; value += 1) {
			const option = month.createEl('option', { text: calendarMonthLabels(this.plugin.settings.calendarLocale)[value - 1] ?? String(value) });
			option.value = String(value);
		}
		month.value = String(this.month);
		month.dataset.focusKey = 'month';
		this.focusTargets.set('month', month);
		month.addEventListener('change', () => { this.month = Number(month.value); this.pendingFocusKey = 'month'; this.renderCalendar(); });
	}

	private renderIndicators(container: HTMLElement, date: string, items: CalendarItem[]): void {
		const indicators = container.createDiv({ cls: 'calendar-note-indicators' });
		const maximum = this.plugin.settings.maxIndicatorsPerDay;
		const visibleCount = Math.min(items.length, maximum) + Number(items.length > maximum);
		const grid = getSidebarIndicatorGrid(visibleCount);
		indicators.dataset.visibleCount = String(visibleCount);
		indicators.style.setProperty('--calendar-note-indicator-columns', String(grid.columns));
		indicators.style.setProperty('--calendar-note-indicator-rows', String(grid.rows));
		for (const item of items.slice(0, maximum)) {
			const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === item.sourceProfileId);
			if (!profile) continue;
			const resolution = this.styleResolver.resolve(item, profile, this.plugin.settings.typeStyleRules);
			this.plugin.diagnostics.replaceStyleForFileAndProfile(item.filePath, profile.id, resolution.diagnostics);
			const presentation = getSidebarIndicatorPresentation(profile, resolution.style.icon);
			const indicator = indicators.createEl('button', {
				cls: `calendar-note-indicator ${presentation.className}`,
				attr: { 'aria-label': this.text('eventIndicator', { title: item.title }) },
			});
			indicator.type = 'button';
			indicator.dataset.focusKey = `event:${item.id}`;
			indicator.dataset.date = date;
			this.focusTargets.set(`event:${item.id}`, indicator);
			setTooltip(indicator, item.title);
			indicator.style.setProperty('--calendar-note-item-bg', resolution.style.backgroundColor);
			indicator.style.setProperty('--calendar-note-item-text', resolution.style.textColor);
			indicator.style.backgroundColor = resolution.style.backgroundColor;
			indicator.style.color = resolution.style.textColor;
			if (presentation.icon) setIcon(indicator, presentation.icon);
			indicator.addEventListener('click', () => { void this.openEvent(item, false); });
			indicator.addEventListener('contextmenu', (event) => { event.preventDefault(); event.stopPropagation(); this.showEventMenu(item, event); });
		}
		if (items.length > maximum) {
			const overflow = indicators.createEl('button', { cls: 'calendar-note-overflow', text: this.text('more', { count: items.length - maximum }) });
			overflow.type = 'button';
			overflow.dataset.focusKey = `more:${date}`;
			overflow.dataset.date = date;
			this.focusTargets.set(`more:${date}`, overflow);
			setTooltip(overflow, this.text('moreEventsOn', { count: items.length - maximum, date: this.dateLabel(date) }));
			overflow.addEventListener('click', () => this.showAgenda(date, overflow));
		}
	}

	private scheduleIndicatorSizing(): void {
		if (this.indicatorSizingFrame !== undefined) window.cancelAnimationFrame(this.indicatorSizingFrame);
		this.indicatorSizingFrame = window.requestAnimationFrame(() => {
			this.indicatorSizingFrame = undefined;
			this.updateIndicatorFrameSizes();
		});
	}

	private updateIndicatorFrameSizes(): void {
		this.contentEl.querySelectorAll<HTMLElement>('.calendar-note-indicators').forEach((indicators) => {
			const visibleCount = Number(indicators.dataset.visibleCount ?? 0);
			const computed = window.getComputedStyle(indicators);
			const gap = Number.parseFloat(computed.columnGap || computed.gap) || 0;
			const horizontalPadding = (Number.parseFloat(computed.paddingLeft) || 0) + (Number.parseFloat(computed.paddingRight) || 0);
			const verticalPadding = (Number.parseFloat(computed.paddingTop) || 0) + (Number.parseFloat(computed.paddingBottom) || 0);
			const size = getSidebarIndicatorFrameSize(
				indicators.clientWidth - horizontalPadding,
				indicators.clientHeight - verticalPadding,
				visibleCount,
				gap,
			);
			if (size > 0) indicators.style.setProperty('--calendar-note-indicator-frame-size', `${size}px`);
		});
	}

	private addHeaderButton(container: HTMLElement, icon: string, label: string, key: string, action: () => void): HTMLButtonElement {
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-nav-button', attr: { 'aria-label': label } });
		button.type = 'button';
		button.dataset.focusKey = key;
		this.focusTargets.set(key, button);
		setIcon(button, icon);
		setTooltip(button, label);
		button.addEventListener('click', action);
		return button;
	}

	private moveMonth(amount: number, focusDate?: string): void {
		const next = moveCalendarMonth(this.year, this.month, amount);
		this.year = next.year;
		this.month = next.month;
		this.pendingFocusKey = focusDate ? `date:${focusDate}` : amount < 0 ? 'previous' : 'next';
		this.renderCalendar();
	}

	private async refresh(): Promise<void> {
		if (this.refreshing) return;
		this.refreshing = true;
		this.pendingFocusKey = 'refresh';
		this.renderCalendar();
		try { await this.plugin.index.refresh(); }
		catch { new Notice(this.text('refreshFailed')); }
		finally { this.refreshing = false; this.pendingFocusKey = 'refresh'; this.renderCalendar(); }
	}

	private handleGridKeydown(event: KeyboardEvent): void {
		if (!(event.target instanceof HTMLElement)) return;
		const cell = event.target.closest<HTMLElement>('.calendar-note-date-cell');
		const date = cell?.dataset.date;
		if (!date) return;
		let targetDate: string | undefined;
		if (event.key === 'ArrowLeft') targetDate = addCalendarDays(date, -1);
		if (event.key === 'ArrowRight') targetDate = addCalendarDays(date, 1);
		if (event.key === 'ArrowUp') targetDate = addCalendarDays(date, -7);
		if (event.key === 'ArrowDown') targetDate = addCalendarDays(date, 7);
		if (event.key === 'Home') targetDate = getTodayCanonical(this.plugin.settings.timeZone);
		if (event.key === 'PageUp' || event.key === 'PageDown') {
			const direction = event.key === 'PageUp' ? -1 : 1;
			targetDate = this.shiftDate(date, direction * (event.shiftKey ? 12 : 1));
		}
		if (!targetDate) return;
		event.preventDefault();
		const parts = getCalendarDateParts(targetDate);
		this.year = parts.year;
		this.month = parts.month;
		this.pendingFocusKey = `date:${targetDate}`;
		this.renderCalendar();
	}

	private shiftDate(date: string, monthAmount: number): string {
		const parts = getCalendarDateParts(date);
		const shifted = moveCalendarMonth(parts.year, parts.month, monthAmount);
		return canonicalDateFromParts(shifted.year, shifted.month, Math.min(parts.day, daysInMonth(shifted.year, shifted.month)));
	}

	private showDateMenu(date: string, items: CalendarItem[], event: MouseEvent | PointerEvent): void {
		const menu = new Menu();
		const existing = this.plugin.dailyNotes.find(date);
		menu.addItem((item) => item.setTitle(this.text('openDailyNote')).setIcon('calendar-check').setDisabled(!existing).onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item.setTitle(this.text('createDailyNote')).setIcon('calendar-plus').setDisabled(Boolean(existing)).onClick(() => this.plugin.dailyNotes.open(date)));
		menu.addItem((item) => item.setTitle(this.text('viewAgenda')).setIcon('list').onClick(() => this.showAgenda(date)));
		menu.addItem((item) => item.setTitle(this.text('createEvent')).setIcon('calendar-plus').setDisabled(!this.hasCreateProfile()).onClick(() => {
			new CreateEventModal(this.plugin, this.plugin.eventCreation, date).open();
		}));
		if (items.length > 0) {
			menu.addSeparator();
			for (const calendarItem of items) menu.addItem((item) => item.setTitle(calendarItem.title).setIcon(calendarItem.icon ?? 'calendar').onClick(() => this.openEvent(calendarItem, false)));
		}
		menu.showAtPosition({ x: event.clientX, y: event.clientY });
	}

	private showEventMenu(item: CalendarItem, event: MouseEvent): void {
		const menu = new Menu();
		menu.addItem((entry) => entry.setTitle(this.text('openNote')).setIcon('file-text').onClick(() => this.openEvent(item, false)));
		menu.addItem((entry) => entry.setTitle(this.text('openInNewTab')).setIcon('file-plus').onClick(() => this.openEvent(item, true)));
		menu.addItem((entry) => entry.setTitle(this.text('copyObsidianLink')).setIcon('copy').onClick(() => this.copyEventLink(item)));
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
		await navigator.clipboard.writeText(this.plugin.app.fileManager.generateMarkdownLink(file, ''));
		new Notice(this.text('copiedObsidianLink'));
	}

	private bindLongPress(button: HTMLButtonElement, date: string, items: CalendarItem[]): void {
		button.addEventListener('pointerdown', (event) => {
			if (event.pointerType === 'mouse') return;
			if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
			this.longPressTimer = window.setTimeout(() => { this.suppressNextClick = true; this.showDateMenu(date, items, event); }, 550);
		});
		for (const eventName of ['pointerup', 'pointercancel', 'pointerleave'] as const) button.addEventListener(eventName, () => {
			if (this.longPressTimer !== undefined) window.clearTimeout(this.longPressTimer);
			this.longPressTimer = undefined;
		});
	}

	private focusKeyForActiveElement(): string | undefined {
		const active = this.contentEl.ownerDocument.activeElement;
		if (!(active instanceof HTMLElement) || !this.contentEl.contains(active)) return undefined;
		this.focusFallbackDate = active.dataset.date ?? active.closest<HTMLElement>('.calendar-note-date-cell')?.dataset.date;
		return active.dataset.focusKey;
	}

	private restoreFocus(key?: string): void {
		if (!key) return;
		let target = this.focusTargets.get(key);
		if (!target && this.focusFallbackDate) target = this.focusTargets.get(`date:${this.focusFallbackDate}`);
		this.focusFallbackDate = undefined;
		window.setTimeout(() => target?.isConnected && target.focus(), 0);
	}

	private hasValidSourceProfile(): boolean {
		return this.plugin.settings.sourceProfiles.some((profile) => profile.enabled && profile.startProperty.trim() &&
			(hasSourceConditions(profile) || profile.matchFilesWithStartPropertyOnly));
	}

	private hasCreateProfile(): boolean {
		return this.plugin.settings.sourceProfiles.some((profile) => profile.enabled && profile.allowCreate && profile.startProperty.trim());
	}

	private dateLabel(date: string): string {
		return formatCalendarDate(date, this.plugin.settings.displayDateFormat) ?? date;
	}

	private monthLabel(): string {
		return `${calendarMonthLabels(this.plugin.settings.calendarLocale)[this.month - 1] ?? this.month} ${this.year}`;
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}
