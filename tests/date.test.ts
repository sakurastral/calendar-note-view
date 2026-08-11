import { describe, expect, it } from 'vitest';
import {
	calendarDayOrdinal,
	formatCalendarDate,
	getTodayCanonical,
	isCanonicalDate,
	isValidIanaTimeZone,
	parseCalendarDate,
	parseCalendarPropertyDate,
} from '../src/date';

describe('calendar dates', () => {
	it('strictly parses canonical and custom property formats', () => {
		expect(parseCalendarDate('2024-07-24')).toBe('2024-07-24');
		expect(parseCalendarDate('24/07/2024', 'DD/MM/YYYY')).toBe('2024-07-24');
		expect(formatCalendarDate('2024-07-24', 'MM/DD/YYYY')).toBe('07/24/2024');
	});

	it('supports leap years and rejects impossible dates', () => {
		expect(isCanonicalDate('2024-02-29')).toBe(true);
		expect(isCanonicalDate('2023-02-29')).toBe(false);
		expect(isCanonicalDate('2024-13-01')).toBe(false);
		expect(parseCalendarDate('2024-7-24')).toBeNull();
	});

	it('accepts datetime property values without shifting the written calendar date', () => {
		expect(parseCalendarPropertyDate('2026-08-09T23:30:00Z')).toBe('2026-08-09');
		expect(parseCalendarPropertyDate('2026-08-09 08:15+08:00')).toBe('2026-08-09');
		expect(parseCalendarPropertyDate('09/08/2026T12:30:45.123', 'DD/MM/YYYY')).toBe('2026-08-09');
		expect(parseCalendarPropertyDate('2026-08-09T24:00')).toBeNull();
		expect(parseCalendarPropertyDate('2026-08-09T10:60')).toBeNull();
	});

	it('calculates inclusive duration without converting dates to timestamps', () => {
		expect(calendarDayOrdinal('2024-07-26') - calendarDayOrdinal('2024-07-24') + 1).toBe(3);
	});

	it('determines today in UTC and custom IANA zones', () => {
		const instant = new Date('2024-07-24T16:30:00.000Z');
		expect(getTodayCanonical({ mode: 'utc' }, instant)).toBe('2024-07-24');
		expect(getTodayCanonical({ mode: 'custom', timeZone: 'Asia/Taipei' }, instant)).toBe('2024-07-25');
		expect(getTodayCanonical({ mode: 'custom', timeZone: 'America/New_York' }, instant)).toBe('2024-07-24');
	});

	it('validates IANA zones without changing date-only values', () => {
		expect(isValidIanaTimeZone('Asia/Taipei')).toBe(true);
		expect(isValidIanaTimeZone('Invalid/Zone')).toBe(false);
		expect(parseCalendarDate('2024-07-24')).toBe('2024-07-24');
	});
});
