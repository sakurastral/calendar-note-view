import { beforeEach, describe, expect, it, vi } from 'vitest';

const obsidianMocks = vi.hoisted(() => ({
	AbstractInputSuggest: class {},
	BasesView: class {
		createFileForView = vi.fn(async (
			_name?: string,
			processor?: (frontmatter: unknown) => void,
		): Promise<void> => {
			const frontmatter: Record<string, unknown> = {};
			processor?.(frontmatter);
			(this as { createdFrontmatter?: Record<string, unknown> }).createdFrontmatter = frontmatter;
		});
		unload(): void {
			const instance = this as { onunload?: () => void };
			instance.onunload?.();
		}
	},
	Menu: class {},
	Modal: class {},
	Notice: class {},
	Setting: class {},
	moment: {
		monthsShort: () => [],
		weekdaysMin: () => [],
	},
	setIcon: vi.fn(),
}));

vi.mock('obsidian', () => obsidianMocks);

import { CalendarBasesView } from '../src/bases-view';

describe('Bases view lifecycle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('keeps the Obsidian-owned host intact when the view unloads during a tab switch', () => {
		const viewContainer = {
			empty: vi.fn(),
		};
		const host = {
			createDiv: vi.fn(() => viewContainer),
			empty: vi.fn(),
		};
		const plugin = {
			settings: {
				timeZone: { mode: 'utc' },
			},
		};

		const view = new CalendarBasesView(
			{} as never,
			host as unknown as HTMLElement,
			plugin as never,
		);
		view.unload();

		expect(host.createDiv).toHaveBeenCalledWith({ cls: 'calendar-note-bases' });
		expect(host.empty).not.toHaveBeenCalled();
		expect(viewContainer.empty).not.toHaveBeenCalled();
	});

	it('normalizes only entries from this.data.data and never scans Source Profiles', () => {
		const viewContainer = { empty: vi.fn() };
		const host = { createDiv: vi.fn(() => viewContainer) };
		const plugin = {
			settings: {
				timeZone: { mode: 'utc' },
				eventPropertyDateFormat: 'YYYY-MM-DD',
				sourceProfiles: [{ id: 'must-not-scan' }],
			},
			app: { vault: { getMarkdownFiles: vi.fn(() => { throw new Error('Bases must not scan the vault'); }) } },
		};
		const view = new CalendarBasesView({} as never, host as unknown as HTMLElement, plugin as never);
		Object.defineProperty(view, 'data', { value: { data: [{
			file: { path: 'Filtered/Event.md', basename: 'Event' },
			getValue: () => ({ toString: () => '2026-08-09' }),
		}], properties: [] } });
		const items = (view as unknown as {
			getItems(options: unknown): Array<{ filePath: string }>;
		}).getItems({ properties: { start: 'note.start' }, firstDayOfWeek: 0, weekendDays: [0, 6], showAdjacentMonthDates: true, maximumVisibleEvents: 3, eventDisplayMode: 'title', visibleProperties: [] });
		expect(items.map((item) => item.filePath)).toEqual(['Filtered/Event.md']);
		expect(plugin.app.vault.getMarkdownFiles).not.toHaveBeenCalled();
	});

	it('builds grid content from the properties visible in the current Base', () => {
		const viewContainer = { empty: vi.fn() };
		const host = { createDiv: vi.fn(() => viewContainer) };
		const plugin = { settings: { timeZone: { mode: 'utc' }, eventPropertyDateFormat: 'YYYY-MM-DD' } };
		const view = new CalendarBasesView({} as never, host as unknown as HTMLElement, plugin as never);
		Object.defineProperty(view, 'config', { value: { getDisplayName: (property: string) => property === 'note.type' ? 'Type' : 'Owner' } });
		Object.defineProperty(view, 'data', { value: { data: [{
			file: { path: 'Events/Visible.md', basename: 'Visible' },
			getValue: (property: string) => ({
				toString: () => property === 'note.start' ? '2026-08-09' : property === 'note.type' ? 'Meeting' : 'Alex',
			}),
		}], properties: ['note.type', 'note.owner'] } });
		const items = (view as unknown as { getItems(options: unknown): Array<{ id: string }> }).getItems({
			properties: { start: 'note.start' }, firstDayOfWeek: 0, weekendDays: [0, 6],
			showAdjacentMonthDates: true, maximumVisibleEvents: 3, eventDisplayMode: 'properties',
			visibleProperties: ['note.type', 'note.owner'],
		});
		const details = (view as unknown as {
			propertyDetailsByItemId: Map<string, Array<{ displayName: string; text: string }>>;
		}).propertyDetailsByItemId;
		expect(details.get(items[0]?.id ?? '')).toEqual([
			expect.objectContaining({ displayName: 'Type', text: 'Meeting' }),
			expect.objectContaining({ displayName: 'Owner', text: 'Alex' }),
		]);
	});

	it('preserves the exact order supplied by this.data.data', () => {
		const viewContainer = { empty: vi.fn() };
		const host = { createDiv: vi.fn(() => viewContainer) };
		const plugin = { settings: { timeZone: { mode: 'utc' }, eventPropertyDateFormat: 'YYYY-MM-DD' } };
		const view = new CalendarBasesView({} as never, host as unknown as HTMLElement, plugin as never);
		Object.defineProperty(view, 'config', { value: { getDisplayName: (property: string) => property } });
		Object.defineProperty(view, 'data', { value: { data: [
			entry('Z-last-by-calendar-sort.md', '2026-08-20'),
			entry('A-first-by-calendar-sort.md', '2026-08-01'),
		], properties: [] } });
		const items = (view as unknown as { getItems(options: unknown): Array<{ filePath: string }> }).getItems({
			properties: { start: 'note.start' }, visibleProperties: [],
		});
		expect(items.map((item) => item.filePath)).toEqual(['Z-last-by-calendar-sort.md', 'A-first-by-calendar-sort.md']);
	});

	it('creates a Base-native event with createFileForView and only writable note properties', async () => {
		const viewContainer = { empty: vi.fn() };
		const host = { createDiv: vi.fn(() => viewContainer) };
		const plugin = { settings: { timeZone: { mode: 'utc' }, eventPropertyDateFormat: 'DD/MM/YYYY' } };
		const view = new CalendarBasesView({} as never, host as unknown as HTMLElement, plugin as never);
		await (view as unknown as {
			createBaseEvent(mappings: unknown, input: unknown): Promise<void>;
		}).createBaseEvent({
			start: 'note.start', end: 'note.end', title: 'formula.title', type: 'note.type',
		}, {
			title: 'Planning', startDate: '2026-08-09', endDate: '2026-08-11', type: 'Meeting',
		});
		const nativeView = view as unknown as {
			createFileForView: ReturnType<typeof vi.fn>;
			createdFrontmatter: Record<string, unknown>;
		};
		expect(nativeView.createFileForView).toHaveBeenCalledOnce();
		expect(nativeView.createFileForView).toHaveBeenCalledWith('Planning', expect.any(Function));
		expect(nativeView.createdFrontmatter).toEqual({ start: '09/08/2026', end: '11/08/2026', type: 'Meeting' });
	});
});

function entry(path: string, date: string): { file: { path: string; basename: string }; getValue(): { toString(): string } } {
	return { file: { path, basename: path.replace(/\.md$/, '') }, getValue: () => ({ toString: () => date }) };
}
