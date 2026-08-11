import { compareCalendarDates, parseCalendarPropertyDate } from './date';
import { createDiagnostic } from './diagnostics';
import type {
	CalendarDiagnostic,
	CalendarFileData,
	CalendarItem,
	CalendarMetadata,
	CalendarSourceProfile,
} from './models';
import {
	isSafeCssColor,
	normalizeDisplayValue,
	normalizeWikiLinkTarget,
	stringifyScalar,
} from './value-normalizers';

export interface CalendarNormalizationResult {
	item?: CalendarItem;
	diagnostics: CalendarDiagnostic[];
}

export class CalendarItemNormalizer {
	normalize(
		file: CalendarFileData,
		metadata: CalendarMetadata,
		profile: CalendarSourceProfile,
		propertyDateFormat: string,
	): CalendarNormalizationResult {
		const diagnostics: CalendarDiagnostic[] = [];
		const frontmatter = metadata.frontmatter ?? {};
		const startRaw = frontmatter[profile.startProperty];
		if (isBlank(startRaw)) {
			diagnostics.push(this.diagnostic('missing-start-property', 'warning', file, profile, 'The start property is missing.', profile.startProperty, startRaw));
			return { diagnostics };
		}
		const startDate = parseCalendarPropertyDate(startRaw, propertyDateFormat);
		if (!startDate) {
			diagnostics.push(this.diagnostic('invalid-start-date', 'error', file, profile, 'The start date is invalid.', profile.startProperty, startRaw));
			return { diagnostics };
		}

		let endDate = startDate;
		if (profile.endProperty) {
			const endRaw = frontmatter[profile.endProperty];
			if (!isBlank(endRaw)) {
				const parsedEnd = parseCalendarPropertyDate(endRaw, propertyDateFormat);
				if (!parsedEnd) {
					diagnostics.push(this.diagnostic('invalid-end-date', 'error', file, profile, 'The end date is invalid.', profile.endProperty, endRaw));
					return { diagnostics };
				}
				endDate = parsedEnd;
			}
		}
		if (compareCalendarDates(endDate, startDate) < 0) {
			diagnostics.push(this.diagnostic('end-before-start', 'error', file, profile, 'The end date is before the start date.', profile.endProperty));
			return { diagnostics };
		}

		const mappedTitle = profile.titleProperty ? normalizeDisplayValue(frontmatter[profile.titleProperty]) : null;
		const frontmatterTitle = normalizeDisplayValue(frontmatter.title);
		const title = mappedTitle ?? frontmatterTitle ?? file.basename;
		if (!mappedTitle && !frontmatterTitle) {
			diagnostics.push(this.diagnostic('missing-title-fallback', 'info', file, profile, 'The file basename is used as the event title.', profile.titleProperty));
		}

		const type = profile.typeProperty ? normalizeWikiLinkTarget(frontmatter[profile.typeProperty]) ?? undefined : undefined;
		const icon = profile.iconProperty ? normalizeDisplayValue(frontmatter[profile.iconProperty]) ?? undefined : undefined;
		const backgroundColor = this.normalizeColor(frontmatter, profile.colorProperty, file, profile, diagnostics);
		const textColor = this.normalizeColor(frontmatter, profile.textColorProperty, file, profile, diagnostics);
		return {
			item: {
				id: `${profile.id}:${file.path}`,
				filePath: file.path,
				startDate,
				endDate,
				title,
				type,
				icon,
				backgroundColor,
				textColor,
				sourceProfileId: profile.id,
			},
			diagnostics,
		};
	}

	private normalizeColor(
		frontmatter: Record<string, unknown>,
		property: string | undefined,
		file: CalendarFileData,
		profile: CalendarSourceProfile,
		diagnostics: CalendarDiagnostic[],
	): string | undefined {
		if (!property) return undefined;
		const raw = frontmatter[property];
		if (isBlank(raw)) return undefined;
		if (isSafeCssColor(raw)) return stringifyScalar(raw)?.trim();
		diagnostics.push(this.diagnostic('invalid-color', 'warning', file, profile, `The color in ${property} is unsafe or invalid.`, property, raw));
		return undefined;
	}

	private diagnostic(
		code: CalendarDiagnostic['code'],
		severity: CalendarDiagnostic['severity'],
		file: CalendarFileData,
		profile: CalendarSourceProfile,
		message: string,
		propertyName?: string,
		rawValue?: unknown,
	): CalendarDiagnostic {
		return createDiagnostic({ code, severity, message, filePath: file.path, sourceProfileId: profile.id, propertyName, rawValue });
	}
}

function isBlank(value: unknown): boolean {
	return value === undefined || value === null || (stringifyScalar(value)?.trim() ?? '') === '';
}
