import { addCalendarDays, compareCalendarDates } from './date';
import type { CalendarItem } from './models';

export interface CalendarRangeSegment {
	item: CalendarItem;
	weekIndex: number;
	startColumn: number;
	endColumn: number;
	startDate: string;
	endDate: string;
	continuesBefore: boolean;
	continuesAfter: boolean;
	lane: number;
}

export interface CalendarWeekLayout {
	weekIndex: number;
	segments: CalendarRangeSegment[];
	laneCount: number;
}

export function segmentCalendarItems(
	items: CalendarItem[],
	gridStart: string,
	gridEnd: string,
	visibleStart = gridStart,
	visibleEnd = gridEnd,
): CalendarRangeSegment[] {
	const segments: CalendarRangeSegment[] = [];
	for (const item of items) {
		if (compareCalendarDates(item.startDate, visibleEnd) > 0 || compareCalendarDates(item.endDate, visibleStart) < 0) continue;
		const clippedStart = latestDate(item.startDate, gridStart, visibleStart);
		const clippedEnd = earliestDate(item.endDate, gridEnd, visibleEnd);
		let segmentStart = clippedStart;
		while (compareCalendarDates(segmentStart, clippedEnd) <= 0) {
			const dayOffset = dateOffset(gridStart, segmentStart);
			const weekIndex = Math.floor(dayOffset / 7);
			const startColumn = dayOffset % 7;
			const weekStart = addCalendarDays(gridStart, weekIndex * 7);
			const weekEnd = addCalendarDays(weekStart, 6);
			const segmentEnd = compareCalendarDates(clippedEnd, weekEnd) < 0 ? clippedEnd : weekEnd;
			segments.push({
				item,
				weekIndex,
				startColumn,
				endColumn: dateOffset(weekStart, segmentEnd),
				startDate: segmentStart,
				endDate: segmentEnd,
				continuesBefore: compareCalendarDates(item.startDate, segmentStart) < 0,
				continuesAfter: compareCalendarDates(item.endDate, segmentEnd) > 0,
				lane: -1,
			});
			segmentStart = addCalendarDays(segmentEnd, 1);
		}
	}
	return segments;
}

function latestDate(...dates: string[]): string {
	return dates.reduce((latest, date) => compareCalendarDates(date, latest) > 0 ? date : latest);
}

function earliestDate(...dates: string[]): string {
	return dates.reduce((earliest, date) => compareCalendarDates(date, earliest) < 0 ? date : earliest);
}

export function allocateCalendarLanes(segments: CalendarRangeSegment[]): CalendarWeekLayout[] {
	const byWeek = new Map<number, CalendarRangeSegment[]>();
	for (const segment of segments) {
		const week = byWeek.get(segment.weekIndex) ?? [];
		week.push(segment);
		byWeek.set(segment.weekIndex, week);
	}
	const preferredLanes = new Map<string, number>();
	const layouts: CalendarWeekLayout[] = [];
	for (const weekIndex of [...byWeek.keys()].sort((left, right) => left - right)) {
		const weekSegments = byWeek.get(weekIndex) ?? [];
		const occupied: Array<Array<{ start: number; end: number }>> = [];
		for (const segment of weekSegments) {
			const preferred = preferredLanes.get(segment.item.id);
			const lane = preferred !== undefined && laneIsFree(occupied[preferred] ?? [], segment)
				? preferred
				: firstFreeLane(occupied, segment);
			segment.lane = lane;
			preferredLanes.set(segment.item.id, lane);
			(occupied[lane] ??= []).push({ start: segment.startColumn, end: segment.endColumn });
		}
		layouts.push({ weekIndex, segments: weekSegments, laneCount: occupied.length });
	}
	return layouts;
}

function firstFreeLane(occupied: Array<Array<{ start: number; end: number }>>, segment: CalendarRangeSegment): number {
	for (let lane = 0; lane < occupied.length; lane += 1) {
		if (laneIsFree(occupied[lane] ?? [], segment)) return lane;
	}
	return occupied.length;
}

function laneIsFree(occupied: Array<{ start: number; end: number }>, segment: CalendarRangeSegment): boolean {
	return occupied.every((range) => segment.endColumn < range.start || segment.startColumn > range.end);
}

function dateOffset(start: string, end: string): number {
	let cursor = start;
	let offset = 0;
	while (compareCalendarDates(cursor, end) < 0) {
		cursor = addCalendarDays(cursor, 1);
		offset += 1;
	}
	return offset;
}
