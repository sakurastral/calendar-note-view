import type { CalendarSourceProfile } from './models';

export interface SidebarIndicatorPresentation {
	className: 'is-dots' | 'is-icons';
	icon?: string;
}

export interface SidebarIndicatorGrid {
	columns: number;
	rows: number;
}

export function getSidebarIndicatorPresentation(
	profile: CalendarSourceProfile,
	resolvedIcon: string,
): SidebarIndicatorPresentation {
	return profile.sidebarIndicatorMode === 'icons'
		? { className: 'is-icons', icon: resolvedIcon }
		: { className: 'is-dots' };
}

/** Keeps up to eight configured indicators plus overflow inside the remaining day-cell area. */
export function getSidebarIndicatorGrid(visibleCount: number): SidebarIndicatorGrid {
	const count = Math.max(1, Math.min(9, Math.floor(visibleCount)));
	const columns = count <= 3 ? count : count <= 6 ? 3 : 4;
	return { columns, rows: Math.ceil(count / columns) };
}

export function getSidebarIndicatorFrameSize(
	availableWidth: number,
	availableHeight: number,
	visibleCount: number,
	gap: number,
	preferredFrameSize?: number,
): number {
	if (![availableWidth, availableHeight, visibleCount, gap].every(Number.isFinite)) return 0;
	if (availableWidth <= 0 || availableHeight <= 0 || visibleCount <= 0) return 0;
	const { columns, rows } = getSidebarIndicatorGrid(visibleCount);
	const slotWidth = (availableWidth - Math.max(0, columns - 1) * Math.max(0, gap)) / columns;
	const slotHeight = (availableHeight - Math.max(0, rows - 1) * Math.max(0, gap)) / rows;
	const availableFrameSize = Math.min(slotWidth, slotHeight) * 0.86;
	const preferred = preferredFrameSize !== undefined && Number.isFinite(preferredFrameSize) && preferredFrameSize > 0
		? preferredFrameSize
		: availableFrameSize;
	return Math.max(1, Math.floor(Math.min(availableFrameSize, preferred)));
}
