import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '../src/models';
import { allocateCalendarLanes, segmentCalendarItems } from '../src/range-layout';

describe('Bases calendar range layout', () => {
	it('splits cross-week and cross-month events without changing the item', () => {
		const item = event('trip', '2026-07-30', '2026-08-12');
		const segments = segmentCalendarItems([item], '2026-07-26', '2026-09-05');
		expect(segments.map((segment) => [segment.weekIndex, segment.startDate, segment.endDate])).toEqual([
			[0, '2026-07-30', '2026-08-01'],
			[1, '2026-08-02', '2026-08-08'],
			[2, '2026-08-09', '2026-08-12'],
		]);
		expect(item).toMatchObject({ startDate: '2026-07-30', endDate: '2026-08-12' });
	});

	it('clips ranges at the rendered grid boundaries', () => {
		const segments = segmentCalendarItems([
			event('long', '2026-07-01', '2026-09-30'),
		], '2026-07-26', '2026-09-05');
		expect(segments[0]).toMatchObject({ startDate: '2026-07-26', continuesBefore: true });
		expect(segments.at(-1)).toMatchObject({ endDate: '2026-09-05', continuesAfter: true });
	});

	it('clips adjacent-month segments while keeping their grid columns', () => {
		const segments = segmentCalendarItems([
			event('month', '2026-07-30', '2026-08-03'),
		], '2026-07-26', '2026-09-05', '2026-08-01', '2026-08-31');
		expect(segments.map((segment) => [segment.weekIndex, segment.startColumn, segment.endColumn, segment.startDate, segment.endDate])).toEqual([
			[0, 6, 6, '2026-08-01', '2026-08-01'],
			[1, 0, 1, '2026-08-02', '2026-08-03'],
		]);
	});

	it('allocates deterministic non-overlapping lanes and preserves an event lane across weeks', () => {
		const segments = segmentCalendarItems([
			event('long', '2026-08-01', '2026-08-12'),
			event('overlap', '2026-08-03', '2026-08-05'),
			event('later', '2026-08-06', '2026-08-07'),
		], '2026-07-26', '2026-09-05');
		const layouts = allocateCalendarLanes(segments);
		const longLanes = layouts.flatMap((layout) => layout.segments).filter((segment) => segment.item.id === 'long').map((segment) => segment.lane);
		expect(new Set(longLanes).size).toBe(1);
		const secondWeek = layouts.find((layout) => layout.weekIndex === 1);
		expect(secondWeek?.laneCount).toBe(2);
		expect(secondWeek?.segments.map((segment) => [segment.item.id, segment.lane])).toEqual([
			['long', 0], ['overlap', 1], ['later', 1],
		]);
	});
});

function event(id: string, startDate: string, endDate: string): CalendarItem {
	return { id, filePath: `${id}.md`, kind: 'event', startDate, endDate, title: id };
}
