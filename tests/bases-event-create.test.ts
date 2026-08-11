import { beforeEach, describe, expect, it, vi } from 'vitest';

const obsidianMocks = vi.hoisted(() => ({
	AbstractInputSuggest: class {},
	Modal: class {},
	Notice: class {},
	Setting: class {},
	TFolder: class {},
	getAllTags: vi.fn(() => []),
	getIconIds: vi.fn(() => []),
}));

vi.mock('obsidian', () => obsidianMocks);

import { applyBasesEventFrontmatter, writableNoteProperty } from '../src/bases-event-create-modal';

describe('Base-native event creation mapping', () => {
	beforeEach(() => vi.clearAllMocks());

	it('recognizes only writable note properties', () => {
		expect(writableNoteProperty('note.start')).toBe('start');
		expect(writableNoteProperty('note.calendar-start')).toBe('calendar-start');
		expect(writableNoteProperty('formula.start')).toBeNull();
		expect(writableNoteProperty('file.name')).toBeNull();
	});

	it('writes inclusive dates, title, and type while skipping formula and file mappings', () => {
		const frontmatter: Record<string, unknown> = {};
		applyBasesEventFrontmatter(frontmatter, {
			start: 'note.start', end: 'note.end', title: 'formula.title', type: 'file.name',
		}, {
			title: 'Ignored formula title', startDate: '2026-08-09', endDate: '2026-08-11', type: 'Ignored file type',
		}, 'DD/MM/YYYY');
		expect(frontmatter).toEqual({ start: '09/08/2026', end: '11/08/2026' });
	});

	it('safely ignores an unexpected frontmatter value', () => {
		expect(() => applyBasesEventFrontmatter(null, { start: 'note.start' }, {
			title: '', startDate: '2026-08-09', endDate: '2026-08-09', type: '',
		}, 'YYYY-MM-DD')).not.toThrow();
	});
});
