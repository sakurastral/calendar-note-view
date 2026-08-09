import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBasesCalendarOptions } from '../src/bases-options';

describe('Style Settings colors', () => {
	const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
	const settings = css.slice(0, css.indexOf('*/'));

	it('provides light and dark defaults for every themed color control', () => {
		const controls = settings.split(/\n\s{2}- id: /).slice(1);
		const themedColors = controls.filter((control) => control.includes('type: variable-themed-color'));
		expect(themedColors.length).toBeGreaterThan(10);
		for (const control of themedColors) {
			expect(control).toContain('default-light:');
			expect(control).toContain('default-dark:');
		}
	});

	it('connects every themed color control to a CSS variable', () => {
		const controls = settings.split(/\n\s{2}- id: /).slice(1)
			.filter((control) => control.includes('type: variable-themed-color'));
		for (const control of controls) {
			const id = control.split('\n', 1)[0]?.trim();
			expect(id).toBeTruthy();
			expect(css.slice(settings.length)).toContain(`--${id}`);
		}
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
	});
});
