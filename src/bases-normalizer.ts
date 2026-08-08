import type { BasesEntry, BasesPropertyId, ListValue, Value } from 'obsidian';
import { compareCalendarDates, parseCalendarDate } from './date';
import type { CalendarItem, CalendarItemKind } from './models';
import { isSafeCssColor, normalizeCompletedValue, normalizeDisplayValue, normalizeWikiLinkTarget } from './value-normalizers';

export interface BasesCalendarPropertyMap {
	start: BasesPropertyId;
	end?: BasesPropertyId | null;
	title?: BasesPropertyId | null;
	type?: BasesPropertyId | null;
	icon?: BasesPropertyId | null;
	backgroundColor?: BasesPropertyId | null;
	textColor?: BasesPropertyId | null;
	completed?: BasesPropertyId | null;
}

export interface BasesEntryLike {
	file: { path: string; basename: string };
	getValue(propertyId: BasesPropertyId): Value | null;
}

export class BasesCalendarNormalizer {
	normalize(
		entry: BasesEntry | BasesEntryLike,
		properties: BasesCalendarPropertyMap,
		propertyDateFormat: string,
	): CalendarItem | undefined {
		const startDate = parseCalendarDate(valueToRaw(entry.getValue(properties.start)), propertyDateFormat);
		if (!startDate) return undefined;
		const endRaw = properties.end ? valueToRaw(entry.getValue(properties.end)) : undefined;
		const endDate = isBlank(endRaw) ? startDate : parseCalendarDate(endRaw, propertyDateFormat);
		if (!endDate || compareCalendarDates(endDate, startDate) < 0) return undefined;

		const completed = properties.completed
			? normalizeCompletedValue(valueToRaw(entry.getValue(properties.completed)))
			: undefined;
		const kind: CalendarItemKind = completed === undefined ? 'event' : 'task';
		const title = properties.title
			? normalizeDisplayValue(valueToRaw(entry.getValue(properties.title))) ?? entry.file.basename
			: entry.file.basename;

		return {
			id: `bases:${entry.file.path}`,
			filePath: entry.file.path,
			kind,
			startDate,
			endDate,
			title,
			type: properties.type ? normalizeWikiLinkTarget(valueToRaw(entry.getValue(properties.type))) ?? undefined : undefined,
			icon: properties.icon ? normalizeDisplayValue(valueToRaw(entry.getValue(properties.icon))) ?? undefined : undefined,
			backgroundColor: this.color(entry, properties.backgroundColor),
			textColor: this.color(entry, properties.textColor),
			completed,
			sourceProfileId: 'bases-calendar',
		};
	}

	private color(entry: BasesEntry | BasesEntryLike, property: BasesPropertyId | null | undefined): string | undefined {
		if (!property) return undefined;
		const value = normalizeDisplayValue(valueToRaw(entry.getValue(property)));
		return value && isSafeCssColor(value) ? value : undefined;
	}
}

function valueToRaw(value: Value | null): unknown {
	if (!value) return undefined;
	const list = value as ListValue;
	if (typeof list.length === 'function' && typeof list.get === 'function') {
		const values: string[] = [];
		for (let index = 0; index < list.length(); index += 1) values.push(list.get(index).toString());
		return values;
	}
	return value.toString();
}

function isBlank(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}
