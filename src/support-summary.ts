import type { CalendarDiagnostic } from './models';

export interface CalendarSupportSummaryInput {
	pluginVersion: string;
	obsidianApiVersion?: string;
	platform: 'Desktop' | 'Mobile';
	indexState: string;
	profileCount: number;
	enabledProfileCount: number;
	eventCount: number;
	diagnostics: readonly CalendarDiagnostic[];
	settingsSchemaVersion: number;
}

export function createCalendarSupportSummary(input: CalendarSupportSummaryInput, includeFilePaths = false): string {
	const codes = new Map<string, { severity: string; count: number }>();
	for (const diagnostic of input.diagnostics) {
		const key = `${diagnostic.severity}:${diagnostic.code}`;
		const current = codes.get(key) ?? { severity: diagnostic.severity, count: 0 };
		current.count += 1;
		codes.set(key, current);
	}
	const summary: Record<string, unknown> = {
		pluginVersion: input.pluginVersion,
		obsidianApiVersion: input.obsidianApiVersion,
		platform: input.platform,
		indexState: input.indexState,
		counts: {
			profiles: input.profileCount,
			enabledProfiles: input.enabledProfileCount,
			events: input.eventCount,
			diagnostics: input.diagnostics.length,
		},
		diagnostics: [...codes.entries()].map(([key, value]) => ({ code: key.split(':')[1], ...value })),
		settingsSchemaVersion: input.settingsSchemaVersion,
	};
	if (includeFilePaths) summary.filePaths = [...new Set(input.diagnostics.map((diagnostic) => diagnostic.filePath).filter(Boolean))];
	return JSON.stringify(summary, null, 2);
}
