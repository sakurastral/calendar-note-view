import type { BasesAllOptions } from 'obsidian';

export function getBasesCalendarOptions(): BasesAllOptions[] {
	return [{
		type: 'group',
		displayName: 'Property mapping',
		items: [
			{ type: 'property', key: 'startProperty', displayName: 'Start property', placeholder: 'Select a property' },
			{ type: 'property', key: 'endProperty', displayName: 'End property', placeholder: 'Select a property' },
			{ type: 'property', key: 'titleProperty', displayName: 'Title property', placeholder: 'Select a property' },
			{ type: 'property', key: 'typeProperty', displayName: 'Type property', placeholder: 'Select a property' },
			{ type: 'property', key: 'iconProperty', displayName: 'Icon property', placeholder: 'Select a property' },
			{ type: 'property', key: 'backgroundColorProperty', displayName: 'Background color property', placeholder: 'Select a property' },
			{ type: 'property', key: 'textColorProperty', displayName: 'Text color property', placeholder: 'Select a property' },
		],
	}, {
		type: 'group',
		displayName: 'Calendar behavior',
		items: [
			{ type: 'dropdown', key: 'eventDisplayMode', displayName: 'Event display mode', default: 'icon-title', options: { icon: 'Icon', title: 'Title', 'icon-title': 'Icon + title', properties: 'Visible Base properties' } },
			{ type: 'dropdown', key: 'firstDayOfWeek', displayName: 'First day of week', default: '0', options: { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' } },
			{ type: 'multitext', key: 'weekendDays', displayName: 'Weekend days', default: ['0', '6'] },
			{ type: 'toggle', key: 'showAdjacentMonthDates', displayName: 'Show adjacent month dates', default: true },
			{ type: 'slider', key: 'maximumVisibleEvents', displayName: 'Maximum event rows per day', default: 3, min: 1, max: 12, step: 1 },
		],
	}];
}
