import type { CalendarDiagnostic, CalendarDiagnosticSeverity } from './models';

export function createDiagnostic(
	diagnostic: Omit<CalendarDiagnostic, 'id'>,
): CalendarDiagnostic {
	return {
		...diagnostic,
		id: [diagnostic.filePath, diagnostic.sourceProfileId, diagnostic.code, diagnostic.propertyName ?? ''].join('::'),
	};
}

export class CalendarDiagnosticsService {
	private readonly diagnostics = new Map<string, CalendarDiagnostic>();

	getAll(): CalendarDiagnostic[] {
		return this.sorted(this.diagnostics.values());
	}

	getByFile(filePath: string): CalendarDiagnostic[] {
		return this.sorted([...this.diagnostics.values()].filter((item) => item.filePath === filePath));
	}

	getByProfile(profileId: string): CalendarDiagnostic[] {
		return this.sorted([...this.diagnostics.values()].filter((item) => item.sourceProfileId === profileId));
	}

	getBySeverity(severity: CalendarDiagnosticSeverity): CalendarDiagnostic[] {
		return this.sorted([...this.diagnostics.values()].filter((item) => item.severity === severity));
	}

	replaceForFileAndProfile(filePath: string, profileId: string, diagnostics: CalendarDiagnostic[]): void {
		for (const item of this.diagnostics.values()) {
			if (item.filePath === filePath && item.sourceProfileId === profileId) this.diagnostics.delete(item.id);
		}
		for (const diagnostic of diagnostics) this.diagnostics.set(diagnostic.id, diagnostic);
	}

	removeForFile(filePath: string): void {
		for (const diagnostic of this.diagnostics.values()) {
			if (diagnostic.filePath === filePath) this.diagnostics.delete(diagnostic.id);
		}
	}

	removeForProfile(profileId: string): void {
		for (const diagnostic of this.diagnostics.values()) {
			if (diagnostic.sourceProfileId === profileId) this.diagnostics.delete(diagnostic.id);
		}
	}

	clear(): void {
		this.diagnostics.clear();
	}

	private sorted(values: Iterable<CalendarDiagnostic>): CalendarDiagnostic[] {
		return [...values].sort((left, right) => left.id.localeCompare(right.id));
	}
}
