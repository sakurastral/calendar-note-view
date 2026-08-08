import { describe, expect, it } from 'vitest';
import { matchesSourceProfile } from '../src/matcher';
import type { CalendarMetadata, CalendarSourceProfile } from '../src/models';
import { DEFAULT_EVENT_PROFILE } from '../src/settings-data';

const file = { path: 'Events/Holidays/Test.md', basename: 'Test', extension: 'md' };

function profile(overrides: Partial<CalendarSourceProfile>): CalendarSourceProfile {
	return { ...structuredClone(DEFAULT_EVENT_PROFILE), matchFilesWithStartPropertyOnly: false, ...overrides };
}

function metadata(frontmatter: Record<string, unknown>, tags: string[] = []): CalendarMetadata {
	return { frontmatter, tags: tags.map((tag) => ({ tag })) };
}

describe('source matching', () => {
	it('matches folders including nested paths but not similar names', () => {
		const source = profile({ folders: ['Events'] });
		expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24' }), source)).toBe(true);
		expect(matchesSourceProfile({ ...file, path: 'Events-Archive/Test.md' }, metadata({ 'calendar-event-start': '2024-07-24' }), source)).toBe(false);
	});

	it('matches frontmatter and inline tags exactly', () => {
		const source = profile({ tags: ['#calendar'] });
		expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24', tags: ['calendar'] }), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24' }, ['#calendar']), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24' }, ['#calendar/holiday']), source)).toBe(false);
	});

	it('matches wiki-link strings, arrays, aliases, and plain targets', () => {
		const source = profile({ wikiLinkProperty: 'type', wikiLinkTargets: ['國定假日'] });
		for (const value of ['[[國定假日]]', '[[國定假日|假日]]', '國定假日', ['Other', '[[國定假日]]']]) {
			expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24', type: value }), source)).toBe(true);
		}
	});

	it('uses all and any only across configured condition groups', () => {
		const cache = metadata({ 'calendar-event-start': '2024-07-24', tags: ['calendar'] });
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Events'], tags: ['calendar'], matchMode: 'all' }))).toBe(true);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'all' }))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'any' }))).toBe(true);
	});

	it('requires explicit start-property-only matching when no source condition exists', () => {
		const cache = metadata({ 'calendar-event-start': '2024-07-24' });
		expect(matchesSourceProfile(file, cache, profile({}))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(true);
	});

	it('rejects disabled profiles, non-markdown files, missing frontmatter, and missing starts', () => {
		expect(matchesSourceProfile(file, metadata({}), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile({ ...file, extension: 'canvas' }, metadata({ 'calendar-event-start': '2024-07-24' }), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, null, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, metadata({ 'calendar-event-start': '2024-07-24' }), profile({ enabled: false, matchFilesWithStartPropertyOnly: true }))).toBe(false);
	});
});
