import { describe, expect, it } from 'vitest';
import { calendarMonthLabels, calendarText, calendarWeekdayLabels } from '../src/calendar-locale';

describe('calendar locale', () => {
	it('localizes calendar controls and interpolated status text', () => {
		expect(calendarText('zh-TW', 'today')).toBe('今天');
		expect(calendarText('ja', 'createEventOn', { date: '2026-08-09' })).toBe('2026-08-09 にイベントを作成');
		expect(calendarText('ko', 'more', { count: 3 })).toBe('3개 더 보기');
	});

	it('uses the selected locale for month and weekday labels', () => {
		const months = calendarMonthLabels('en');
		const weekdays = calendarWeekdayLabels('zh-TW');
		expect(months).toHaveLength(12);
		expect(months[0]?.toLowerCase()).toContain('jan');
		expect(weekdays).toHaveLength(7);
		expect(weekdays[0]).toMatch(/週日|周日|星期日/);
	});

	it('resolves System default from the supplied browser locale', () => {
		expect(calendarText('system', 'nextMonth', {}, 'zh-TW')).toBe('下個月');
		expect(calendarText('system', 'nextMonth', {}, 'fr-FR')).toBe('Next month');
	});
});
