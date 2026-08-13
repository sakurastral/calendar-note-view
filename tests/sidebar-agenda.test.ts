import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '../src/models';
import { getSidebarAgendaDetails } from '../src/sidebar-agenda';

function item(title: string, type?: string): Pick<CalendarItem, 'title' | 'type'> {
	return { title, type };
}

describe('Sidebar Agenda details', () => {
	it('shows the Event title followed by its type', () => {
		expect(getSidebarAgendaDetails(item('Buy train tickets', 'Private'))).toEqual(['Buy train tickets', 'Private']);
	});

	it('does not repeat identical title and type values', () => {
		expect(getSidebarAgendaDetails(item('Private', 'Private'))).toEqual(['Private']);
	});

	it('keeps the title when the Event has no type', () => {
		expect(getSidebarAgendaDetails(item('Buy train tickets'))).toEqual(['Buy train tickets']);
	});
});
