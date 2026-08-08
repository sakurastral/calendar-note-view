import { describe, expect, it } from 'vitest';
import { CalendarDiagnosticsService, createDiagnostic } from '../src/diagnostics';

describe('calendar diagnostics', () => {
	it('replaces stable per-file profile diagnostics without duplicates', () => {
		const service = new CalendarDiagnosticsService();
		const diagnostic = createDiagnostic({
			code: 'invalid-start-date', severity: 'error', message: 'Invalid',
			filePath: 'Events/Test.md', sourceProfileId: 'events', propertyName: 'start',
		});
		service.replaceForFileAndProfile('Events/Test.md', 'events', [diagnostic, diagnostic]);
		expect(service.getAll()).toHaveLength(1);
		expect(service.getByFile('Events/Test.md')).toHaveLength(1);
		expect(service.getByProfile('events')).toHaveLength(1);
		expect(service.getBySeverity('error')).toHaveLength(1);
	});

	it('removes diagnostics by file and profile', () => {
		const service = new CalendarDiagnosticsService();
		service.replaceForFileAndProfile('A.md', 'one', [createDiagnostic({ code: 'invalid-color', severity: 'warning', message: 'Invalid', filePath: 'A.md', sourceProfileId: 'one' })]);
		service.removeForFile('A.md');
		expect(service.getAll()).toEqual([]);
	});
});
