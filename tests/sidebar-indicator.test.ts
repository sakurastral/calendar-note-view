import { describe, expect, it } from 'vitest';
import { getSidebarIndicatorPresentation } from '../src/sidebar-indicator';
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
});
