import type { BasesAllOptions } from 'obsidian';

export type BasesEventDisplayMode = 'icon-title' | 'title' | 'icon' | 'title-properties' | 'properties';
export type BasesWeekendPreset = 'plugin' | 'sat-sun' | 'fri-sat' | 'sunday' | 'saturday' | 'none';
export type BasesEventRowLimit = 'auto' | 'all' | `${number}`;
export type BasesLayoutDensity = 'auto' | 'comfortable' | 'compact';
export type BasesResponsiveSize = 'wide' | 'medium' | 'narrow';

export function getBasesCalendarOptions(): BasesAllOptions[] {
	const rowOptions: Record<string, string> = { auto: 'Automatic', all: 'Show all' };
	for (let rows = 1; rows <= 12; rows += 1) rowOptions[String(rows)] = `${rows} ${rows === 1 ? 'row' : 'rows'}`;
	return [{
		type: 'group',
		displayName: 'Required mapping',
		items: [
			{ type: 'property', key: 'startProperty', displayName: 'Start property', placeholder: 'Select a property' },
			{ type: 'property', key: 'endProperty', displayName: 'End property', placeholder: 'Select a property' },
		],
	}, {
		type: 'group',
		displayName: 'Event content',
		items: [
			{ type: 'property', key: 'titleProperty', displayName: 'Title property', placeholder: 'Select a property' },
			{ type: 'property', key: 'typeProperty', displayName: 'Type property', placeholder: 'Select a property' },
			{
				type: 'dropdown', key: 'eventDisplayMode', displayName: 'Event content mode', default: 'icon-title',
				options: {
					'icon-title': 'Icon + title', title: 'Title', icon: 'Icon',
					'title-properties': 'Title + visible Base properties', properties: 'Visible Base properties',
				},
			},
		],
	}, {
		type: 'group',
		displayName: 'Event styling',
		items: [
			{ type: 'property', key: 'iconProperty', displayName: 'Icon property', placeholder: 'Select a property' },
			{ type: 'property', key: 'backgroundColorProperty', displayName: 'Background color property', placeholder: 'Select a property' },
			{ type: 'property', key: 'textColorProperty', displayName: 'Text color property', placeholder: 'Select a property' },
		],
	}, {
		type: 'group',
		displayName: 'Calendar layout',
		items: [
			{ type: 'dropdown', key: 'firstDayOfWeek', displayName: 'First day of week', default: '0', options: { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' } },
			{
				type: 'dropdown', key: 'weekendPreset', displayName: 'Weekend preset', default: 'plugin',
				options: { plugin: 'Use plugin default', 'sat-sun': 'Saturday and Sunday', 'fri-sat': 'Friday and Saturday', sunday: 'Sunday only', saturday: 'Saturday only', none: 'No weekend' },
			},
			{ type: 'toggle', key: 'showAdjacentMonthDates', displayName: 'Show adjacent month dates', default: true },
			{ type: 'dropdown', key: 'eventRowLimit', displayName: 'Event row limit', default: 'auto', options: rowOptions },
			{ type: 'dropdown', key: 'layoutDensity', displayName: 'Layout density', default: 'auto', options: { auto: 'Automatic', comfortable: 'Comfortable', compact: 'Compact' } },
		],
	}, {
		type: 'group',
		displayName: 'Advanced',
		items: [
			{ type: 'toggle', key: 'showInvalidEntryNotice', displayName: 'Show invalid-entry summary', default: true },
		],
	}];
}

export function readEventDisplayMode(value: unknown): BasesEventDisplayMode {
	if (value === 'icon' || value === 'title' || value === 'properties' || value === 'title-properties') return value;
	return 'icon-title';
}

export function readWeekendDays(value: unknown, legacyValue: unknown, pluginDefault: readonly number[]): number[] {
	const preset = readWeekendPreset(value, legacyValue);
	if (preset === 'sat-sun') return [0, 6];
	if (preset === 'fri-sat') return [5, 6];
	if (preset === 'sunday') return [0];
	if (preset === 'saturday') return [6];
	if (preset === 'none') return [];
	return normalizeWeekdays(pluginDefault);
}

export function readWeekendPreset(value: unknown, legacyValue: unknown): BasesWeekendPreset {
	if (value === 'plugin' || value === 'sat-sun' || value === 'fri-sat' || value === 'sunday' || value === 'saturday' || value === 'none') return value;
	if (!Array.isArray(legacyValue)) return 'plugin';
	const days = normalizeWeekdays(legacyValue);
	if (sameDays(days, [0, 6])) return 'sat-sun';
	if (sameDays(days, [5, 6])) return 'fri-sat';
	if (sameDays(days, [0])) return 'sunday';
	if (sameDays(days, [6])) return 'saturday';
	if (days.length === 0) return 'none';
	return 'plugin';
}

export function readEventRowLimit(value: unknown, legacyValue: unknown): BasesEventRowLimit {
	if (value === 'auto' || value === 'all') return value;
	const parsed = parseInteger(value);
	if (parsed !== null && parsed >= 1 && parsed <= 12) return String(parsed) as BasesEventRowLimit;
	const legacy = parseInteger(legacyValue);
	return legacy !== null && legacy >= 1 && legacy <= 12 ? String(legacy) as BasesEventRowLimit : 'auto';
}

export function readLayoutDensity(value: unknown): BasesLayoutDensity {
	return value === 'comfortable' || value === 'compact' ? value : 'auto';
}

export function resolveResponsiveSize(width: number): BasesResponsiveSize {
	if (width < 560) return 'narrow';
	if (width < 820) return 'medium';
	return 'wide';
}

export function resolveCompactLayout(density: BasesLayoutDensity, size: BasesResponsiveSize): boolean {
	return density === 'compact' || (density === 'auto' && size === 'narrow');
}

export function resolveVisibleRows(limit: BasesEventRowLimit, density: BasesLayoutDensity, size: BasesResponsiveSize): number {
	if (limit === 'all') return Number.POSITIVE_INFINITY;
	const fixed = parseInteger(limit);
	if (fixed !== null) return fixed;
	if (density === 'compact' || size === 'narrow') return 1;
	if (size === 'medium') return 2;
	return density === 'comfortable' ? 5 : 4;
}

function normalizeWeekdays(value: readonly unknown[]): number[] {
	return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((left, right) => left - right);
}

function sameDays(left: readonly number[], right: readonly number[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseInteger(value: unknown): number | null {
	const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
	return Number.isInteger(parsed) ? Number(parsed) : null;
}
