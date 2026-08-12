import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	CALENDAR_LOCALE_OPTIONS,
	calendarMonthLabels,
	calendarText,
	calendarWeekdayLabels,
	setCalendarObsidianLocale,
} from '../src/calendar-locale';

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

	it('resolves the legacy system value from the supplied Obsidian locale', () => {
		expect(calendarText('system', 'nextMonth', {}, 'zh-TW')).toBe('下個月');
		expect(calendarText('system', 'nextMonth', {}, 'fr-FR')).toBe('Next month');
	});

	it('follows the configured Obsidian app language by default', () => {
		setCalendarObsidianLocale('zh-TW');
		expect(CALENDAR_LOCALE_OPTIONS.system).toBe('Obsidian language');
		expect(calendarText('system', 'nextMonth')).toBe('下個月');
		expect(calendarMonthLabels('system')[0]).toMatch(/1月|一月/);
		setCalendarObsidianLocale('en');
	});

	it('initializes the default locale from the public Obsidian language API', () => {
		const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
		expect(main).toContain('getLanguage');
		expect(main).toContain('setCalendarObsidianLocale(getLanguage())');
		expect(readFileSync(new URL('../src/calendar-locale.ts', import.meta.url), 'utf8')).not.toContain('navigator.language');
	});

	it('localizes Agenda, creation, empty state, and invalid-entry UI', () => {
		expect(calendarText('zh-TW', 'agendaTitle', { date: '2026-08-09', count: 2 })).toBe('2026-08-09 · 2 個事件');
		expect(calendarText('zh-CN', 'baseQueryEmpty')).toBe('当前 Base 查询没有条目。');
		expect(calendarText('ja', 'baseCreateTitle')).toBe('Base イベントを作成');
		expect(calendarText('ko', 'skippedInvalidEntries', { count: 3 })).toBe('날짜가 잘못되어 3개 항목을 건너뛰었습니다.');
	});
});
