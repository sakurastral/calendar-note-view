import type { CalendarSourceProfile } from './models';

export interface SidebarIndicatorPresentation {
	className: 'is-dots' | 'is-icons';
	icon?: string;
}

export function getSidebarIndicatorPresentation(
	profile: CalendarSourceProfile,
	resolvedIcon: string,
): SidebarIndicatorPresentation {
	return profile.sidebarIndicatorMode === 'icons'
		? { className: 'is-icons', icon: resolvedIcon }
		: { className: 'is-dots' };
}
