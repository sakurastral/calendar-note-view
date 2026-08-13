import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	readEventDisplayMode,
	readEventRowLimit,
	readFirstDayOfWeek,
	readLayoutDensity,
	readWeekendDays,
	readWeekendPreset,
	resolveCompactLayout,
	resolveResponsiveSize,
	resolveVisibleRows,
} from '../src/bases-options';

describe('Bases Calendar option migration and responsive layout', () => {
	it('migrates legacy properties display mode without changing its meaning', () => {
		expect(readEventDisplayMode('properties')).toBe('properties');
		expect(readEventDisplayMode('title-properties')).toBe('title-properties');
		expect(readEventDisplayMode('unknown')).toBe('icon-title');
	});

	it('migrates legacy weekend arrays to presets and supports no weekend', () => {
		expect(readWeekendPreset(undefined, ['0', '6'])).toBe('sat-sun');
		expect(readWeekendPreset(undefined, [5, 6])).toBe('fri-sat');
		expect(readWeekendPreset(undefined, [])).toBe('none');
		expect(readWeekendDays(undefined, ['0', '6'], [5, 6])).toEqual([0, 6]);
		expect(readWeekendDays('plugin', undefined, [5, 6])).toEqual([5, 6]);
		expect(readWeekendDays('none', undefined, [0, 6])).toEqual([]);
	});

	it('follows the plugin first weekday until the Base explicitly overrides it', () => {
		expect(readFirstDayOfWeek(undefined, 1)).toBe(1);
		expect(readFirstDayOfWeek('plugin', 6)).toBe(6);
		expect(readFirstDayOfWeek('0', 1)).toBe(0);
		expect(readFirstDayOfWeek('invalid', 2)).toBe(2);
	});

	it('migrates the legacy event-row slider and resolves automatic rows from the container', () => {
		expect(readEventRowLimit(undefined, 7)).toBe('7');
		expect(readEventRowLimit('all', 3)).toBe('all');
		expect(resolveResponsiveSize(480)).toBe('narrow');
		expect(resolveResponsiveSize(700)).toBe('medium');
		expect(resolveResponsiveSize(1000)).toBe('wide');
		expect(resolveVisibleRows('auto', 'auto', 'narrow')).toBe(1);
		expect(resolveVisibleRows('auto', 'auto', 'medium')).toBe(2);
		expect(resolveVisibleRows('auto', 'comfortable', 'wide')).toBe(5);
		expect(resolveVisibleRows('all', 'auto', 'wide')).toBe(Number.POSITIVE_INFINITY);
		expect(readLayoutDensity('compact')).toBe('compact');
		expect(resolveCompactLayout('auto', 'narrow')).toBe(true);
		expect(resolveCompactLayout('comfortable', 'narrow')).toBe(false);
	});
});

describe('Bases Calendar runtime boundaries', () => {
	const source = readFileSync(new URL('../src/bases-view.ts', import.meta.url), 'utf8');
	const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

	it('keeps Base entries authoritative and does not sort or use Source Profile creation', () => {
		expect(source).toContain('for (const entry of this.data.data)');
		expect(source).not.toContain('sortCalendarItems');
		expect(source).not.toContain("from './create-event-modal'");
		expect(source).not.toContain('this.plugin.eventCreation');
		expect(source).not.toContain('this.plugin.index');
		expect(source).toContain('this.createFileForView');
	});

	it('uses Obsidian tooltips without native event title attributes and opens Agenda for overflow', () => {
		expect(source).toContain('setTooltip(eventButton');
		expect(source).not.toMatch(/attr:\s*\{\s*title:/);
		expect(source).toContain("more.addEventListener('click', () => this.openAgenda(date, dateItems))");
	});

	it('contains responsive, focus, selected, touch, and Agenda styling', () => {
		expect(css).toContain('.calendar-note-bases-event:hover');
		expect(css).toContain('.calendar-note-bases-event:focus-visible');
		expect(css).toContain('.calendar-note-bases-date-cell.is-selected');
		expect(css).toContain('.calendar-note-bases.is-layout-compact');
		expect(css).toContain('.calendar-note-bases-agenda-item');
		expect(css).toContain('@media (hover: none), (pointer: coarse)');
		expect(css).toContain('min-height: 2.75rem');
	});

	it('uses ResizeObserver and disconnects it through the view lifecycle', () => {
		expect(source).toContain('new ResizeObserver');
		expect(source).toContain('this.resizeObserver?.disconnect()');
	});

	it('supports keyboard month and year navigation without intercepting form fields', () => {
		expect(source).toContain("event.key === 'PageUp'");
		expect(source).toContain("event.key !== 'PageDown'");
		expect(source).toContain('event.shiftKey ? 12 : 1');
		expect(source).toContain('if (isTextInput(event.target)) return;');
	});
});
