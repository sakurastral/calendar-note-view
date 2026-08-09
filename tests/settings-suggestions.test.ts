import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EVENT_PROFILE,
	loadCalendarSettings,
	parseWikiLinkList,
	removeSourceProfile,
	updateSourceProfile,
	updateTypeStyleRule,
} from '../src/settings-data';
import { rankSuggestions } from '../src/suggestion-ranking';

describe('settings infrastructure', () => {
	it('migrates partial legacy data and preserves valid values', () => {
		const result = loadCalendarSettings({
			displayDateFormat: 'DD/MM/YYYY',
			sourceProfiles: [{ id: 'events', name: 'Events', startProperty: 'start', folders: ['Events'] }],
		});
		expect(result.migrated).toBe(true);
		expect(result.settings.displayDateFormat).toBe('DD/MM/YYYY');
		expect(result.settings.schemaVersion).toBe(4);
		expect(result.settings.weekendDays).toEqual([0, 6]);
		expect(result.settings.confirmBeforeCreatingDailyNote).toBe(true);
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
		expect(result.settings.maxIndicatorsPerDay).toBe(3);
		expect(result.settings.sourceProfiles).toHaveLength(1);
		expect(result.settings.sourceProfiles[0]?.startProperty).toBe('');
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

	it('migrates legacy wiki-link targets to note-link matching', () => {
		const result = loadCalendarSettings({
			schemaVersion: 2,
			sourceProfiles: [{
				id: 'events', startProperty: 'start', wikiLinkProperty: 'type',
				wikiLinkTargets: ['[[Holiday]]', '[[Vacation]]'],
			}],
		});
		expect(result.settings.sourceProfiles[0]?.wikiLinks).toEqual(['[[Holiday]]', '[[Vacation]]']);
		expect(result.settings.schemaVersion).toBe(4);
	});

	it('migrates the previous default event templates', () => {
		const result = loadCalendarSettings({
			schemaVersion: 2,
			sourceProfiles: [{
				id: 'events', startProperty: 'start',
				fileNameTemplate: '{date-range}《{title}》',
				generatedTitleTemplate: '{date-range}《{title}》',
			}],
		});
		expect(result.settings.sourceProfiles[0]?.fileNameTemplate).toBe('{date-range} {title}');
		expect(result.settings.sourceProfiles[0]?.generatedTitleTemplate).toBe('{date-range} {title}');
	});

	it('ships blank property mappings and plain-space event templates', () => {
		expect(DEFAULT_EVENT_PROFILE.startProperty).toBe('');
		expect(DEFAULT_EVENT_PROFILE.endProperty).toBeUndefined();
		expect(DEFAULT_EVENT_PROFILE.fileNameTemplate).toBe('{date-range} {title}');
		expect(DEFAULT_EVENT_PROFILE.generatedTitleTemplate).toBe('{date-range} {title}');
		expect(DEFAULT_EVENT_PROFILE.defaultIcon).toBe('calendar');
		expect(DEFAULT_EVENT_PROFILE.defaultBackgroundColor).toBe('var(--background-secondary)');
		expect(DEFAULT_EVENT_PROFILE.defaultTextColor).toBe('var(--text-normal)');
		expect(JSON.stringify(DEFAULT_EVENT_PROFILE)).not.toContain('calendar-event-');
	});

	it('migrates source profiles to events and official Obsidian color variables', () => {
		const result = loadCalendarSettings({
			schemaVersion: 3,
			sourceProfiles: [{
				id: 'tasks', name: 'Tasks', kind: 'task', startProperty: 'due',
				completedProperty: 'done', defaultBackgroundColor: '#ff0000', defaultTextColor: 'white',
			}],
		});
		expect(result.settings.sourceProfiles[0]).toMatchObject({
			kind: 'event',
			defaultIcon: 'calendar',
			defaultBackgroundColor: 'var(--background-secondary)',
			defaultTextColor: 'var(--text-normal)',
		});
		expect(result.settings.sourceProfiles[0]?.completedProperty).toBeUndefined();
	});

	it('updates newly added profiles and type rules by stable ID', () => {
		const settings = loadCalendarSettings({
			schemaVersion: 4,
			sourceProfiles: [{ id: 'events', name: 'New source profile', startProperty: '' }],
			typeStyleRules: [{ id: 'holiday', typeValue: 'New type' }],
		}).settings;
		expect(updateSourceProfile(settings, 'events', (profile) => {
			profile.name = 'Holidays';
			profile.startProperty = 'start';
		})).toBe(true);
		expect(updateTypeStyleRule(settings, 'holiday', (rule) => { rule.typeValue = 'Holiday'; })).toBe(true);
		expect(settings.sourceProfiles[0]).toMatchObject({ name: 'Holidays', startProperty: 'start' });
		expect(settings.typeStyleRules[0]?.typeValue).toBe('Holiday');
	});

	it('parses one or more wiki links from a textarea', () => {
		expect(parseWikiLinkList('[[Holiday]]\n[[Vacation]]\n\n [[Trip]]')).toEqual([
			'[[Holiday]]', '[[Vacation]]', '[[Trip]]',
		]);
		expect(parseWikiLinkList('[[Holiday]], [[Vacation]]')).toEqual(['[[Holiday]]', '[[Vacation]]']);
	});

	it('removes one source profile by its stable ID', () => {
		const settings = loadCalendarSettings({
			schemaVersion: 3,
			sourceProfiles: [
				{ id: 'events', name: 'Events', startProperty: 'start' },
				{ id: 'tasks', name: 'Tasks', startProperty: 'due', kind: 'task' },
			],
		}).settings;

		expect(removeSourceProfile(settings, 'events')).toBe(true);
		expect(settings.sourceProfiles.map((profile) => profile.id)).toEqual(['tasks']);
		expect(removeSourceProfile(settings, 'missing')).toBe(false);
	});
});

describe('folder and property suggestions', () => {
	it('ranks prefix, substring, and fuzzy folder matches', () => {
		expect(rankSuggestions('Ev', ['Work', 'Events/Work', 'Events'])).toEqual(['Events', 'Events/Work']);
		expect(rankSuggestions('ehl', ['Events/Holidays', 'Events/Work'])).toEqual(['Events/Holidays']);
	});

	it('deduplicates and ranks property names', () => {
		expect(rankSuggestions('ev', ['title', 'event-end', 'event-start', 'event-start']))
			.toEqual(['event-end', 'event-start']);
	});
});
