import {
	addCalendarDays,
	canonicalDateFromParts,
	daysInMonth,
	getCalendarDateParts,
	weekdayForCalendarDate,
} from './date';

export interface CalendarMonthCell {
	date: string;
	day: number;
	weekday: number;
	inCurrentMonth: boolean;
	isWeekend: boolean;
}

export interface CalendarMonthGrid {
	year: number;
	month: number;
	label: string;
	weekdays: number[];
	cells: CalendarMonthCell[];
}

export function buildCalendarMonthGrid(
	year: number,
	month: number,
	firstDayOfWeek: number,
	weekendDays: number[],
): CalendarMonthGrid {
	if (!Number.isInteger(firstDayOfWeek) || firstDayOfWeek < 0 || firstDayOfWeek > 6) {
		throw new TypeError('Expected first day of week from 0 through 6.');
	}
	canonicalDateFromParts(year, month, 1);
	const firstDate = canonicalDateFromParts(year, month, 1);
	const leadingDays = (weekdayForCalendarDate(firstDate) - firstDayOfWeek + 7) % 7;
	const gridStart = addCalendarDays(firstDate, -leadingDays);
	const weekend = new Set(weekendDays);
	const cells = Array.from({ length: 42 }, (_, index) => {
		const date = addCalendarDays(gridStart, index);
		const parts = getCalendarDateParts(date);
		const weekday = weekdayForCalendarDate(date);
		return {
			date,
			day: parts.day,
			weekday,
			inCurrentMonth: parts.year === year && parts.month === month,
			isWeekend: weekend.has(weekday),
		};
	});
	return {
		year,
		month,
		label: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
		weekdays: Array.from({ length: 7 }, (_, index) => (firstDayOfWeek + index) % 7),
		cells,
	};
}

export function moveCalendarMonth(year: number, month: number, amount: number): { year: number; month: number } {
	if (!Number.isInteger(amount)) throw new TypeError('Expected an integer month offset.');
	const absolute = year * 12 + (month - 1) + amount;
	const nextYear = Math.floor(absolute / 12);
	const nextMonth = ((absolute % 12) + 12) % 12 + 1;
	canonicalDateFromParts(nextYear, nextMonth, Math.min(1, daysInMonth(nextYear, nextMonth)));
	return { year: nextYear, month: nextMonth };
}
