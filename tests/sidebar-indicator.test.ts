import { describe, expect, it } from 'vitest';
import {
	getSidebarIndicatorFrameSize,
	getSidebarIndicatorGrid,
	getSidebarIndicatorPresentation,
} from '../src/sidebar-indicator';
import { DEFAULT_EVENT_PROFILE } from '../src/settings-data';

describe('Sidebar indicator presentation', () => {
	it('uses each Source Profile mode independently', () => {
		const dots = { ...structuredClone(DEFAULT_EVENT_PROFILE), id: 'dots', sidebarIndicatorMode: 'dots' as const };
		const icons = { ...structuredClone(DEFAULT_EVENT_PROFILE), id: 'icons', sidebarIndicatorMode: 'icons' as const };

		expect(getSidebarIndicatorPresentation(dots, 'calendar-days')).toEqual({ className: 'is-dots' });
		expect(getSidebarIndicatorPresentation(icons, 'calendar-days')).toEqual({
			className: 'is-icons',
			icon: 'calendar-days',
		});
	});

	it('allocates responsive rows and columns for the configured visible indicators', () => {
		expect(getSidebarIndicatorGrid(0)).toEqual({ columns: 1, rows: 1 });
		expect(getSidebarIndicatorGrid(1)).toEqual({ columns: 1, rows: 1 });
		expect(getSidebarIndicatorGrid(3)).toEqual({ columns: 3, rows: 1 });
		expect(getSidebarIndicatorGrid(4)).toEqual({ columns: 3, rows: 2 });
		expect(getSidebarIndicatorGrid(8)).toEqual({ columns: 4, rows: 2 });
	});

	it('fills available indicator slots while preserving gaps and a small inset', () => {
		expect(getSidebarIndicatorFrameSize(78, 46, 1, 4)).toBe(39);
		expect(getSidebarIndicatorFrameSize(78, 46, 3, 4)).toBe(20);
		expect(getSidebarIndicatorFrameSize(78, 46, 8, 4)).toBe(14);
		expect(getSidebarIndicatorFrameSize(0, 46, 1, 4)).toBe(0);
	});
});
