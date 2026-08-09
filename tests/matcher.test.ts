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

function metadata(
	frontmatter: Record<string, unknown>,
	tags: string[] = [],
	links: string[] = [],
	frontmatterLinks: string[] = [],
	embeds: string[] = [],
): CalendarMetadata {
	return {
		frontmatter,
		tags: tags.map((tag) => ({ tag })),
		links: links.map((link) => ({ link })),
		frontmatterLinks: frontmatterLinks.map((link) => ({ link })),
		embeds: embeds.map((link) => ({ link })),
	};
}

describe('source matching', () => {
	it('matches folders including nested paths but not similar names', () => {
		const source = profile({ folders: ['Events'] });
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), source)).toBe(true);
		expect(matchesSourceProfile({ ...file, path: 'Events-Archive/Test.md' }, metadata({ start: '2024-07-24' }), source)).toBe(false);
	});

	it('matches frontmatter and inline tags exactly', () => {
		const source = profile({ tags: ['#calendar'] });
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24', tags: ['calendar'] }), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, ['#calendar']), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, ['#calendar/holiday']), source)).toBe(false);
	});

	it('uses the injected Obsidian tag collector for property and inline tags', () => {
		const source = profile({ tags: ['#calendar'] });
		expect(matchesSourceProfile(
			file,
			metadata({ start: '2024-07-24' }),
			source,
			{},
			() => ['#calendar'],
		)).toBe(true);
	});

	it('matches any configured wiki link from note content or properties', () => {
		const source = profile({ wikiLinks: ['[[國定假日]]', '[[Holiday]]'] });
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, [], ['國定假日']), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, [], [], ['Holiday']), source)).toBe(true);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }, [], ['Other']), source)).toBe(false);
	});

	it('matches wiki links by Obsidian-resolved destination paths', () => {
		const matcher = new CalendarSourceMatcher({
			resolvedLinks: { [file.path]: { 'Calendar/Holiday.md': 1 } },
			getFirstLinkpathDest: (linkpath) => {
				if (['Holiday', 'Calendar/Holiday'].includes(linkpath)) return { path: 'Calendar/Holiday.md' };
				return null;
			},
		});
		const source = profile({ wikiLinks: ['[[Holiday]]'] });
		expect(matcher.matches(file, metadata({ start: '2024-07-24' }, [], ['Calendar/Holiday']), source)).toBe(true);
	});

	it('matches frontmatter, heading, and embedded wiki links through the same cache path', () => {
		const matcher = new CalendarSourceMatcher({
			getFirstLinkpathDest: (linkpath) => linkpath === 'Holiday' ? { path: 'Calendar/Holiday.md' } : null,
		});
		const source = profile({ wikiLinks: ['[[Holiday]]'] });
		expect(matcher.matches(
			file,
			metadata({ start: '2024-07-24' }, [], [], [], ['Holiday#Overview']),
			source,
		)).toBe(true);
	});

	it('does not confuse same-name links after Obsidian resolves their paths', () => {
		const matcher = new CalendarSourceMatcher({
			resolvedLinks: { [file.path]: { 'Archive/Holiday.md': 1 } },
			getFirstLinkpathDest: (linkpath) => {
				if (linkpath === 'Calendar/Holiday') return { path: 'Calendar/Holiday.md' };
				if (linkpath === 'Archive/Holiday') return { path: 'Archive/Holiday.md' };
				return null;
			},
		});
		const source = profile({ wikiLinks: ['[[Calendar/Holiday]]'] });
		expect(matcher.matches(file, metadata({ start: '2024-07-24' }, [], ['Archive/Holiday']), source)).toBe(false);
	});

	it('uses all and any only across configured condition groups', () => {
		const cache = metadata({ start: '2024-07-24', tags: ['calendar'] });
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Events'], tags: ['calendar'], matchMode: 'all' }))).toBe(true);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'all' }))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ folders: ['Work'], tags: ['calendar'], matchMode: 'any' }))).toBe(true);
	});

	it('requires explicit start-property-only matching when no source condition exists', () => {
		const cache = metadata({ start: '2024-07-24' });
		expect(matchesSourceProfile(file, cache, profile({}))).toBe(false);
		expect(matchesSourceProfile(file, cache, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(true);
		expect(matchesSourceProfile(file, cache, profile({
			folders: ['Work'],
			matchFilesWithStartPropertyOnly: true,
		}))).toBe(false);
	});

	it('rejects disabled profiles, non-markdown files, missing frontmatter, and missing starts', () => {
		expect(matchesSourceProfile(file, metadata({}), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile({ ...file, extension: 'canvas' }, metadata({ start: '2024-07-24' }), profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, null, profile({ matchFilesWithStartPropertyOnly: true }))).toBe(false);
		expect(matchesSourceProfile(file, metadata({ start: '2024-07-24' }), profile({ enabled: false, matchFilesWithStartPropertyOnly: true }))).toBe(false);
	});
});
