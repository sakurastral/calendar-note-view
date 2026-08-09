import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	DEFAULT_EVENT_PROFILE,
	loadCalendarSettings,
	parseWikiLinkList,
	removeSourceProfile,
	updateSourceProfile,
	updateTypeStyleRule,
} from '../src/settings-data';
import {
	commitInputSuggestion,
	getFloatingSuggestionLayout,
	getLineQuery,
	replaceDelimitedInputSelection,
	replaceDelimitedInputValue,
	replaceLineInputSelection,
} from '../src/input-events';
import { rankSuggestions } from '../src/suggestion-ranking';
import {
	getSourceProfilePageName,
	moveSourceProfileToOrder,
	sortSourceProfiles,
} from '../src/source-profile';

describe('settings infrastructure', () => {
	it('generates and persists a stable ID for the first default profile', () => {
		const initial = loadCalendarSettings(null);
		expect(initial.migrated).toBe(true);
		expect(initial.settings.sourceProfiles[0]?.id).toMatch(/^profile-/);
		const reloaded = loadCalendarSettings(JSON.parse(JSON.stringify(initial.settings)));
		expect(reloaded.settings.sourceProfiles[0]?.id).toBe(initial.settings.sourceProfiles[0]?.id);
	});

	it('migrates partial legacy data and safely ignores removed task settings', () => {
		const result = loadCalendarSettings({
			schemaVersion: 4,
			displayDateFormat: 'DD/MM/YYYY',
			hideCompletedTasks: true,
			dimCompletedTasks: true,
			sourceProfiles: [{
				id: 'events', name: 'Events', kind: 'task', completedProperty: 'done',
				startProperty: 'start', folders: ['Events'],
			}],
		});
		expect(result.migrated).toBe(true);
		expect(result.settings.schemaVersion).toBe(7);
		expect(result.settings.displayDateFormat).toBe('DD/MM/YYYY');
		expect(result.settings.sourceProfiles[0]).toMatchObject({ id: 'events', startProperty: 'start', folders: ['Events'] });
		expect(JSON.stringify(result.settings)).not.toMatch(/kind|completed|hideCompleted|dimCompleted/);
	});

	it('round-trips every supported Source Profile field', () => {
		const rawProfile = {
			id: 'events', name: 'Events', order: 1, enabled: true, sidebarIndicatorMode: 'icons', matchMode: 'any', folders: ['Events'], tags: ['calendar'],
			wikiLinkProperty: 'event-type', wikiLinkTargets: ['[[Holiday]]'], matchFilesWithStartPropertyOnly: false,
			startProperty: 'start', endProperty: 'end', titleProperty: 'event-title', typeProperty: 'event-type',
			iconProperty: 'icon', colorProperty: 'color', textColorProperty: 'text-color', defaultType: 'Holiday',
			defaultIcon: 'calendar-days', defaultBackgroundColor: 'var(--color-red)', defaultTextColor: 'var(--text-on-accent)',
			allowCreate: true, createFolder: 'Events', noteTemplatePath: 'Templates/Event.md', fileNameTemplate: '{date-range} {title}',
			generatedTitleProperty: 'title', generatedTitleTemplate: '{date-range} {title}', titleDateFormat: 'YYYY-MM-DD',
		};
		const first = loadCalendarSettings({ schemaVersion: 7, sourceProfiles: [rawProfile], typeStyleRules: [] }).settings;
		const reloaded = loadCalendarSettings(JSON.parse(JSON.stringify(first))).settings;
		expect(reloaded.sourceProfiles[0]).toEqual(rawProfile);
	});

	it('preserves an explicit Style Settings fallback instead of forcing profile colors', () => {
		const defaults = structuredClone(DEFAULT_EVENT_PROFILE);
		expect(defaults.defaultBackgroundColor).toBeUndefined();
		expect(defaults.defaultTextColor).toBeUndefined();
		const migrated = loadCalendarSettings({
			sourceProfiles: [{ id: 'events', startProperty: 'start', defaultBackgroundColor: '#ff0000', defaultTextColor: 'white' }],
		}).settings.sourceProfiles[0];
		expect(migrated?.defaultBackgroundColor).toBeUndefined();
		expect(migrated?.defaultTextColor).toBeUndefined();
	});

	it('recovers invalid data and duplicate IDs without throwing', () => {
		const result = loadCalendarSettings({
			firstDayOfWeek: 99,
			timeZone: { mode: 'custom', timeZone: 'Invalid/Zone' },
			displayDateFormat: 'not-a-format',
			sourceProfiles: [{ id: 'events' }, { id: 'events' }],
			typeStyleRules: [{ id: 'missing-type' }],
		});
		expect(result.settings.firstDayOfWeek).toBe(0);
		expect(result.settings.timeZone).toEqual({ mode: 'system' });
		expect(result.settings.sourceProfiles[0]?.id).toBe('events');
		expect(result.settings.sourceProfiles[1]?.id).toMatch(/^profile-/);
		expect(new Set(result.settings.sourceProfiles.map((profile) => profile.id)).size).toBe(2);
		expect(result.warnings.length).toBeGreaterThan(0);
	});

	it('generates missing profile IDs and keeps duplicate display names independent', () => {
		const result = loadCalendarSettings({
			schemaVersion: 5,
			sourceProfiles: [
				{ name: 'Calendar', startProperty: 'start' },
				{ name: 'Calendar', startProperty: 'date' },
			],
		});
		const [first, second] = result.settings.sourceProfiles;
		expect(first?.id).toMatch(/^profile-/);
		expect(second?.id).toMatch(/^profile-/);
		expect(first?.id).not.toBe(second?.id);
		expect(first?.name).toBe('Calendar');
		expect(second?.name).toBe('Calendar');
		expect(getSourceProfilePageName(first!)).not.toBe(getSourceProfilePageName(second!));
	});

	it('migrates the former global Sidebar indicator mode into each Source Profile', () => {
		const result = loadCalendarSettings({
			schemaVersion: 6,
			sidebarIndicatorMode: 'icons',
			sourceProfiles: [
				{ id: 'legacy', name: 'Legacy', startProperty: 'start' },
				{ id: 'explicit', name: 'Explicit', sidebarIndicatorMode: 'dots', startProperty: 'date' },
			],
		});
		expect(result.settings.sourceProfiles.map((profile) => profile.sidebarIndicatorMode)).toEqual(['icons', 'dots']);
		expect(result.settings).not.toHaveProperty('sidebarIndicatorMode');
	});

	it('normalizes, moves, and persists explicit Source Profile order', () => {
		const settings = loadCalendarSettings({
			schemaVersion: 7,
			sourceProfiles: [
				{ id: 'second', name: 'Same name', order: 2, startProperty: 'start' },
				{ id: 'first', name: 'Same name', order: 1, startProperty: 'start' },
				{ id: 'third', name: 'Third', order: 3, startProperty: 'start' },
			],
		}).settings;
		expect(sortSourceProfiles(settings.sourceProfiles).map((profile) => profile.id)).toEqual(['first', 'second', 'third']);
		expect(moveSourceProfileToOrder(settings.sourceProfiles, 'third', 1)).toBe(true);
		expect(sortSourceProfiles(settings.sourceProfiles).map((profile) => `${profile.order}:${profile.id}`)).toEqual([
			'1:third', '2:first', '3:second',
		]);
		const reloaded = loadCalendarSettings(JSON.parse(JSON.stringify(settings))).settings;
		expect(sortSourceProfiles(reloaded.sourceProfiles).map((profile) => profile.id)).toEqual(['third', 'first', 'second']);
	});

	it('migrates legacy wiki-link targets back to property-scoped matching', () => {
		const result = loadCalendarSettings({
			schemaVersion: 2,
			sourceProfiles: [{
				id: 'events', startProperty: 'start', wikiLinkProperty: 'type',
				wikiLinkTargets: ['[[Holiday]]', '[[Vacation]]'],
			}],
		});
		expect(result.settings.sourceProfiles[0]).toMatchObject({
			wikiLinkProperty: 'type', wikiLinkTargets: ['[[Holiday]]', '[[Vacation]]'],
		});
	});

	it('updates newly added profiles and type rules by stable ID and survives reload', () => {
		const settings = loadCalendarSettings({
			schemaVersion: 7,
			sourceProfiles: [{ id: 'events', name: 'New source profile', startProperty: '' }],
			typeStyleRules: [{ id: 'holiday', typeValue: 'New type' }],
		}).settings;
		expect(updateSourceProfile(settings, 'events', (profile) => {
			profile.name = 'Holidays';
			profile.startProperty = 'start';
			profile.folders = ['Events'];
			profile.wikiLinkProperty = 'event-type';
			profile.wikiLinkTargets = ['[[Holiday]]'];
		})).toBe(true);
		expect(updateTypeStyleRule(settings, 'holiday', (rule) => { rule.typeValue = 'Holiday'; })).toBe(true);

		const reloaded = loadCalendarSettings(JSON.parse(JSON.stringify(settings))).settings;
		expect(reloaded.sourceProfiles[0]).toMatchObject({
			id: 'events', name: 'Holidays', startProperty: 'start', folders: ['Events'],
			wikiLinkProperty: 'event-type', wikiLinkTargets: ['[[Holiday]]'],
		});
		expect(reloaded.typeStyleRules[0]?.typeValue).toBe('Holiday');
	});

	it('parses wiki-link textarea values and removes profiles by stable ID', () => {
		expect(parseWikiLinkList('[[Holiday]]\n[[Vacation]]\n\n [[Trip]]')).toEqual(['[[Holiday]]', '[[Vacation]]', '[[Trip]]']);
		const settings = loadCalendarSettings({
			sourceProfiles: [{ id: 'events', startProperty: 'start' }, { id: 'archive', startProperty: 'date' }],
		}).settings;
		expect(removeSourceProfile(settings, 'events')).toBe(true);
		expect(settings.sourceProfiles.map((profile) => profile.id)).toEqual(['archive']);
	});
});

describe('folder and property suggestions', () => {
	it('writes the selected value directly and preserves other folder values', () => {
		let selectedCursor = -1;
		const input = {
			value: 'Events, hol, Archive',
			selectionStart: 11,
			setSelectionRange: (start: number) => { selectedCursor = start; },
		} as unknown as HTMLInputElement;
		let savedValue = '';
		const selected = replaceDelimitedInputSelection(input.value, 'Holidays', input.selectionStart ?? input.value.length);
		commitInputSuggestion(input, selected.value, (value) => { savedValue = value; }, selected.cursor);
		expect(input.value).toBe('Events, Holidays, Archive');
		expect(savedValue).toBe('Events, Holidays, Archive');
		expect(selectedCursor).toBe('Events, Holidays'.length);
		expect(replaceDelimitedInputValue('eve, Archive', 'Events', 3)).toBe('Events, Archive');
	});

	it('replaces only the active Wiki Link target line', () => {
		const value = '[[Events/Existing]]\nEven\n[[Archive]]';
		const cursor = value.indexOf('\nEven\n') + '\nEven'.length;
		expect(getLineQuery(value, cursor)).toBe('Even');
		expect(replaceLineInputSelection(value, '[[Events/Event]]', cursor)).toEqual({
			value: '[[Events/Existing]]\n[[Events/Event]]\n[[Archive]]',
			cursor: '[[Events/Existing]]\n[[Events/Event]]'.length,
		});
	});

	it('positions suggestions as a viewport-level popover above or below the input', () => {
		expect(getFloatingSuggestionLayout(
			{ left: 100, top: 100, bottom: 130, width: 180 },
			800,
			600,
		)).toMatchObject({ left: 100, top: 134, width: 240 });
		expect(getFloatingSuggestionLayout(
			{ left: 700, top: 520, bottom: 550, width: 180 },
			800,
			600,
		)).toMatchObject({ left: 556, bottom: 84, width: 240 });
		const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
		expect(styles).toMatch(/\.calendar-note-settings-suggestions\s*\{[^}]*position:\s*fixed;/s);
		expect(styles).toMatch(/\.calendar-note-settings-suggestions\s*\{[^}]*z-index:\s*100000;/s);
		expect(styles).toMatch(/\.calendar-note-token-remove[\s\S]*min-height:\s*2\.75rem;/);
		const source = readFileSync(new URL('../src/suggestions.ts', import.meta.url), 'utf8');
		expect(source).toContain("setAttribute('role', 'listbox')");
		expect(source).toContain("setAttribute('aria-expanded'");
		expect(source).toContain('visualViewport');
	});

	it('keeps creation controls conditional and declarative page names ID-based', () => {
		const source = readFileSync(new URL('../src/settings.ts', import.meta.url), 'utf8');
		expect(source).toContain('() => profile.allowCreate');
		expect(source).toContain('getStableProfilePageName(profile)');
		expect(source).toContain('getStableTypeRulePageName(rule)');
		expect(source).not.toMatch(/name:\s*rule\.typeValue/);
	});

	it('ranks prefix, substring, and fuzzy folder or property matches', () => {
		expect(rankSuggestions('Ev', ['Work', 'Events/Work', 'Events'])).toEqual(['Events', 'Events/Work']);
		expect(rankSuggestions('ehl', ['Events/Holidays', 'Events/Work'])).toEqual(['Events/Holidays']);
		expect(rankSuggestions('ev', ['title', 'event-end', 'event-start', 'event-start'])).toEqual(['event-end', 'event-start']);
	});
});
