import { getIconIds } from 'obsidian';
import { createDiagnostic } from './diagnostics';
import type {
	CalendarDiagnostic,
	CalendarItem,
	CalendarSourceProfile,
	CalendarTypeStyleRule,
	ResolvedCalendarItemStyle,
	ResolvedCalendarItemStyleSources,
} from './models';
import { isSafeCssColor, normalizeWikiLinkTarget } from './value-normalizers';

export interface CalendarStyleResolution {
	style: ResolvedCalendarItemStyle;
	sources: ResolvedCalendarItemStyleSources;
	diagnostics: CalendarDiagnostic[];
}

export class CalendarStyleResolver {
	constructor(private readonly iconExists: (icon: string) => boolean = (icon) => getIconIds().includes(icon)) {}

	resolve(
		item: CalendarItem,
		profile: CalendarSourceProfile,
		rules: CalendarTypeStyleRule[],
	): CalendarStyleResolution {
		const diagnostics: CalendarDiagnostic[] = [];
		const typeKey = normalizeWikiLinkTarget(item.type);
		const rule = rules.find((candidate) => candidate.enabled && normalizeWikiLinkTarget(candidate.typeValue) === typeKey);
		const iconResult = this.firstIcon([
			[item.icon, 'note'], [rule?.icon, 'type-rule'], [profile.defaultIcon, 'source-profile'], ['calendar', 'theme'],
		], item, profile, diagnostics);
		const backgroundResult = this.firstColor(
			[[item.backgroundColor, 'note'], [rule?.backgroundColor, 'type-rule'], [profile.defaultBackgroundColor, 'source-profile'],
				['var(--calendar-note-event-bg-resolved, var(--background-secondary))', 'style-settings']],
			item,
			profile,
			diagnostics,
			'var(--background-secondary)',
		);
		const textResult = this.firstColor(
			[[item.textColor, 'note'], [rule?.textColor, 'type-rule'], [profile.defaultTextColor, 'source-profile'],
				['var(--calendar-note-event-text-resolved, var(--text-normal))', 'style-settings']],
			item,
			profile,
			diagnostics,
			'var(--text-normal)',
		);
		return {
			style: { icon: iconResult.value, backgroundColor: backgroundResult.value, textColor: textResult.value },
			sources: { icon: iconResult.source, backgroundColor: backgroundResult.source, textColor: textResult.source },
			diagnostics,
		};
	}

	private firstIcon(
		values: Array<[string | undefined, ResolvedCalendarItemStyleSources['icon']]>,
		item: CalendarItem,
		profile: CalendarSourceProfile,
		diagnostics: CalendarDiagnostic[],
	): { value: string; source: ResolvedCalendarItemStyleSources['icon'] } {
		for (const [value, source] of values) {
			const icon = value?.trim();
			if (!icon) continue;
			if (this.iconExists(icon)) return { value: icon, source };
			diagnostics.push(createDiagnostic({
				code: 'unknown-icon', severity: 'warning', message: `Unknown icon: ${icon}`,
				filePath: item.filePath, sourceProfileId: profile.id, rawValue: icon,
			}));
		}
		return { value: 'calendar', source: 'theme' };
	}

	private firstColor(
		values: Array<[string | undefined, ResolvedCalendarItemStyleSources['backgroundColor']]>,
		item: CalendarItem,
		profile: CalendarSourceProfile,
		diagnostics: CalendarDiagnostic[],
		fallback: string,
	): { value: string; source: ResolvedCalendarItemStyleSources['backgroundColor'] } {
		for (const [value, source] of values) {
			if (!value) continue;
			if (isSafeCssColor(value)) return { value: value.trim(), source };
			diagnostics.push(createDiagnostic({
				code: 'invalid-color', severity: 'warning', message: `Invalid style color: ${value}`,
				filePath: item.filePath, sourceProfileId: profile.id, rawValue: value,
			}));
		}
		return { value: fallback, source: 'theme' };
	}
}
