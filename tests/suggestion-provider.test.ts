import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';

vi.mock('obsidian', () => ({
	AbstractInputSuggest: class {},
	TFolder: class {},
	getIconIds: () => ['calendar'],
	getAllTags: (metadata: { tags?: Array<{ tag: string }> }) => metadata.tags?.map((tag) => tag.tag) ?? [],
}));

import { TFolder } from 'obsidian';
import { CalendarSuggestionProvider } from '../src/suggestions';

function fixture(layoutReady = false) {
	const callbacks = new Map<string, Set<() => void>>();
	const layouts: Array<() => void> = [];
	const files = [{ path: 'Notes/A.md' }];
	const folder = Object.assign(new TFolder(), { path: 'Notes' });
	let metadata = { frontmatter: { title: 'A', position: {} }, tags: [{ tag: '#one' }] };
	const owner = (prefix: string) => ({
		on: (event: string, callback: () => void) => {
			const key = `${prefix}:${event}`;
			const set = callbacks.get(key) ?? new Set();
			set.add(callback);
			callbacks.set(key, set);
			return { key, callback };
		},
		offref: ({ key, callback }: { key: string; callback: () => void }) => callbacks.get(key)?.delete(callback),
	});
	const app = {
		workspace: { onLayoutReady: (callback: () => void) => { if (layoutReady) callback(); else layouts.push(callback); } },
		vault: { ...owner('vault'), getMarkdownFiles: vi.fn(() => files), getAllLoadedFiles: vi.fn(() => [folder, ...files]) },
		metadataCache: { ...owner('metadata'), getFileCache: vi.fn(() => metadata) },
	};
	const provider = new CalendarSuggestionProvider(app as unknown as App);
	return {
		provider, app, files, folder, callbacks,
		ready: () => layouts.splice(0).forEach((callback) => callback()),
		emit: (key: string) => callbacks.get(key)?.forEach((callback) => callback()),
		clearMetadata: () => { metadata = { frontmatter: { title: 'B', position: {} }, tags: [] }; },
	};
}

describe('suggestion cache lifecycle', () => {
	it('does no scanning or listener registration before layout ready, including early queries', () => {
		const f = fixture();
		f.provider.initialize();
		expect(f.provider.getFolderSuggestions('')).toEqual([]);
		expect(f.provider.getPropertySuggestions('')).toEqual([]);
		expect(f.provider.getTagSuggestions('')).toEqual([]);
		expect(f.provider.getWikiLinkSuggestions('')).toEqual([]);
		expect(f.provider.getMarkdownFileSuggestions('')).toEqual([]);
		expect(f.callbacks.size).toBe(0);
		f.ready();
		expect(f.app.vault.getMarkdownFiles).not.toHaveBeenCalled();
		expect(f.app.vault.getAllLoadedFiles).not.toHaveBeenCalled();
		expect(f.provider.getWikiLinkSuggestions('')).toEqual(['[[Notes/A]]']);
		f.provider.dispose();
	});

	it('coalesces 1,374 create and changed events into lazy snapshots with no event-time scans', () => {
		const f = fixture(true);
		for (let i = 1; i < 1374; i++) f.files.push({ path: `Notes/Note-${i}.md` });
		f.provider.initialize();
		for (let i = 0; i < 1374; i++) { f.emit('vault:create'); f.emit('metadata:changed'); }
		expect(f.app.vault.getMarkdownFiles).not.toHaveBeenCalled();
		expect(f.app.metadataCache.getFileCache).not.toHaveBeenCalled();
		expect(f.provider.getPropertySuggestions('')).toEqual(['title']);
		expect(f.provider.getTagSuggestions('')).toEqual(['#one']);
		expect(f.app.vault.getMarkdownFiles).toHaveBeenCalledTimes(1);
		expect(f.app.metadataCache.getFileCache).toHaveBeenCalledTimes(1374);
		f.provider.getPropertySuggestions('t');
		f.provider.getTagSuggestions('o');
		expect(f.app.vault.getMarkdownFiles).toHaveBeenCalledTimes(1);
		f.provider.getWikiLinkSuggestions('');
		f.provider.getMarkdownFileSuggestions('');
		expect(f.app.vault.getMarkdownFiles).toHaveBeenCalledTimes(2);
		f.provider.getFolderSuggestions('');
		f.provider.getFolderSuggestions('');
		expect(f.app.vault.getAllLoadedFiles).toHaveBeenCalledTimes(1);
		f.provider.dispose();
	});

	it('invalidates renamed paths and removes deleted notes and their suggestions', () => {
		const f = fixture(true);
		f.provider.initialize();
		f.provider.getWikiLinkSuggestions('');
		f.provider.getFolderSuggestions('');
		f.files[0]!.path = 'Moved/B.md';
		f.folder.path = 'Moved';
		f.emit('vault:rename');
		expect(f.provider.getMarkdownFileSuggestions('')).toEqual(['Moved/B.md']);
		expect(f.provider.getFolderSuggestions('')).toEqual(['Moved']);
		f.provider.getPropertySuggestions('');
		f.files.length = 0;
		f.emit('vault:delete');
		expect(f.provider.getWikiLinkSuggestions('')).toEqual([]);
		expect(f.provider.getPropertySuggestions('')).toEqual([]);
		expect(f.provider.getTagSuggestions('')).toEqual([]);
		f.provider.dispose();
	});

	it.each(['changed', 'deleted', 'resolved'])('refreshes metadata after %s without rebuilding path caches', (event) => {
		const f = fixture(true);
		f.provider.initialize();
		f.provider.getTagSuggestions('');
		f.provider.getWikiLinkSuggestions('');
		f.clearMetadata();
		f.emit(`metadata:${event}`);
		expect(f.provider.getTagSuggestions('')).toEqual([]);
		f.provider.getWikiLinkSuggestions('');
		expect(f.app.vault.getMarkdownFiles).toHaveBeenCalledTimes(3);
		f.provider.dispose();
	});

	it('registers once and detaches every listener when disposed', () => {
		const f = fixture(true);
		f.provider.initialize();
		f.provider.initialize();
		expect([...f.callbacks.values()].reduce((n, set) => n + set.size, 0)).toBe(6);
		f.provider.dispose();
		f.provider.initialize();
		expect([...f.callbacks.values()].every((set) => set.size === 0)).toBe(true);
		expect(f.provider.getWikiLinkSuggestions('')).toEqual([]);
	});

	it('cannot reactivate after disposal before layout ready', () => {
		const f = fixture();
		f.provider.initialize();
		f.provider.dispose();
		f.ready();
		expect(f.callbacks.size).toBe(0);
		expect(f.app.vault.getMarkdownFiles).not.toHaveBeenCalled();
	});
});
