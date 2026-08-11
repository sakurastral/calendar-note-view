import type { BasesEntry, BasesPropertyId, Value } from 'obsidian';
import { compareCalendarDates, parseCalendarPropertyDate } from './date';
import type { CalendarItem } from './models';
import { isSafeCssColor, normalizeDisplayValue, normalizeWikiLinkTarget } from './value-normalizers';

export interface BasesCalendarPropertyMap {
	start: BasesPropertyId;
	end?: BasesPropertyId | null;
	title?: BasesPropertyId | null;
	type?: BasesPropertyId | null;
	icon?: BasesPropertyId | null;
	backgroundColor?: BasesPropertyId | null;
	textColor?: BasesPropertyId | null;
}

export interface BasesEntryLike {
	file: { path: string; basename: string };
	getValue(propertyId: BasesPropertyId): Value | null;
}

export type BasesNormalizationIssue = 'invalid-start' | 'invalid-end' | 'end-before-start' | 'unreadable-value';

export interface BasesNormalizationResult {
	item?: CalendarItem;
	issue?: BasesNormalizationIssue;
}

export interface BasesPropertyDetail {
	property: BasesPropertyId;
	displayName: string;
	value: Value;
	text: string;
}

export class BasesCalendarNormalizer {
	normalize(
		entry: BasesEntry | BasesEntryLike,
		properties: BasesCalendarPropertyMap,
		propertyDateFormat: string,
	): CalendarItem | undefined {
		return this.normalizeWithResult(entry, properties, propertyDateFormat).item;
	}

	normalizeWithResult(
		entry: BasesEntry | BasesEntryLike,
		properties: BasesCalendarPropertyMap,
		propertyDateFormat: string,
	): BasesNormalizationResult {
		let startRaw: unknown;
		let endRaw: unknown;
		try {
			startRaw = valueToRaw(entry.getValue(properties.start));
			endRaw = properties.end ? valueToRaw(entry.getValue(properties.end)) : undefined;
		} catch {
			return { issue: 'unreadable-value' };
		}
		const startDate = parseCalendarPropertyDate(startRaw, propertyDateFormat);
		if (!startDate) return { issue: 'invalid-start' };
		const endDate = isBlank(endRaw) ? startDate : parseCalendarPropertyDate(endRaw, propertyDateFormat);
		if (!endDate) return { issue: 'invalid-end' };
		if (compareCalendarDates(endDate, startDate) < 0) return { issue: 'end-before-start' };

		try {
			const title = properties.title
				? normalizeDisplayValue(valueToRaw(entry.getValue(properties.title))) ?? entry.file.basename
				: entry.file.basename;

			return { item: {
				id: `bases:${entry.file.path}`,
				filePath: entry.file.path,
				startDate,
				endDate,
				title,
				type: properties.type ? normalizeWikiLinkTarget(valueToRaw(entry.getValue(properties.type))) ?? undefined : undefined,
				icon: properties.icon ? normalizeDisplayValue(valueToRaw(entry.getValue(properties.icon))) ?? undefined : undefined,
				backgroundColor: this.color(entry, properties.backgroundColor),
				textColor: this.color(entry, properties.textColor),
				sourceProfileId: 'bases-calendar',
			} };
		} catch {
			return { issue: 'unreadable-value' };
		}
	}

	private color(entry: BasesEntry | BasesEntryLike, property: BasesPropertyId | null | undefined): string | undefined {
		if (!property) return undefined;
		const value = normalizeDisplayValue(valueToRaw(entry.getValue(property)));
		return value && isSafeCssColor(value) ? value : undefined;
	}
}

export function basesValueToRaw(value: Value | null): unknown {
	if (!value) return undefined;
	if (isListValue(value)) {
		const values: unknown[] = [];
		for (let index = 0; index < value.length(); index += 1) values.push(basesValueToRaw(value.get(index)));
		return values;
	}
	return value.toString();
}

export function basesValueToDisplayText(value: Value | null): string | null {
	const raw = basesValueToRaw(value);
	if (Array.isArray(raw)) {
		const values = raw.map((entry) => normalizeDisplayValue(entry)).filter((entry): entry is string => Boolean(entry));
		return values.length > 0 ? values.join(', ') : null;
	}
	return normalizeDisplayValue(raw);
}

export function basesPropertiesToDisplayText(
	entry: BasesEntry | BasesEntryLike,
	properties: readonly BasesPropertyId[],
	getDisplayName: (property: BasesPropertyId) => string,
): string {
	return properties.map((property) => {
		const value = basesValueToDisplayText(entry.getValue(property));
		return value ? `${getDisplayName(property)}: ${value}` : '';
	}).filter(Boolean).join(' · ');
}

export function basesPropertyDetails(
	entry: BasesEntry | BasesEntryLike,
	properties: readonly BasesPropertyId[],
	getDisplayName: (property: BasesPropertyId) => string,
): BasesPropertyDetail[] {
	const details: BasesPropertyDetail[] = [];
	for (const property of properties) {
		try {
			const value = entry.getValue(property);
			if (!value) continue;
			const text = basesValueToDisplayText(value);
			if (!text) continue;
			details.push({ property, displayName: getDisplayName(property), value, text });
		} catch {
			// A single faulty formula value must not prevent the rest of the event from rendering.
		}
	}
	return details;
}

function valueToRaw(value: Value | null): unknown {
	return basesValueToRaw(value);
}

function isListValue(value: Value): value is Value & { length(): number; get(index: number): Value } {
	const candidate = value as Value & { length?: unknown; get?: unknown };
	return typeof candidate.length === 'function' && typeof candidate.get === 'function';
}

function isBlank(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}
