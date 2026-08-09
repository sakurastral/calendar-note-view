import type { CalendarDiagnostic, CalendarDiagnosticSeverity } from './models';

export function createDiagnostic(
	diagnostic: Omit<CalendarDiagnostic, 'id'>,
): CalendarDiagnostic {
	return {
		...diagnostic,
		id: [diagnostic.filePath, diagnostic.sourceProfileId, diagnostic.code, diagnostic.propertyName ?? ''].join('::'),
	};
}

type DiagnosticScope = 'normalization' | 'style';

export class CalendarDiagnosticsService {
	private readonly diagnosticsByScope = new Map<string, Map<string, CalendarDiagnostic>>();

	getAll(): CalendarDiagnostic[] {
		return this.sorted(this.aggregate().values());
	}

	getByFile(filePath: string): CalendarDiagnostic[] {
		return this.sorted([...this.aggregate().values()].filter((item) => item.filePath === filePath));
	}

	getByProfile(profileId: string): CalendarDiagnostic[] {
		return this.sorted([...this.aggregate().values()].filter((item) => item.sourceProfileId === profileId));
	}

	getBySeverity(severity: CalendarDiagnosticSeverity): CalendarDiagnostic[] {
		return this.sorted([...this.aggregate().values()].filter((item) => item.severity === severity));
	}

	replaceForFileAndProfile(filePath: string, profileId: string, diagnostics: CalendarDiagnostic[]): void {
		this.replaceScope('normalization', filePath, profileId, diagnostics);
	}

	replaceStyleForFileAndProfile(filePath: string, profileId: string, diagnostics: CalendarDiagnostic[]): void {
		this.replaceScope('style', filePath, profileId, diagnostics);
	}

	removeStyleForProfile(profileId: string): void {
		this.removeMatching((_diagnostic, scope) => scope.startsWith(`style::`) && scope.endsWith(`::${profileId}`));
	}

	removeForFile(filePath: string): void {
		this.removeMatching((diagnostic) => diagnostic.filePath === filePath);
	}

	removeForProfile(profileId: string): void {
		this.removeMatching((diagnostic) => diagnostic.sourceProfileId === profileId);
	}

	clear(): void {
		this.diagnosticsByScope.clear();
	}

	private replaceScope(
		scope: DiagnosticScope,
		filePath: string,
		profileId: string,
		diagnostics: CalendarDiagnostic[],
	): void {
		const key = `${scope}::${filePath}::${profileId}`;
		if (diagnostics.length === 0) {
			this.diagnosticsByScope.delete(key);
			return;
		}
		this.diagnosticsByScope.set(key, new Map(diagnostics.map((diagnostic) => [diagnostic.id, diagnostic])));
	}

	private aggregate(): Map<string, CalendarDiagnostic> {
		const result = new Map<string, CalendarDiagnostic>();
		for (const diagnostics of this.diagnosticsByScope.values()) {
			for (const diagnostic of diagnostics.values()) result.set(diagnostic.id, diagnostic);
		}
		return result;
	}

	private removeMatching(predicate: (diagnostic: CalendarDiagnostic, scope: string) => boolean): void {
		for (const [scope, diagnostics] of this.diagnosticsByScope) {
			for (const [id, diagnostic] of diagnostics) {
				if (predicate(diagnostic, scope)) diagnostics.delete(id);
			}
			if (diagnostics.size === 0) this.diagnosticsByScope.delete(scope);
		}
	}

	private sorted(values: Iterable<CalendarDiagnostic>): CalendarDiagnostic[] {
		return [...values].sort((left, right) => left.id.localeCompare(right.id));
	}
}
