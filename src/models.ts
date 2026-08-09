export type CalendarItemKind = 'event' | 'task';

export interface CalendarItem {
	id: string;
	filePath: string;
	kind: CalendarItemKind;
	startDate: string;
	endDate: string;
	title: string;
	type?: string;
	icon?: string;
	backgroundColor?: string;
	textColor?: string;
	completed?: boolean;
	sourceProfileId?: string;
}

export interface CalendarSourceProfile {
	id: string;
	name: string;
	enabled: boolean;
	kind: CalendarItemKind;
	matchMode: 'all' | 'any';
	folders: string[];
	tags: string[];
	wikiLinks: string[];
	matchFilesWithStartPropertyOnly?: boolean;
	startProperty: string;
	endProperty?: string;
	titleProperty?: string;
	typeProperty?: string;
	iconProperty?: string;
	colorProperty?: string;
	textColorProperty?: string;
	completedProperty?: string;
	defaultType?: string;
	defaultIcon?: string;
	defaultBackgroundColor?: string;
	defaultTextColor?: string;
	allowCreate: boolean;
	createFolder?: string;
	noteTemplatePath?: string;
	fileNameTemplate?: string;
	generatedTitleProperty?: string;
	generatedTitleTemplate?: string;
	titleDateFormat?: string;
}

export interface CalendarTypeStyleRule {
	id: string;
	enabled: boolean;
	typeValue: string;
	icon?: string;
	backgroundColor?: string;
	textColor?: string;
}

export type CalendarTimeZone =
	| { mode: 'system' }
	| { mode: 'utc' }
	| { mode: 'custom'; timeZone: string };

export interface CalendarSettings {
	schemaVersion: 4;
	firstDayOfWeek: number;
	weekendDays: number[];
	timeZone: CalendarTimeZone;
	displayDateFormat: string;
	eventPropertyDateFormat: string;
	confirmBeforeCreatingDailyNote: boolean;
	sidebarIndicatorMode: 'icons' | 'dots';
	maxIndicatorsPerDay: number;
	sourceProfiles: CalendarSourceProfile[];
	typeStyleRules: CalendarTypeStyleRule[];
}

export type CalendarDiagnosticSeverity = 'info' | 'warning' | 'error';

export type CalendarDiagnosticCode =
	| 'invalid-start-date'
	| 'invalid-end-date'
	| 'end-before-start'
	| 'missing-title-fallback'
	| 'empty-source-profile'
	| 'invalid-color'
	| 'unknown-icon'
	| 'missing-start-property';

export interface CalendarDiagnostic {
	id: string;
	code: CalendarDiagnosticCode;
	severity: CalendarDiagnosticSeverity;
	message: string;
	filePath: string;
	sourceProfileId: string;
	propertyName?: string;
	rawValue?: unknown;
}

export interface CalendarFileData {
	path: string;
	basename: string;
	extension: string;
}

export interface CalendarMetadata {
	frontmatter?: Record<string, unknown>;
	tags?: Array<{ tag: string }>;
	links?: Array<{ link: string }>;
	embeds?: Array<{ link: string }>;
	frontmatterLinks?: Array<{ link: string }>;
}

export interface ResolvedCalendarItemStyle {
	icon: string;
	backgroundColor: string;
	textColor: string;
}
