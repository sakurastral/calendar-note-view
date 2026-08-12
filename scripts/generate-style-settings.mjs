import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const stylesheet = fileURLToPath(new URL('../styles.css', import.meta.url));

const paletteOptions = [
	['Red', 'var(--color-red)'],
	['Orange', 'var(--color-orange)'],
	['Yellow', 'var(--color-yellow)'],
	['Green', 'var(--color-green)'],
	['Cyan', 'var(--color-cyan)'],
	['Blue', 'var(--color-blue)'],
	['Purple', 'var(--color-purple)'],
	['Pink', 'var(--color-pink)'],
];

const backgroundOptions = [
	['Primary background', 'var(--background-primary)'],
	['Primary alternate background', 'var(--background-primary-alt)'],
	['Secondary background', 'var(--background-secondary)'],
	['Secondary alternate background', 'var(--background-secondary-alt)'],
	['Hover background', 'var(--background-modifier-hover)'],
	['Interactive accent', 'var(--interactive-accent)'],
	['Interactive accent hover', 'var(--interactive-accent-hover)'],
	['Transparent', 'transparent'],
	...paletteOptions,
];

const textOptions = [
	['Normal text', 'var(--text-normal)'],
	['Muted text', 'var(--text-muted)'],
	['Faint text', 'var(--text-faint)'],
	['Accent text', 'var(--text-accent)'],
	['Accent hover text', 'var(--text-accent-hover)'],
	['Text on accent', 'var(--text-on-accent)'],
	...paletteOptions,
];

const borderOptions = [
	['Border', 'var(--background-modifier-border)'],
	['Border hover', 'var(--background-modifier-border-hover)'],
	['Interactive accent', 'var(--interactive-accent)'],
	['Transparent', 'transparent'],
	...paletteOptions,
];

const indicatorOptions = [
	['Interactive accent', 'var(--interactive-accent)'],
	['Accent text', 'var(--text-accent)'],
	...paletteOptions,
];

const heading = (id, title) => ({ id, title, type: 'heading', level: 1, collapsed: true });
const slider = (id, title, defaultValue, min, max, step, format, description) => ({
	id, title, description, type: 'variable-number-slider', default: defaultValue, min, max, step, format,
});
const color = (id, title, description, defaultValue, defaultLight, defaultDark, options) => [
	{
		id: `${id}-source`,
		title,
		description: `${description} Select Custom to use the light and dark colors in the next setting.`,
		type: 'variable-select',
		default: defaultValue,
		options: [
			[`Plugin default (${options.find((option) => option[1] === defaultValue)?.[0] ?? 'theme color'})`, defaultValue],
			...options.filter((option) => option[1] !== defaultValue),
			['Custom', `var(--${id})`],
		],
	},
	{
		id,
		title: 'Custom light and dark color',
		description: `Used only when ${title} is set to Custom.`,
		type: 'variable-themed-color',
		format: 'hex',
		'default-light': defaultLight,
		'default-dark': defaultDark,
	},
];

const settings = [
	heading('calendar-note-general-heading', 'Calendar essentials'),
	slider('calendar-note-font-size', 'Calendar font size', 14, 10, 24, 1, 'px', 'Applies to both Sidebar and Bases calendars.'),
	slider('calendar-note-navigation-icon-size', 'Navigation icon size', 16, 12, 28, 1, 'px', 'Applies to previous, next, Today, and refresh buttons.'),
	...color('calendar-note-navigation-text', 'Navigation icon color', 'Applies to Sidebar and Bases navigation icons.', 'var(--text-muted)', '#5f6368', '#b6b6b6', textOptions),

	heading('calendar-note-sidebar-heading', 'Sidebar calendar'),
	...color('calendar-note-sidebar-bg', 'Sidebar background', 'Fills the complete Sidebar calendar view.', 'var(--background-secondary)', '#f3f4f6', '#202020', backgroundOptions),
	...color('calendar-note-sidebar-weekday-text', 'Weekday label color', 'Applies to the weekday names above the Sidebar grid.', 'var(--text-muted)', '#6b7280', '#a1a1aa', textOptions),
	slider('calendar-note-sidebar-header-height', 'Navigation row height', 32, 24, 56, 1, 'px', 'Controls the minimum height of the year, month, and navigation row.'),
	slider('calendar-note-sidebar-cell-gap', 'Gap between day cells', 2, 0, 12, 1, 'px', 'Controls horizontal and vertical spacing in the Sidebar month grid.'),
	...color('calendar-note-date-cell-bg', 'Default day cell background', 'Applies only to ordinary Sidebar day cells; date states below can override it.', 'transparent', '#ffffff', '#1e1e1e', backgroundOptions),
	slider('calendar-note-date-cell-radius', 'Day cell corner radius', 6, 0, 20, 1, 'px', 'Applies only to Sidebar day cells.'),

	heading('calendar-note-bases-heading', 'Bases calendar'),
	slider('calendar-note-bases-header-height', 'Navigation row height', 36, 28, 64, 1, 'px', 'Controls the minimum height of the Bases year, month, and navigation row.'),
	...color('calendar-note-bases-header-bg', 'Navigation row background', 'Fills the Bases navigation row.', 'transparent', '#ffffff', '#1e1e1e', backgroundOptions),
	...color('calendar-note-bases-weekday-bg', 'Weekday row background', 'Fills the weekday-name row above the Bases grid.', 'var(--background-secondary)', '#f3f4f6', '#252525', backgroundOptions),
	...color('calendar-note-bases-weekday-text', 'Weekday row text', 'Applies to the weekday names in the Bases grid.', 'var(--text-muted)', '#6b7280', '#a1a1aa', textOptions),
	slider('calendar-note-bases-cell-min-height', 'Grid cell minimum height', 88, 56, 180, 4, 'px', 'Sets the minimum height of each Bases day cell.'),
	...color('calendar-note-bases-cell-bg', 'Default grid cell background', 'Fills ordinary Bases day cells; date states below can override it.', 'var(--background-primary)', '#ffffff', '#1e1e1e', backgroundOptions),
	...color('calendar-note-bases-cell-border', 'Grid border color', 'Applies to the lines between Bases day cells.', 'var(--background-modifier-border)', '#d8d8d8', '#3a3a3a', borderOptions),
	...color('calendar-note-bases-date-bg', 'Date badge background', 'Fills ordinary Bases date-number badges; Today and hover can override it.', 'var(--background-secondary)', '#e5e7eb', '#303030', backgroundOptions),
	slider('calendar-note-bases-date-radius', 'Date badge corner radius', 50, 0, 50, 1, '%', 'Controls the Bases date-number badge. Use 50% for a circle and 0% for a square.'),
	slider('calendar-note-bases-event-height', 'Event bar height', 22, 16, 40, 1, 'px', 'Sets the height of event bars in Bases.'),
	slider('calendar-note-bases-event-gap', 'Gap between event bars', 2, 0, 12, 1, 'px', 'Sets vertical spacing between event bars in Bases.'),
	...color('calendar-note-bases-more-text', 'Overflow count text color', 'Applies to the +N more indicator in Bases.', 'var(--text-muted)', '#6b7280', '#a1a1aa', textOptions),
	...color('calendar-note-bases-event-hover-bg', 'Event hover background', 'Used when a Bases event is hovered or pressed.', 'var(--background-modifier-hover)', '#dce3ea', '#3b3b3b', backgroundOptions),
	...color('calendar-note-bases-event-hover-text', 'Event hover text', 'Used for Bases event text while hovered or pressed.', 'var(--text-normal)', '#1f2937', '#f3f4f6', textOptions),
	...color('calendar-note-bases-event-focus-ring', 'Event focus ring', 'Outlines keyboard-focused Bases events.', 'var(--interactive-accent)', '#7c3aed', '#a78bfa', borderOptions),
	...color('calendar-note-bases-selected-date', 'Selected date', 'Highlights the date whose Agenda was opened.', 'var(--background-modifier-active-hover)', '#dbeafe', '#303c50', backgroundOptions),
	...color('calendar-note-bases-agenda-bg', 'Agenda background', 'Fills Bases Agenda event cards.', 'var(--background-secondary)', '#f3f4f6', '#252525', backgroundOptions),
	...color('calendar-note-bases-agenda-border', 'Agenda border', 'Outlines Bases Agenda event cards.', 'var(--background-modifier-border)', '#d8d8d8', '#3a3a3a', borderOptions),
	...color('calendar-note-bases-compact-indicator', 'Compact indicator', 'Fills event-count indicators in compact layout.', 'var(--interactive-accent)', '#7c3aed', '#a78bfa', backgroundOptions),
	...color('calendar-note-bases-invalid-notice', 'Invalid-entry notice', 'Styles the invalid-entry summary.', 'var(--text-warning)', '#b45309', '#fbbf24', textOptions),

	heading('calendar-note-date-cell-heading', 'Date appearance and states'),
	slider('calendar-note-date-size', 'Date number size', 12, 9, 20, 1, 'px', 'Applies to date numbers in both calendars.'),
	...color('calendar-note-date-text', 'Default date number color', 'Applies to ordinary dates in both calendars.', 'var(--text-normal)', '#2e3338', '#dcddde', textOptions),
	...color('calendar-note-date-hover-bg', 'Date hover background', 'Applies to the Sidebar day cell and Bases date badge under the pointer or keyboard focus.', 'var(--background-modifier-hover)', '#e5e7eb', '#343434', backgroundOptions),
	...color('calendar-note-date-hover-text', 'Date hover text', 'Applies to the date text under the pointer or keyboard focus, including Weekend and Today.', 'var(--text-normal)', '#2e3338', '#dcddde', textOptions),
	...color('calendar-note-adjacent-bg', 'Other-month cell background', 'Applies to dates outside the displayed month and takes priority over Weekend.', 'var(--background-primary-alt)', '#f7f7f7', '#242424', backgroundOptions),
	...color('calendar-note-adjacent-text', 'Other-month date number color', 'Applies to dates outside the displayed month.', 'var(--text-faint)', '#9a9a9a', '#777777', textOptions),
	...color('calendar-note-weekend-bg', 'Weekend cell background', 'Applies to configured weekend days in the displayed month.', 'transparent', '#ffffff', '#1e1e1e', backgroundOptions),
	...color('calendar-note-weekend-text', 'Weekend date number color', 'Applies to configured weekend days in the displayed month.', 'var(--text-muted)', '#6b7280', '#a1a1aa', textOptions),
	...color('calendar-note-today-bg', 'Today highlight background', 'Applies to the full Sidebar day cell and the Bases date badge.', 'var(--background-modifier-hover)', '#e5e7eb', '#343434', backgroundOptions),
	...color('calendar-note-today-text', 'Today date number color', 'Applies to Today in both calendars.', 'var(--text-normal)', '#1f2937', '#f3f4f6', textOptions),

	heading('calendar-note-event-heading', 'Items and indicators'),
	...color('calendar-note-event-bg', 'Event fallback background', 'Used only when an event has no note, type-rule, or Source Profile color override.', 'var(--background-secondary)', '#e5e7eb', '#303030', backgroundOptions),
	...color('calendar-note-event-text', 'Event fallback text', 'Used only when an event has no note, type-rule, or Source Profile text-color override.', 'var(--text-normal)', '#222222', '#dadada', textOptions),
	slider('calendar-note-dot-size', 'Sidebar event dot size', 5, 3, 12, 1, 'px', 'Applies when the Sidebar indicator mode is Colored dots.'),
	slider('calendar-note-event-icon-size', 'Event icon size', 12, 8, 22, 1, 'px', 'Sets Bases event icons and the target Sidebar badge size. Sidebar badges shrink automatically when a day cell has less space.'),
	slider('calendar-note-sidebar-icon-scale', 'Sidebar icon scale', 76, 40, 100, 1, '%', 'Sets the icon glyph as a percentage of its responsive Sidebar indicator frame.'),
	slider('calendar-note-event-radius', 'Event corner radius', 4, 0, 16, 1, 'px', 'Applies to Sidebar indicators and Bases event bars.'),
	...color('calendar-note-daily-note-indicator', 'Daily Note indicator color', 'Applies to the small dot that marks an existing Daily Note.', 'var(--interactive-accent)', '#7c3aed', '#a78bfa', indicatorOptions),
];

function yamlValue(value) {
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return `'${String(value).replaceAll("'", "''")}'`;
}

function renderSetting(setting) {
	const lines = [`  - id: ${setting.id}`, `    title: ${setting.title}`];
	if (setting.description) lines.push(`    description: ${setting.description}`);
	lines.push(`    type: ${setting.type}`);
	for (const key of ['level', 'collapsed', 'default', 'min', 'max', 'step', 'format', 'default-light', 'default-dark']) {
		if (setting[key] !== undefined) lines.push(`    ${key}: ${yamlValue(setting[key])}`);
	}
	if (setting.options) {
		lines.push('    options:');
		for (const [label, value] of setting.options) {
			lines.push(`      - label: ${label}`, `        value: ${yamlValue(value)}`);
		}
	}
	return lines.join('\n');
}

const definition = `/* @settings\nname: Calendar Note View\nid: calendar-note-view\nsettings:\n${settings.map(renderSetting).join('\n')}\n*/`;
const current = readFileSync(stylesheet, 'utf8');
const bodyStart = current.indexOf('*/');
if (bodyStart < 0) throw new Error('Could not find the existing Style Settings block.');
const next = `${definition}${current.slice(bodyStart + 2)}`;

if (process.argv.includes('--check')) {
	if (next !== current) {
		console.error('styles.css Style Settings block is out of date. Run npm run styles:generate.');
		process.exitCode = 1;
	}
} else {
	writeFileSync(stylesheet, next);
}
