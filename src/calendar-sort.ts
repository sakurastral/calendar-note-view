import { calendarDayOrdinal } from './date';
import type { CalendarItem } from './models';

export function sortCalendarItems(
	values: Iterable<CalendarItem>,
	profileIds: string[] = [],
): CalendarItem[] {
	const profileOrder = new Map(profileIds.map((profileId, index) => [profileId, index]));
	return [...values].sort((left, right) => {
		const start = left.startDate.localeCompare(right.startDate);
		if (start !== 0) return start;
		const leftMulti = left.endDate !== left.startDate;
		const rightMulti = right.endDate !== right.startDate;
		if (leftMulti !== rightMulti) return leftMulti ? -1 : 1;
		const duration = (calendarDayOrdinal(right.endDate) - calendarDayOrdinal(right.startDate)) -
			(calendarDayOrdinal(left.endDate) - calendarDayOrdinal(left.startDate));
		if (duration !== 0) return duration;
		const profile = (profileOrder.get(left.sourceProfileId ?? '') ?? Number.MAX_SAFE_INTEGER) -
			(profileOrder.get(right.sourceProfileId ?? '') ?? Number.MAX_SAFE_INTEGER);
		return profile || left.title.localeCompare(right.title) || left.filePath.localeCompare(right.filePath) || left.id.localeCompare(right.id);
	});
}
