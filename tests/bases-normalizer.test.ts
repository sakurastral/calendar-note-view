import type { BasesPropertyId, Value } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { BasesCalendarNormalizer, type BasesEntryLike } from '../src/bases-normalizer';

const start = 'note.start' as BasesPropertyId;
const end = 'note.end' as BasesPropertyId;
const title = 'formula.label' as BasesPropertyId;
const type = 'note.type' as BasesPropertyId;
const completed = 'note.completed' as BasesPropertyId;
const color = 'note.color' as BasesPropertyId;

describe('Bases calendar normalizer', () => {
	it('normalizes only values supplied by a Bases entry', () => {
		const entry = createEntry('Events/Holiday.md', {
			[start]: scalar('2026-08-09'),
			[end]: scalar('2026-08-11'),
			[title]: scalar('Holiday'),
			[type]: scalar('[[National holiday|Holiday]]'),
			[color]: scalar('var(--color-red)'),
		});
		const item = new BasesCalendarNormalizer().normalize(entry, {
			start, end, title, type, backgroundColor: color,
		}, 'YYYY-MM-DD');
		expect(item).toMatchObject({
			filePath: 'Events/Holiday.md',
			startDate: '2026-08-09',
			endDate: '2026-08-11',
			title: 'Holiday',
			type: 'National holiday',
			backgroundColor: 'var(--color-red)',
		});
	});

	it('supports custom property date formats and a missing inclusive end', () => {
		const entry = createEntry('Events/One.md', { [start]: scalar('09/08/2026') });
		const item = new BasesCalendarNormalizer().normalize(entry, { start, end }, 'DD/MM/YYYY');
		expect(item?.startDate).toBe('2026-08-09');
		expect(item?.endDate).toBe('2026-08-09');
	});

	it('rejects invalid and reversed ranges without throwing', () => {
		const normalizer = new BasesCalendarNormalizer();
		expect(normalizer.normalize(createEntry('Bad.md', { [start]: scalar('2026-02-30') }), { start }, 'YYYY-MM-DD')).toBeUndefined();
		expect(normalizer.normalize(createEntry('Backwards.md', {
			[start]: scalar('2026-08-10'), [end]: scalar('2026-08-09'),
		}), { start, end }, 'YYYY-MM-DD')).toBeUndefined();
	});

	it('recognizes task completion and ignores unsafe colors', () => {
		const entry = createEntry('Tasks/Done.md', {
			[start]: scalar('2026-08-09'),
			[completed]: scalar('done'),
			[color]: scalar('red; background:url(x)'),
		});
		const item = new BasesCalendarNormalizer().normalize(entry, { start, completed, backgroundColor: color }, 'YYYY-MM-DD');
		expect(item).toMatchObject({ kind: 'task', completed: true, title: 'Done' });
		expect(item?.backgroundColor).toBeUndefined();
	});

	it('uses the first valid list value for type mapping', () => {
		const entry = createEntry('Events/List.md', {
			[start]: scalar('2026-08-09'),
			[type]: list(['[[Work]]', 'Personal']),
		});
		expect(new BasesCalendarNormalizer().normalize(entry, { start, type }, 'YYYY-MM-DD')?.type).toBe('Work');
	});
});

function createEntry(path: string, values: Record<string, Value>): BasesEntryLike {
	const name = path.split('/').at(-1) ?? path;
	return {
		file: { path, basename: name.replace(/\.md$/i, '') },
		getValue: (propertyId) => values[propertyId] ?? null,
	};
}

function scalar(value: string): Value {
	return { toString: () => value } as Value;
}

function list(values: string[]): Value {
	return {
		toString: () => values.join(', '),
		length: () => values.length,
		get: (index: number) => scalar(values[index] ?? ''),
	} as unknown as Value;
}
