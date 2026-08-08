import { formatCalendarDate, getCalendarDateParts, isCanonicalDate } from './date';
import type { CalendarSourceProfile } from './models';
import { normalizeWikiLinkTarget } from './value-normalizers';

export interface EventTemplateValues {
	title: string;
	startDate: string;
	endDate: string;
	type?: string;
	profile: CalendarSourceProfile;
}

export interface EventTemplatePreview {
	generatedTitle: string;
	fileName: string;
	createFolder: string;
	templatePath: string;
}

export function applyEventTemplate(template: string, values: EventTemplateValues): string {
	if (!isCanonicalDate(values.startDate) || !isCanonicalDate(values.endDate) || values.endDate < values.startDate) {
		throw new TypeError('Expected a valid event date range.');
	}
	const titleFormat = values.profile.titleDateFormat ?? 'YYYY-MM-DD';
	const start = formatCalendarDate(values.startDate, titleFormat) ?? values.startDate;
	const end = formatCalendarDate(values.endDate, titleFormat) ?? values.endDate;
	const dateRange = values.startDate === values.endDate ? start : `${start}～${end}`;
	const { year, month, day } = getCalendarDateParts(values.startDate);
	const replacements: Record<string, string> = {
		'{title}': values.title.trim(),
		'{start-date}': start,
		'{end-date}': end,
		'{date-range}': dateRange,
		'{year}': String(year).padStart(4, '0'),
		'{month}': String(month).padStart(2, '0'),
		'{day}': String(day).padStart(2, '0'),
		'{type}': values.type?.trim() ?? '',
		'{type-name}': normalizeWikiLinkTarget(values.type) ?? '',
		'{profile}': values.profile.name,
	};
	return Object.entries(replacements).reduce(
		(result, [variable, replacement]) => result.split(variable).join(replacement),
		template,
	);
}

export function getEventTemplatePreview(values: EventTemplateValues): EventTemplatePreview {
	const titleTemplate = values.profile.generatedTitleTemplate ?? '{date-range}《{title}》';
	const fileTemplate = values.profile.fileNameTemplate ?? '{date-range}《{title}》';
	return {
		generatedTitle: applyEventTemplate(titleTemplate, values),
		fileName: `${sanitizeFileName(applyEventTemplate(fileTemplate, values))}.md`,
		createFolder: normalizeVaultPath(values.profile.createFolder ?? ''),
		templatePath: normalizeVaultPath(values.profile.noteTemplatePath ?? ''),
	};
}

export function sanitizeFileName(value: string): string {
	const sanitized = value
		.replace(/[\\/:*?"<>|]/g, '-')
		.split('')
		.filter((character) => character.charCodeAt(0) >= 32)
		.join('')
		.replace(/\s+/g, ' ')
		.replace(/[. ]+$/g, '')
		.trim();
	return sanitized || 'Untitled event';
}

export function normalizeVaultPath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/').trim();
}
