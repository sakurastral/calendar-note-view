import { Notice } from 'obsidian';
import { calendarText } from './calendar-locale';
import { CreateEventModal } from './create-event-modal';
import { CalendarDiagnosticsModal } from './diagnostics-modal';
import type CalendarNoteViewPlugin from './main';
import { SourceProfilePickerModal } from './profile-picker-modal';

export function registerCalendarCommands(plugin: CalendarNoteViewPlugin): void {
	const text = (key: Parameters<typeof calendarText>[1]): string => calendarText(plugin.settings.calendarLocale, key);
	plugin.addCommand({ id: 'open-sidebar-calendar', name: text('openSidebarCalendar'), callback: () => { void plugin.activateSidebar(); } });
	plugin.addCommand({ id: 'go-to-today', name: text('goToToday'), callback: () => { void plugin.goToToday(); } });
	plugin.addCommand({ id: 'show-todays-events', name: text('showTodaysEvents'), callback: () => { void plugin.showTodaysEvents(); } });
	plugin.addCommand({ id: 'create-event', name: text('createEvent'), callback: () => new CreateEventModal(plugin, plugin.eventCreation).open() });
	plugin.addCommand({
		id: 'create-event-with-source-profile',
		name: text('createEventWithProfile'),
		callback: () => {
			const available = plugin.settings.sourceProfiles.some((profile) => profile.enabled && profile.allowCreate && profile.startProperty.trim());
			if (!available) {
				new Notice(text('noCreateProfiles'));
				return;
			}
			new SourceProfilePickerModal(plugin, (profile) => new CreateEventModal(plugin, plugin.eventCreation, undefined, profile.id).open()).open();
		},
	});
	plugin.addCommand({
		id: 'refresh-sidebar-index',
		name: text('refreshSidebarIndex'),
		callback: () => { void plugin.index.refresh().catch(() => new Notice(text('refreshFailed'))); },
	});
	plugin.addCommand({ id: 'open-calendar-diagnostics', name: text('openCalendarDiagnostics'), callback: () => new CalendarDiagnosticsModal(plugin).open() });
}
