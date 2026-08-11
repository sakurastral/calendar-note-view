import { getTodayCanonical } from './date';
import type { CalendarTimeZone } from './models';

type DayRolloverSubscriber = (today: string) => void;

/** Schedules one low-cost callback at the next calendar day in the configured time zone. */
export class CalendarDayRolloverService {
	private readonly subscribers = new Set<DayRolloverSubscriber>();
	private timer?: number;
	private today: string;
	private readonly handleVisibility = (): void => {
		if (document.visibilityState === 'visible') this.reschedule(true);
	};

	constructor(private readonly getTimeZone: () => CalendarTimeZone) {
		this.today = getTodayCanonical(getTimeZone());
		document.addEventListener('visibilitychange', this.handleVisibility);
		this.schedule();
	}

	subscribe(subscriber: DayRolloverSubscriber): () => void {
		this.subscribers.add(subscriber);
		return () => this.subscribers.delete(subscriber);
	}

	reschedule(notifyIfChanged = false): void {
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = undefined;
		const nextToday = getTodayCanonical(this.getTimeZone());
		if (notifyIfChanged && nextToday !== this.today) {
			this.today = nextToday;
			for (const subscriber of this.subscribers) subscriber(nextToday);
		} else {
			this.today = nextToday;
		}
		this.schedule();
	}

	dispose(): void {
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = undefined;
		this.subscribers.clear();
		document.removeEventListener('visibilitychange', this.handleVisibility);
	}

	private schedule(): void {
		const now = Date.now();
		const delay = millisecondsUntilNextCalendarDay(this.getTimeZone(), now);
		this.timer = window.setTimeout(() => {
			this.timer = undefined;
			const nextToday = getTodayCanonical(this.getTimeZone());
			if (nextToday !== this.today) {
				this.today = nextToday;
				for (const subscriber of this.subscribers) subscriber(nextToday);
			}
			this.schedule();
		}, delay);
	}
}

export function millisecondsUntilNextCalendarDay(timeZone: CalendarTimeZone, now: number): number {
	const current = getTodayCanonical(timeZone, new Date(now));
	let lower = now;
	let upper = now + 30 * 60 * 60 * 1000;
	while (upper - lower > 1_000) {
		const midpoint = lower + Math.floor((upper - lower) / 2);
		if (getTodayCanonical(timeZone, new Date(midpoint)) === current) lower = midpoint;
		else upper = midpoint;
	}
	return Math.max(1_000, upper - now + 250);
}
