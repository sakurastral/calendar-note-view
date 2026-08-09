import { beforeEach, describe, expect, it, vi } from 'vitest';

const obsidianMocks = vi.hoisted(() => ({
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
});
