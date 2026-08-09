import { describe, expect, it } from 'vitest';
import { CalendarSourceMatcher, matchesSourceProfile } from '../src/matcher';
import type { CalendarMetadata, CalendarSourceProfile } from '../src/models';
import { DEFAULT_EVENT_PROFILE } from '../src/settings-data';

const file = { path: 'Events/Holidays/Test.md', basename: 'Test', extension: 'md' };

function profile(overrides: Partial<CalendarSourceProfile>): CalendarSourceProfile {
	return {
		...structuredClone(DEFAULT_EVENT_PROFILE), enabled: true, startProperty: 'start',
		matchFilesWithStartPropertyOnly: false, ...overrides,
	};
}

function metadata(frontmatter: Record<string, unknown>, tags: string[] = []): CalendarMetadata {
	return { frontmatter, tags: tags.map((tag) => ({ tag })) };
}

describe('source matching', () => {
	it('normalizes folder separators, includes descendants, and respects folder boundaries', () => {
		for (const folder of ['Events', '/Events/', '\\Events\\']) {
			const source = profile({ folders: [folder] });
			expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), source)).toBe(true);
			expect(matchesSourceProfile({ ...file, path: 'Events/Test.md' }, metadata({ start: '2024-07-24' }), source)).toBe(true);
			expect(matchesSourceProfile({ ...file, path: 'Events-Archive/Test.md' }, metadata({ start: '2024-07-24' }), source)).toBe(false);
		}
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), profile({ folders: ['Work', 'Events'] }))).toBe(true);
	});

	it('uses Obsidian tag metadata for Properties and inline tags with exact matching', () => {
		const source = profile({ tags: ['#calendar', 'work'] });
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), source, {}, () => ['#calendar'])).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24', tags: ['calendar'] }), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, ['#calendar']), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, ['#calendar/holiday']), source)).toBe(false);
	});

	it('reads only the configured frontmatter wiki-link property', () => {
		const source = profile({ wikiLinkProperty: 'event-type', wikiLinkTargets: ['[[Holiday]]'] });
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24', 'event-type': '[[Holiday]]' }), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24', other: '[[Holiday]]' }), source)).toBe(false);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24', 'event-type': ['Other', '[[Holiday|Day off]]'] }), source)).toBe(true);
	});

	it('supports plain text, .md, headings, short paths, and canonical resolved paths', () => {
		const matcher = new CalendarSourceMatcher({
			getFirstLinkpathDest: (linkpath) => {
				const normalized = linkpath.replace(/\.md$/i, '');
				if (normalized === 'Holiday' || normalized === 'Calendar/Holiday') return { path: 'Calendar/Holiday.md' };
				return null;
			},
		});
		const source = profile({ wikiLinkProperty: 'event-type', wikiLinkTargets: ['Calendar/Holiday.md#Overview'] });
		for (const value of ['Holiday', '[[Holiday|Day off]]', 'Calendar/Holiday.md#Details']) {
			expect(matcher.matches(file, metadata({ start: '2024-07-24', 'event-type': value }), source)).toBe(true);
		}
	});

	it('does not confuse same-name notes after Obsidian resolves both paths', () => {
		const matcher = new CalendarSourceMatcher({
			getFirstLinkpathDest: (linkpath) => {
				if (linkpath === 'Calendar/Holiday') return { path: 'Calendar/Holiday.md' };
				if (linkpath === 'Archive/Holiday') return { path: 'Archive/Holiday.md' };
				return null;
			},
		});
		const source = profile({ wikiLinkProperty: 'event-type', wikiLinkTargets: ['[[Calendar/Holiday]]'] });
		expect(matcher.matches(file, metadata({ start: '2024-07-24', 'event-type': '[[Archive/Holiday]]' }), source)).toBe(false);
	});

	it('uses OR within groups and all/any only across configured groups', () => {
		const cache = metadata({ start: '2024-07-24', tags: ['calendar'], 'event-type': '[[Holiday]]' });
		expect(matchesSourceProfile(file, cache, profile({
			folders: ['Work', 'Events'], tags: ['other', 'calendar'], wikiLinkProperty: 'event-type',
			wikiLinkTargets: ['Other', 'Holiday'], matchMode: 'all',
		}))).toBe(true);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'all' }))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'any' }))).toBe(true);
	});

	it('does not let Start-only bypass configured or incomplete conditions', () => {
		const cache = metadata({ start: '2024-07-24' });
		expect(matchesSourceProfile(file, cache, profile({}))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(true);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ wikiLinkTargets: ['Holiday'], matchFilesWithStartPropertyOnly: true }))).toBe(false);
	});

	it('rejects disabled profiles, non-Markdown files, missing frontmatter, and missing start properties', () => {
		expect(matchesSourceProfile(file, metadata({}), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile({ ...file, extension: 'canvas' }, metadata({ start: '2024-07-24' }), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, null, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), profile({ enabled: false, matchFilesWithStartPropertyOnly: true }))).toBe(false);
	});
});
