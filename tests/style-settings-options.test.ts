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
		const sidebarHover = runtimeCss.indexOf('.calendar-note-date-button:hover');
		const basesWeekend = runtimeCss.indexOf('.calendar-note-bases-date-cell.is-weekend');
		const basesAdjacent = runtimeCss.indexOf('.calendar-note-bases-date-cell.is-adjacent-month');
		expect(sidebarWeekend).toBeLessThan(sidebarAdjacent);
		expect(sidebarAdjacent).toBeLessThan(sidebarToday);
		expect(sidebarToday).toBeLessThan(sidebarHover);
		expect(basesWeekend).toBeLessThan(basesAdjacent);
		expect(runtimeCss).toContain('.calendar-note-bases .calendar-note-bases-date-number');
	});

	it('applies Sidebar default cell and date colors with theme-resistant selectors', () => {
		const runtimeCss = css.slice(settings.length);
		expect(runtimeCss).toContain('.calendar-note-sidebar .calendar-note-date-button');
		expect(runtimeCss).toContain('background: var(--calendar-note-date-cell-bg-resolved, transparent);');
		expect(runtimeCss).toContain('color: var(--calendar-note-date-text-resolved, var(--text-normal));');
		expect(runtimeCss).toContain('.calendar-note-sidebar .calendar-note-date-number');
		expect(runtimeCss).toContain('color: inherit;');
	});

	it('contains no task fallback or completed-event controls', () => {
		expect(settings).not.toMatch(/task|completed/i);
		expect(css.slice(settings.length)).not.toMatch(/calendar-note-task|is-completed|is-task/);
	});
});

describe('Bases property mapping options', () => {
	it('uses searchable property selectors without imposed defaults', () => {
		const mapping = getBasesCalendarOptions()[0];
		expect(mapping?.type).toBe('group');
		if (!mapping || mapping.type !== 'group') return;
		for (const option of mapping.items) {
			expect(option.type).toBe('property');
			expect('default' in option).toBe(false);
			expect('placeholder' in option ? option.placeholder : undefined).toBe('Select a property');
		}
		expect(mapping.items.map((option) => option.key)).not.toContain('completedProperty');
		const behavior = getBasesCalendarOptions()[1];
		if (!behavior || behavior.type !== 'group') return;
		expect(behavior.items.map((option) => option.key)).not.toEqual(expect.arrayContaining(['hideCompletedTasks', 'dimCompletedTasks']));
	});
});
