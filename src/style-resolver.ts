import { getIconIds } from 'obsidian';
import { createDiagnostic } from './diagnostics';
import type {
	CalendarDiagnostic,
	CalendarItem,
	CalendarSourceProfile,
	CalendarTypeStyleRule,
	ResolvedCalendarItemStyle,
} from './models';
import { isSafeCssColor, normalizeWikiLinkTarget } from './value-normalizers';

export interface CalendarStyleResolution {
	style: ResolvedCalendarItemStyle;
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
		const icon = this.firstIcon([item.icon, rule?.icon, profile.defaultIcon, 'calendar'], item, profile, diagnostics);
		const backgroundColor = this.firstColor(
			[item.backgroundColor, rule?.backgroundColor, profile.defaultBackgroundColor,
				'var(--calendar-note-event-bg-resolved, var(--background-secondary))'],
			item,
			profile,
			diagnostics,
			'var(--background-secondary)',
		);
		const textColor = this.firstColor(
			[item.textColor, rule?.textColor, profile.defaultTextColor,
				'var(--calendar-note-event-text-resolved, var(--text-normal))'],
			item,
			profile,
			diagnostics,
			'var(--text-normal)',
		);
		return { style: { icon, backgroundColor, textColor }, diagnostics };
	}

	private firstIcon(
		values: Array<string | undefined>,
		item: CalendarItem,
		profile: CalendarSourceProfile,
		diagnostics: CalendarDiagnostic[],
	): string {
		for (const value of values) {
			const icon = value?.trim();
			if (!icon) continue;
			if (this.iconExists(icon)) return icon;
			diagnostics.push(createDiagnostic({
				code: 'unknown-icon', severity: 'warning', message: `Unknown icon: ${icon}`,
				filePath: item.filePath, sourceProfileId: profile.id, rawValue: icon,
			}));
		}
		return 'calendar';
	}

	private firstColor(
		values: Array<string | undefined>,
		item: CalendarItem,
		profile: CalendarSourceProfile,
		diagnostics: CalendarDiagnostic[],
		fallback: string,
	): string {
		for (const value of values) {
			if (!value) continue;
			if (isSafeCssColor(value)) return value.trim();
			diagnostics.push(createDiagnostic({
				code: 'invalid-color', severity: 'warning', message: `Invalid style color: ${value}`,
				filePath: item.filePath, sourceProfileId: profile.id, rawValue: value,
			}));
		}
		return fallback;
	}
}
