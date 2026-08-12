import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBasesCalendarOptions } from '../src/bases-options';

describe('Style Settings colors', () => {
	const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
	const settings = css.slice(0, css.indexOf('*/'));
	const controls = settings.split(/\n\s{2}- id: /).slice(1);

	it('organizes controls into five event-focused sections without empty headings', () => {
		const headings = controls.filter((control) => control.includes('type: heading'));
		expect(headings.map((heading) => heading.match(/title: ([^\n]+)/)?.[1])).toEqual([
			'Calendar essentials',
			'Sidebar calendar',
			'Bases calendar',
			'Date appearance and states',
			'Items and indicators',
		]);
		for (const heading of headings) {
			const headingIndex = controls.indexOf(heading);
			expect(controls[headingIndex + 1]).not.toContain('type: heading');
		}
	});

	it('provides light and dark defaults for every themed color control', () => {
		const themedColors = controls.filter((control) => control.includes('type: variable-themed-color'));
		expect(themedColors.length).toBeGreaterThan(10);
		for (const control of themedColors) {
			expect(control).toContain('default-light:');
			expect(control).toContain('default-dark:');
		}
	});

	it('connects every themed color control to a CSS variable', () => {
		const themedColors = controls
			.filter((control) => control.includes('type: variable-themed-color'));
		for (const control of themedColors) {
			const id = control.split('\n', 1)[0]?.trim();
			expect(id).toBeTruthy();
			expect(css.slice(settings.length)).toContain(`--${id}`);
		}
	});

	it('uses theme-aware defaults and pairs every selector with an explicit custom color', () => {
		const customColors = controls.filter((control) => control.includes('type: variable-themed-color'));
		const colorSources = controls.filter((control) => control.includes('type: variable-select') && control.split('\n', 1)[0]?.endsWith('-source'));
		expect(colorSources).toHaveLength(customColors.length);

		for (const source of colorSources) {
			const sourceId = source.split('\n', 1)[0]?.trim();
			const colorId = sourceId?.replace(/-source$/, '');
			expect(colorId).toBeTruthy();
			expect(source).not.toContain(`default: 'var(--${colorId})'`);
			expect(source).toContain('label: Custom');
			expect(source).toContain(`value: 'var(--${colorId})'`);
			expect(source).toContain("value: 'var(--color-blue)'");
			expect(css.slice(settings.length)).toContain(`--${colorId}-resolved: var(--${sourceId}, var(--${colorId}))`);
		}
	});

	it('keeps background and text color choices relevant to their purpose', () => {
		const background = controls.find((control) => control.startsWith('calendar-note-bases-cell-bg-source'));
		const text = controls.find((control) => control.startsWith('calendar-note-date-text-source'));
		expect(background).toContain("value: 'var(--background-primary)'");
		expect(background).not.toContain("value: 'var(--text-normal)'");
		expect(text).toContain("value: 'var(--text-normal)'");
		expect(text).not.toContain("value: 'var(--background-primary)'");
		expect(background).toContain("value: 'transparent'");
	});

	it('makes Bases date numbers circular with an adjustable radius', () => {
		expect(settings).toContain('id: calendar-note-bases-date-bg-source');
		expect(settings).toContain('id: calendar-note-bases-date-radius');
		expect(settings).toContain('default: 50');
		expect(settings).toContain("format: '%'");
		expect(css.slice(settings.length)).toContain('border-radius: var(--calendar-note-bases-date-radius, 50%);');
		expect(css.slice(settings.length)).toContain('background: var(--calendar-note-bases-date-bg-resolved, var(--background-secondary));');
		expect(css.slice(settings.length)).toContain('.calendar-note-bases-date-cell.is-today .calendar-note-bases-date-number');
	});

	it('keeps Other month above Weekend and hover above date states', () => {
		const runtimeCss = css.slice(settings.length);
		const sidebarWeekend = runtimeCss.indexOf('.calendar-note-date-cell.is-weekend');
		const sidebarAdjacent = runtimeCss.indexOf('.calendar-note-date-cell.is-adjacent-month');
		const sidebarToday = runtimeCss.indexOf('.calendar-note-date-cell.is-today');
		const sidebarHover = runtimeCss.indexOf('.calendar-note-sidebar .calendar-note-date-button:hover');
		const basesWeekend = runtimeCss.indexOf('.calendar-note-bases-date-cell.is-weekend');
		const basesAdjacent = runtimeCss.indexOf('.calendar-note-bases-date-cell.is-adjacent-month');
		expect(sidebarWeekend).toBeLessThan(sidebarAdjacent);
		expect(sidebarAdjacent).toBeLessThan(sidebarToday);
		expect(sidebarToday).toBeLessThan(sidebarHover);
		expect(basesWeekend).toBeLessThan(basesAdjacent);
		expect(runtimeCss).toContain('.calendar-note-bases .calendar-note-bases-date-number');
		expect(settings).toContain('id: calendar-note-date-hover-text-source');
		expect(runtimeCss).toContain('color: var(--calendar-note-date-hover-text-resolved, var(--text-normal));');
	});

	it('applies Sidebar default cell and date colors with theme-resistant selectors', () => {
		const runtimeCss = css.slice(settings.length);
		expect(runtimeCss).toContain('.calendar-note-sidebar .calendar-note-date-button');
		expect(runtimeCss).toContain('background: var(--calendar-note-date-cell-bg-resolved, transparent);');
		expect(runtimeCss).toContain('color: var(--calendar-note-date-text-resolved, var(--text-normal));');
		expect(runtimeCss).toContain('.calendar-note-sidebar .calendar-note-date-number');
		expect(runtimeCss).toContain('color: inherit;');
	});

	it('keeps Sidebar day cells and icon indicators square', () => {
		const runtimeCss = css.slice(settings.length);
		expect(runtimeCss).toContain('.calendar-note-date-cell:hover,');
		expect(runtimeCss).toContain('.calendar-note-date-cell:focus-within');
		expect(runtimeCss).toContain('.calendar-note-sidebar .calendar-note-date-cell:hover .calendar-note-date-button');
		expect(runtimeCss).toMatch(/\.calendar-note-date-cell\s*\{[^}]*aspect-ratio:\s*1;/s);
		expect(runtimeCss).toContain('width: calc(var(--calendar-note-event-icon-size, var(--icon-xs)) + 4px);');
		expect(runtimeCss).toContain('aspect-ratio: 1;');
		expect(runtimeCss).toContain('border-radius: var(--calendar-note-event-radius, var(--radius-s));');
	});

	it('contains no task fallback or completed-event controls', () => {
		expect(settings).not.toMatch(/task|completed/i);
		expect(css.slice(settings.length)).not.toMatch(/calendar-note-task|is-completed|is-task/);
	});
});

describe('Bases property mapping options', () => {
	it('groups mappings, content, styling, layout, and advanced options', () => {
		const groups = getBasesCalendarOptions();
		expect(groups.map((group) => group.type === 'group' ? group.displayName : '')).toEqual([
			'Required mapping', 'Event content', 'Event styling', 'Calendar layout', 'Advanced',
		]);
		const propertyGroups = groups.slice(0, 3);
		const propertyOptions = propertyGroups.flatMap((group) => group.type === 'group' ? group.items : [])
			.filter((option) => option.type === 'property');
		for (const option of propertyOptions) {
			expect(option.type).toBe('property');
			expect('default' in option).toBe(false);
			expect('placeholder' in option ? option.placeholder : undefined).toBe('Select a property');
		}
		expect(propertyOptions.map((option) => option.key)).not.toContain('completedProperty');
		const content = groups[1];
		const layout = groups[3];
		if (!content || content.type !== 'group' || !layout || layout.type !== 'group') return;
		const displayMode = content.items.find((option) => option.key === 'eventDisplayMode');
		expect(displayMode?.type).toBe('dropdown');
		if (!displayMode || displayMode.type !== 'dropdown') return;
		expect(displayMode.options).toMatchObject({
			'title-properties': 'Title + visible Base properties', properties: 'Visible Base properties',
		});
		const rowLimit = layout.items.find((option) => option.key === 'eventRowLimit');
		expect(rowLimit).toMatchObject({ type: 'dropdown', default: 'auto' });
		const weekend = layout.items.find((option) => option.key === 'weekendPreset');
		expect(weekend).toMatchObject({ type: 'dropdown', default: 'plugin' });
		expect(groups.flatMap((group) => group.type === 'group' ? group.items : []).map((option) => option.key))
			.not.toEqual(expect.arrayContaining(['hideCompletedTasks', 'dimCompletedTasks', 'maximumVisibleEvents', 'weekendDays']));
	});
});

describe('Sidebar indicator tooltip', () => {
	it('uses the Obsidian tooltip API without a native title attribute', () => {
		const source = readFileSync(new URL('../src/sidebar-view.ts', import.meta.url), 'utf8');
		expect(source).toContain('setTooltip(indicator, item.title)');
		expect(source).not.toContain("attr: { title: item.title, 'aria-label': item.title }");
	});

	it('applies resolved Profile colors directly to resist host button styles', () => {
		const source = readFileSync(new URL('../src/sidebar-view.ts', import.meta.url), 'utf8');
		expect(source).toContain('indicator.style.backgroundColor = resolution.style.backgroundColor');
		expect(source).toContain('indicator.style.color = resolution.style.textColor');
	});
});
