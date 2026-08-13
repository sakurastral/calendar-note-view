import type { CalendarItem } from './models';

export function getSidebarAgendaDetails(item: Pick<CalendarItem, 'title' | 'type'>): string[] {
	const details = [item.title, item.type]
		.map((value) => value?.trim() ?? '')
		.filter((value) => value.length > 0);
	return details.filter((value, index) => details.indexOf(value) === index);
}
