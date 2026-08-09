import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({ getIconIds: () => ['calendar'] }));
import type { CalendarItem, CalendarSourceProfile } from '../src/models';
import { CalendarDiagnosticsService } from '../src/diagnostics';
import { CalendarItemNormalizer } from '../src/normalizer';
import { DEFAULT_EVENT_PROFILE } from '../src/settings-data';
import { CalendarStyleResolver } from '../src/style-resolver';
import { isSafeCssColor, normalizeWikiLinkTarget } from '../src/value-normalizers';

const file = { path: 'Events/Holiday.md', basename: 'Holiday', extension: 'md' };

function source(overrides: Partial<CalendarSourceProfile> = {}): CalendarSourceProfile {
	return {
		...structuredClone(DEFAULT_EVENT_PROFILE), enabled: true, startProperty: 'start', endProperty: 'end',
		titleProperty: 'event-title', typeProperty: 'type', iconProperty: 'icon', colorProperty: 'color',
		textColorProperty: 'text-color', ...overrides,
	};
}

describe('calendar item normalization', () => {
	it('normalizes dates, titles, types, styles, and inclusive ends', () => {
		const result = new CalendarItemNormalizer().normalize(file, { frontmatter: {
			start: '24/07/2024',
			end: '26/07/2024',
			'event-title': ' Typhoon holiday ',
			type: [' ', '[[國定假日|假日]]'],
			icon: 'calendar-days',
			color: '#abc',
			'text-color': 'var(--text-normal)',
		} }, source(), 'DD/MM/YYYY');
		expect(result.item).toMatchObject({
			startDate: '2024-07-24', endDate: '2024-07-26', title: 'Typhoon holiday',
			type: '國定假日', icon: 'calendar-days', backgroundColor: '#abc',
		});
	});

	it('falls back to frontmatter title then basename and records the fallback', () => {
		const normalizer = new CalendarItemNormalizer();
		expect(normalizer.normalize(file, { frontmatter: { start: '2024-07-24', title: 'Frontmatter' } }, source(), 'YYYY-MM-DD').item?.title).toBe('Frontmatter');
		const fallback = normalizer.normalize(file, { frontmatter: { start: '2024-07-24' } }, source(), 'YYYY-MM-DD');
		expect(fallback.item?.title).toBe('Holiday');
		expect(fallback.diagnostics.map((item) => item.code)).toContain('missing-title-fallback');
	});

	it('uses the start for an empty end and rejects invalid ranges', () => {
		const normalizer = new CalendarItemNormalizer();
		const single = normalizer.normalize(file, { frontmatter: { start: '2024-07-24', end: '' } }, source(), 'YYYY-MM-DD');
		expect(single.item?.endDate).toBe('2024-07-24');
		const reversed = normalizer.normalize(file, { frontmatter: { start: '2024-07-24', end: '2024-07-23' } }, source(), 'YYYY-MM-DD');
		expect(reversed.item).toBeUndefined();
		expect(reversed.diagnostics[0]?.code).toBe('end-before-start');
	});

	it('ignores unsafe colors without invalidating the event', () => {
		const result = new CalendarItemNormalizer().normalize(file, { frontmatter: {
			start: '2024-07-24', color: 'red; background:url(x)',
		} }, source(), 'YYYY-MM-DD');
		expect(result.item).toBeDefined();
		expect(result.item?.backgroundColor).toBeUndefined();
		expect(result.diagnostics.map((item) => item.code)).toContain('invalid-color');
	});

	it('produces an event-only CalendarItem without task runtime fields', () => {
		const item = new CalendarItemNormalizer().normalize(
			file,
			{ frontmatter: { start: '2024-07-24' } },
			source(),
			'YYYY-MM-DD',
		).item;
		expect(item).toBeDefined();
		expect(item).not.toHaveProperty('kind');
		expect(item).not.toHaveProperty('completed');
	});
});

describe('values and style resolution', () => {
	it('normalizes equivalent wiki links and validates safe CSS colors', () => {
		expect(normalizeWikiLinkTarget('[[Target.md|Alias]]')).toBe('Target');
		expect(normalizeWikiLinkTarget({ path: 'Target.md' })).toBe('Target');
		for (const color of ['#fff', '#12345678', 'rgb(1 2 3 / 50%)', 'hsl(120 50% 50%)', 'var(--event-color)']) expect(isSafeCssColor(color)).toBe(true);
		for (const color of ['url(x)', 'expression(x)', 'javascript:x', '#fff; color:red']) expect(isSafeCssColor(color)).toBe(false);
	});

	it('resolves each style field using the documented priority', () => {
		const item: CalendarItem = {
			id: 'one', filePath: file.path, startDate: '2024-07-24', endDate: '2024-07-24',
			title: 'Holiday', type: '[[Holiday]]', icon: 'note-icon', textColor: '#111', sourceProfileId: 'default-events',
		};
		const resolution = new CalendarStyleResolver(() => true).resolve(item, source({
			defaultIcon: 'default-icon', defaultBackgroundColor: '#ddd', defaultTextColor: '#222',
		}), [{ id: 'holiday', enabled: true, typeValue: 'Holiday', icon: 'rule-icon', backgroundColor: '#abc', textColor: '#333' }]);
		expect(resolution.style).toEqual({ icon: 'note-icon', backgroundColor: '#abc', textColor: '#111' });
	});

	it('uses explicit Source Profile defaults before the event Style Settings fallback', () => {
		const event: CalendarItem = {
			id: 'event', filePath: file.path, startDate: '2024-07-24', endDate: '2024-07-24', title: 'Event', sourceProfileId: 'default-events',
		};
		const resolver = new CalendarStyleResolver(() => true);

		expect(resolver.resolve(event, source({ defaultBackgroundColor: 'var(--background-secondary)', defaultTextColor: 'var(--text-normal)' }), []).style).toMatchObject({
			backgroundColor: 'var(--background-secondary)',
			textColor: 'var(--text-normal)',
		});
		expect(resolver.resolve(event, source(), []).style).toMatchObject({
			backgroundColor: 'var(--calendar-note-event-bg-resolved, var(--background-secondary))',
			textColor: 'var(--calendar-note-event-text-resolved, var(--text-normal))',
		});
	});

	it('ignores unknown icons and records diagnostics', () => {
		const item: CalendarItem = { id: 'one', filePath: file.path, startDate: '2024-07-24', endDate: '2024-07-24', title: 'Holiday', icon: 'missing', sourceProfileId: 'default-events' };
		const resolution = new CalendarStyleResolver().resolve(item, source({ defaultIcon: 'calendar' }), []);
		expect(resolution.style.icon).toBe('calendar');
		expect(resolution.diagnostics[0]?.code).toBe('unknown-icon');
	});

	it('writes resolver diagnostics into the shared diagnostics service', () => {
		const item: CalendarItem = {
			id: 'one', filePath: file.path, startDate: '2024-07-24', endDate: '2024-07-24',
			title: 'Holiday', icon: 'missing', sourceProfileId: 'default-events',
		};
		const resolution = new CalendarStyleResolver().resolve(item, source({ defaultIcon: 'calendar' }), []);
		const diagnostics = new CalendarDiagnosticsService();
		diagnostics.replaceStyleForFileAndProfile(item.filePath, item.sourceProfileId, resolution.diagnostics);
		expect(diagnostics.getByFile(file.path).map((diagnostic) => diagnostic.code)).toEqual(['unknown-icon']);
	});
});
