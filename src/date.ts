import type { CalendarTimeZone } from './models';
import { stringifyScalar } from './value-normalizers';

export const CANONICAL_DATE_FORMAT = 'YYYY-MM-DD';

export function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
	const values = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return values[month - 1] ?? 0;
}

export function isCanonicalDate(value: string): boolean {
	return parseCalendarDate(value, CANONICAL_DATE_FORMAT) !== null;
}

export function isSupportedDateFormat(format: string): boolean {
	return buildDatePattern(format) !== null;
}

export function parseCalendarDate(value: unknown, format = CANONICAL_DATE_FORMAT): string | null {
	if (value === null || value === undefined) return null;
	const input = stringifyScalar(value)?.trim();
	if (!input) return null;
	const pattern = buildDatePattern(format);
	if (!pattern) return null;
	const match = pattern.regex.exec(input);
	if (!match?.groups) return null;
	const year = Number(match.groups.year);
	const month = Number(match.groups.month);
	const day = Number(match.groups.day);
	if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatCalendarDate(canonicalDate: string, format: string): string | null {
	if (!isCanonicalDate(canonicalDate) || !isSupportedDateFormat(format)) return null;
	const [year = '', month = '', day = ''] = canonicalDate.split('-');
	return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
}

export function compareCalendarDates(left: string, right: string): number {
	if (!isCanonicalDate(left) || !isCanonicalDate(right)) throw new TypeError('Expected canonical calendar dates.');
	return left.localeCompare(right);
}

export function calendarDayOrdinal(canonicalDate: string): number {
	if (!isCanonicalDate(canonicalDate)) throw new TypeError('Expected a canonical calendar date.');
	const [yearText, monthText, dayText] = canonicalDate.split('-');
	let year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	year -= month <= 2 ? 1 : 0;
	const era = Math.floor(year / 400);
	const yearOfEra = year - era * 400;
	const monthPrime = month + (month > 2 ? -3 : 9);
	const dayOfYear = Math.floor((153 * monthPrime + 2) / 5) + day - 1;
	const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
	return era * 146097 + dayOfEra;
}

export function isValidIanaTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format();
		return timeZone.trim().length > 0;
	} catch {
		return false;
	}
}

export function getTodayCanonical(timeZone: CalendarTimeZone, now = new Date()): string {
	if (timeZone.mode === 'system') {
		return toCanonicalParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
	}
	if (timeZone.mode === 'utc') {
		return toCanonicalParts(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
	}
	if (!isValidIanaTimeZone(timeZone.timeZone)) throw new TypeError('Invalid IANA time zone.');
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: timeZone.timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now);
	const value = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${value('year')}-${value('month')}-${value('day')}`;
}

function toCanonicalParts(year: number, month: number, day: number): string {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildDatePattern(format: string): { regex: RegExp } | null {
	const tokens = ['YYYY', 'MM', 'DD'] as const;
	if (tokens.some((token) => format.split(token).length !== 2)) return null;
	let source = '';
	let index = 0;
	const tokenPattern = /YYYY|MM|DD/g;
	for (const match of format.matchAll(tokenPattern)) {
		const token = match[0];
		const tokenIndex = match.index;
		source += escapeRegex(format.slice(index, tokenIndex));
		source += token === 'YYYY' ? '(?<year>\\d{4})' : token === 'MM' ? '(?<month>\\d{2})' : '(?<day>\\d{2})';
		index = tokenIndex + token.length;
	}
	source += escapeRegex(format.slice(index));
	return { regex: new RegExp(`^${source}$`) };
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
