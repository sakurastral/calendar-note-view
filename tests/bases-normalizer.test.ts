import type { BasesPropertyId, Value } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { BasesCalendarNormalizer, basesValueToRaw, type BasesEntryLike } from '../src/bases-normalizer';

const start = 'note.start' as BasesPropertyId;
const end = 'note.end' as BasesPropertyId;
const title = 'formula.label' as BasesPropertyId;
const type = 'note.type' as BasesPropertyId;
const color = 'note.color' as BasesPropertyId;

describe('Bases calendar normalizer', () => {
	it('normalizes DateValue, LinkValue, and formula values supplied by a Bases entry', () => {
		const entry = createEntry('Events/Holiday.md', {
			[start]: new DateValueShape('2026-08-09'),
			[end]: new DateValueShape('2026-08-11'),
			[title]: new StringValueShape('Holiday'),
			[type]: new LinkValueShape('[[National holiday|Holiday]]'),
			[color]: new StringValueShape('var(--color-red)'),
		});
		const item = new BasesCalendarNormalizer().normalize(entry, {
			start, end, title, type, backgroundColor: color,
		}, 'YYYY-MM-DD');
		expect(item).toEqual({
			id: 'bases:Events/Holiday.md', filePath: 'Events/Holiday.md', sourceProfileId: 'bases-calendar',
			startDate: '2026-08-09', endDate: '2026-08-11', title: 'Holiday', type: 'National holiday',
			icon: undefined, backgroundColor: 'var(--color-red)', textColor: undefined,
		});
		expect(item).not.toHaveProperty('kind');
		expect(item).not.toHaveProperty('completed');
	});

	it('supports custom date formats and an empty inclusive end', () => {
		const entry = createEntry('Events/One.md', { [start]: new DateValueShape('09/08/2026') });
		const item = new BasesCalendarNormalizer().normalize(entry, { start, end }, 'DD/MM/YYYY');
		expect(item?.startDate).toBe('2026-08-09');
		expect(item?.endDate).toBe('2026-08-09');
	});

	it('rejects invalid ranges and unsafe colors without creating task state', () => {
		const normalizer = new BasesCalendarNormalizer();
		expect(normalizer.normalize(createEntry('Bad.md', { [start]: new DateValueShape('2026-02-30') }), { start }, 'YYYY-MM-DD')).toBeUndefined();
		const item = normalizer.normalize(createEntry('Events/Safe.md', {
			[start]: new DateValueShape('2026-08-10'), [color]: new StringValueShape('red; background:url(x)'),
		}), { start, backgroundColor: color }, 'YYYY-MM-DD');
		expect(item?.backgroundColor).toBeUndefined();
		expect(item).not.toHaveProperty('kind');
		expect(item).not.toHaveProperty('completed');
	});

	it('reads the first valid item from a real ListValue-shaped value', () => {
		const list = new ListValueShape([new LinkValueShape('[[Work]]'), new StringValueShape('Personal')]);
		const entry = createEntry('Events/List.md', { [start]: new DateValueShape('2026-08-09'), [type]: list });
		expect(basesValueToRaw(list as unknown as Value)).toEqual(['[[Work]]', 'Personal']);
		expect(new BasesCalendarNormalizer().normalize(entry, { start, type }, 'YYYY-MM-DD')?.type).toBe('Work');
	});
});

type ValueShape = StringValueShape | DateValueShape | LinkValueShape | ListValueShape;

function createEntry(path: string, values: Record<string, ValueShape>): BasesEntryLike {
	const name = path.split('/').at(-1) ?? path;
	return {
		file: { path, basename: name.replace(/\.md$/i, '') },
		getValue: (propertyId) => values[propertyId] as unknown as Value ?? null,
	};
}

class StringValueShape {
	constructor(private readonly value: string) {}
	toString(): string { return this.value; }
	isTruthy(): boolean { return this.value.length > 0; }
}

class LinkValueShape extends StringValueShape {}

class DateValueShape extends StringValueShape {
	dateOnly(): DateValueShape { return this; }
	relative(): string { return this.toString(); }
}

class ListValueShape {
	constructor(private readonly values: Array<StringValueShape | DateValueShape | LinkValueShape>) {}
	toString(): string { return this.values.map(String).join(', '); }
	isTruthy(): boolean { return this.values.length > 0; }
	length(): number { return this.values.length; }
	get(index: number): Value { return this.values[index] as unknown as Value; }
}
