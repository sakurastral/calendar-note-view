import { describe, expect, it } from 'vitest';
import { loadCalendarSettings } from '../src/settings-data';
import { rankSuggestions } from '../src/suggestion-ranking';

describe('settings infrastructure', () => {
	it('migrates partial legacy data and preserves valid values', () => {
		const result = loadCalendarSettings({
			displayDateFormat: 'DD/MM/YYYY',
			sourceProfiles: [{ id: 'events', name: 'Events', startProperty: 'start', folders: ['Events'] }],
		});
		expect(result.migrated).toBe(true);
		expect(result.settings.displayDateFormat).toBe('DD/MM/YYYY');
		expect(result.settings.sourceProfiles[0]).toMatchObject({ id: 'events', startProperty: 'start', folders: ['Events'] });
	});

	it('recovers from invalid data without throwing', () => {
		const result = loadCalendarSettings({
			firstDayOfWeek: 99,
			timeZone: { mode: 'custom', timeZone: 'Invalid/Zone' },
			displayDateFormat: 'not-a-format',
			eventPropertyDateFormat: 42,
			sourceProfiles: [null, { id: 'missing-start' }],
			typeStyleRules: [{ id: 'missing-type' }],
		});
		expect(result.settings.firstDayOfWeek).toBe(0);
		expect(result.settings.timeZone).toEqual({ mode: 'system' });
		expect(result.settings.displayDateFormat).toBe('YYYY-MM-DD');
		expect(result.settings.sourceProfiles).toEqual([]);
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it('recovers duplicate profile IDs to prevent index collisions', () => {
		const result = loadCalendarSettings({
			sourceProfiles: [
				{ id: 'events', startProperty: 'start' },
				{ id: 'events', startProperty: 'start' },
			],
		});
		expect(result.settings.sourceProfiles.map((profile) => profile.id)).toEqual(['events', 'events-2']);
	});
});

describe('folder and property suggestions', () => {
	it('ranks prefix, substring, and fuzzy folder matches', () => {
		expect(rankSuggestions('Ev', ['Work', 'Events/Work', 'Events'])).toEqual(['Events', 'Events/Work']);
		expect(rankSuggestions('ehl', ['Events/Holidays', 'Events/Work'])).toEqual(['Events/Holidays']);
	});

	it('deduplicates and ranks property names', () => {
		expect(rankSuggestions('calendar', ['title', 'calendar-event-end', 'calendar-event-start', 'calendar-event-start']))
			.toEqual(['calendar-event-end', 'calendar-event-start']);
	});
});
