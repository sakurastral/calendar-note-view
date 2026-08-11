import { beforeEach, describe, expect, it, vi } from 'vitest';

const obsidianMocks = vi.hoisted(() => ({
	AbstractInputSuggest: class {},
	BasesView: class {
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
		const content = (view as unknown as { propertyContentByItemId: Map<string, string> }).propertyContentByItemId;
		expect(content.get(items[0]?.id ?? '')).toBe('Type: Meeting · Owner: Alex');
	});
});
