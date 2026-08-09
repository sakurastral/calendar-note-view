import { isSupportedDateFormat, isValidIanaTimeZone } from './date';
import type {
	CalendarSettings,
	CalendarSourceProfile,
	CalendarTimeZone,
	CalendarTypeStyleRule,
} from './models';

export const DEFAULT_EVENT_PROFILE: CalendarSourceProfile = {
	id: 'default-events',
	name: 'Calendar events',
	enabled: false,
	kind: 'event',
	matchMode: 'all',
	folders: [],
	tags: [],
	wikiLinks: [],
	matchFilesWithStartPropertyOnly: false,
	startProperty: '',
	defaultIcon: 'calendar',
	allowCreate: false,
	createFolder: 'Events',
	fileNameTemplate: '{date-range} {title}',
	generatedTitleProperty: 'title',
	generatedTitleTemplate: '{date-range} {title}',
	titleDateFormat: 'YYYY-MM-DD',
};

export const DEFAULT_SETTINGS: CalendarSettings = {
	schemaVersion: 3,
	firstDayOfWeek: 0,
	weekendDays: [0, 6],
	timeZone: { mode: 'system' },
	displayDateFormat: 'YYYY-MM-DD',
	eventPropertyDateFormat: 'YYYY-MM-DD',
	confirmBeforeCreatingDailyNote: true,
	sidebarIndicatorMode: 'dots',
	maxIndicatorsPerDay: 3,
	sourceProfiles: [DEFAULT_EVENT_PROFILE],
	typeStyleRules: [],
};

export interface SettingsLoadResult {
	settings: CalendarSettings;
	migrated: boolean;
	warnings: string[];
}

export function loadCalendarSettings(raw: unknown): SettingsLoadResult {
	const warnings: string[] = [];
	if (!isRecord(raw)) return { settings: cloneDefaults(), migrated: raw !== null && raw !== undefined, warnings };

	const sourceProfiles = Array.isArray(raw.sourceProfiles)
		? raw.sourceProfiles.map((profile, index) => normalizeProfile(profile, index, warnings)).filter(isDefined)
		: [structuredClone(DEFAULT_EVENT_PROFILE)];
	const typeStyleRules = Array.isArray(raw.typeStyleRules)
		? raw.typeStyleRules.map((rule, index) => normalizeRule(rule, index, warnings)).filter(isDefined)
		: [];
	ensureUniqueIds(sourceProfiles, 'source profile', warnings);
	ensureUniqueIds(typeStyleRules, 'event type rule', warnings);
	const displayDateFormat = validFormat(raw.displayDateFormat, DEFAULT_SETTINGS.displayDateFormat, warnings, 'display date format');
	const eventPropertyDateFormat = validFormat(raw.eventPropertyDateFormat, DEFAULT_SETTINGS.eventPropertyDateFormat, warnings, 'event property date format');
	const firstDayOfWeek = Number.isInteger(raw.firstDayOfWeek) && Number(raw.firstDayOfWeek) >= 0 && Number(raw.firstDayOfWeek) <= 6
		? Number(raw.firstDayOfWeek)
		: DEFAULT_SETTINGS.firstDayOfWeek;
	const settings: CalendarSettings = {
		schemaVersion: 3,
		firstDayOfWeek,
		weekendDays: weekdayArray(raw.weekendDays, DEFAULT_SETTINGS.weekendDays),
		timeZone: normalizeTimeZone(raw.timeZone, warnings),
		displayDateFormat,
		eventPropertyDateFormat,
		confirmBeforeCreatingDailyNote: boolean(raw.confirmBeforeCreatingDailyNote, true),
		sidebarIndicatorMode: raw.sidebarIndicatorMode === 'icons' ? 'icons' : 'dots',
		maxIndicatorsPerDay: integerInRange(raw.maxIndicatorsPerDay, 1, 8, DEFAULT_SETTINGS.maxIndicatorsPerDay),
		sourceProfiles,
		typeStyleRules,
	};
	return {
		settings,
		migrated: raw.schemaVersion !== 3 || JSON.stringify(settings) !== JSON.stringify(raw),
		warnings,
	};
}

function normalizeProfile(raw: unknown, index: number, warnings: string[]): CalendarSourceProfile | undefined {
	if (!isRecord(raw)) {
		warnings.push(`Source profile ${index + 1} was ignored because it is invalid.`);
		return undefined;
	}
	const fallbackId = `profile-${index + 1}`;
	const id = text(raw.id) ?? fallbackId;
	const startProperty = text(raw.startProperty) ?? '';
	return {
		id,
		name: text(raw.name) ?? id,
		enabled: boolean(raw.enabled, true),
		kind: raw.kind === 'task' ? 'task' : 'event',
		matchMode: raw.matchMode === 'any' ? 'any' : 'all',
		folders: stringArray(raw.folders),
		tags: stringArray(raw.tags),
		wikiLinks: stringArray(raw.wikiLinks ?? raw.wikiLinkTargets),
		matchFilesWithStartPropertyOnly: boolean(raw.matchFilesWithStartPropertyOnly, false),
		startProperty,
		endProperty: text(raw.endProperty),
		titleProperty: text(raw.titleProperty),
		typeProperty: text(raw.typeProperty),
		iconProperty: text(raw.iconProperty),
		colorProperty: text(raw.colorProperty),
		textColorProperty: text(raw.textColorProperty),
		completedProperty: text(raw.completedProperty),
		defaultType: text(raw.defaultType),
		defaultIcon: text(raw.defaultIcon),
		defaultBackgroundColor: text(raw.defaultBackgroundColor),
		defaultTextColor: text(raw.defaultTextColor),
		allowCreate: boolean(raw.allowCreate, false),
		createFolder: text(raw.createFolder),
		noteTemplatePath: text(raw.noteTemplatePath),
		fileNameTemplate: migrateEventTemplate(raw.fileNameTemplate),
		generatedTitleProperty: text(raw.generatedTitleProperty),
		generatedTitleTemplate: migrateEventTemplate(raw.generatedTitleTemplate),
		titleDateFormat: text(raw.titleDateFormat),
	};
}

function normalizeRule(raw: unknown, index: number, warnings: string[]): CalendarTypeStyleRule | undefined {
	if (!isRecord(raw) || !text(raw.typeValue)) {
		warnings.push(`Event type rule ${index + 1} was ignored because it is invalid.`);
		return undefined;
	}
	return {
		id: text(raw.id) ?? `type-rule-${index + 1}`,
		enabled: boolean(raw.enabled, true),
		typeValue: text(raw.typeValue) ?? '',
		icon: text(raw.icon),
		backgroundColor: text(raw.backgroundColor),
		textColor: text(raw.textColor),
	};
}

function normalizeTimeZone(raw: unknown, warnings: string[]): CalendarTimeZone {
	if (!isRecord(raw) || raw.mode === 'system') return { mode: 'system' };
	if (raw.mode === 'utc') return { mode: 'utc' };
	if (raw.mode === 'custom' && text(raw.timeZone) && isValidIanaTimeZone(String(raw.timeZone))) {
		return { mode: 'custom', timeZone: String(raw.timeZone).trim() };
	}
	warnings.push('The time zone setting was invalid and was reset to System.');
	return { mode: 'system' };
}

function validFormat(raw: unknown, fallback: string, warnings: string[], label: string): string {
	if (typeof raw === 'string' && isSupportedDateFormat(raw)) return raw;
	if (raw !== undefined) warnings.push(`The ${label} was invalid and was reset.`);
	return fallback;
}

function cloneDefaults(): CalendarSettings {
	return structuredClone(DEFAULT_SETTINGS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function migrateEventTemplate(value: unknown): string | undefined {
	const template = text(value);
	return template === '{date-range}《{title}》' ? '{date-range} {title}' : template;
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
}

function boolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function integerInRange(value: unknown, minimum: number, maximum: number, fallback: number): number {
	return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : fallback;
}

function weekdayArray(value: unknown, fallback: number[]): number[] {
	if (!Array.isArray(value)) return [...fallback];
	const result = [...new Set(value.filter((entry): entry is number =>
		Number.isInteger(entry) && entry >= 0 && entry <= 6))].sort((left, right) => left - right);
	return result.length > 0 ? result : [...fallback];
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

function ensureUniqueIds(values: Array<{ id: string }>, label: string, warnings: string[]): void {
	const seen = new Set<string>();
	for (const [index, value] of values.entries()) {
		if (!seen.has(value.id)) {
			seen.add(value.id);
			continue;
		}
		const base = value.id;
		let suffix = index + 1;
		while (seen.has(`${base}-${suffix}`)) suffix += 1;
		value.id = `${base}-${suffix}`;
		seen.add(value.id);
		warnings.push(`A duplicate ${label} ID was changed to ${value.id}.`);
	}
}
