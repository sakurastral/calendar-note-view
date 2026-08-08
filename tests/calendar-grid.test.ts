import { describe, expect, it } from 'vitest';
import { buildCalendarMonthGrid, moveCalendarMonth } from '../src/calendar-grid';
import { addCalendarDays, weekdayForCalendarDate } from '../src/date';

describe('calendar month grid', () => {
	it('builds six complete weeks with adjacent dates and a custom first weekday', () => {
		const grid = buildCalendarMonthGrid(2024, 7, 1, [0, 6]);
		expect(grid.cells).toHaveLength(42);
		expect(grid.weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]);
		expect(grid.cells[0]).toMatchObject({ date: '2024-07-01', inCurrentMonth: true, weekday: 1 });
		expect(grid.cells.at(-1)).toMatchObject({ date: '2024-08-11', inCurrentMonth: false });
	});

	it('marks configured weekend days without assuming Saturday and Sunday', () => {
		const grid = buildCalendarMonthGrid(2024, 7, 0, [5, 6]);
		expect(grid.cells.find((cell) => cell.date === '2024-07-05')?.isWeekend).toBe(true);
		expect(grid.cells.find((cell) => cell.date === '2024-07-07')?.isWeekend).toBe(false);
	});

	it('moves across year boundaries and performs date-only arithmetic', () => {
		expect(moveCalendarMonth(2024, 12, 1)).toEqual({ year: 2025, month: 1 });
		expect(moveCalendarMonth(2024, 1, -1)).toEqual({ year: 2023, month: 12 });
		expect(addCalendarDays('2024-02-28', 2)).toBe('2024-03-01');
		expect(weekdayForCalendarDate('2024-07-24')).toBe(3);
	});
});
