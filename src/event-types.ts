import type { CalendarItem, CalendarSettings } from './models';

export function collectEventTypeValues(
	settings: Pick<CalendarSettings, 'sourceProfiles' | 'typeStyleRules'>,
	items: Iterable<Pick<CalendarItem, 'type'>> = [],
	additional: Iterable<string | undefined> = [],
): string[] {
	const values = new Set<string>();
	const add = (value: string | undefined): void => {
		const normalized = value?.trim();
		if (normalized) values.add(normalized);
	};
	for (const rule of settings.typeStyleRules) add(rule.typeValue);
	for (const profile of settings.sourceProfiles) add(profile.defaultType);
	for (const item of items) add(item.type);
	for (const value of additional) add(value);
	return [...values].sort((left, right) => left.localeCompare(right));
}
