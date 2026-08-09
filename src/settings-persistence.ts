import type { CalendarSettings } from './models';

export type CalendarSettingsImpact = 'save' | 'render' | 'index';
export type CalendarSettingsSaveState = 'saved' | 'saving' | 'error';

export interface CalendarSettingsPersistenceOptions {
	getSettings: () => CalendarSettings;
	saveData: (settings: CalendarSettings) => Promise<void>;
	applyImpact: (
		previous: CalendarSettings,
		next: CalendarSettings,
		impact: CalendarSettingsImpact,
	) => Promise<void> | void;
	onStatusChange?: (status: CalendarSettingsSaveState) => void;
	debounceMilliseconds?: number;
}

interface PendingSettingsSave {
	previous: CalendarSettings;
	impact: CalendarSettingsImpact;
}

/** Coalesces UI edits and serializes writes so an older save can never win. */
export class CalendarSettingsPersistence {
	private pending?: PendingSettingsSave;
	private timer?: number;
	private running?: Promise<void>;
	private readonly debounceMilliseconds: number;
	private status: CalendarSettingsSaveState = 'saved';

	constructor(private readonly options: CalendarSettingsPersistenceOptions) {
		this.debounceMilliseconds = options.debounceMilliseconds ?? 220;
	}

	schedule(previous: CalendarSettings, impact: CalendarSettingsImpact): void {
		this.setStatus('saving');
		if (!this.pending) {
			this.pending = { previous: structuredClone(previous), impact };
		} else {
			this.pending.impact = mergeImpact(this.pending.impact, impact);
		}
		if (this.timer !== undefined) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = undefined;
			void this.flush().catch(() => undefined);
		}, this.debounceMilliseconds);
	}

	async flush(): Promise<void> {
		if (this.timer !== undefined) {
			window.clearTimeout(this.timer);
			this.timer = undefined;
		}
		if (!this.running) {
			this.running = this.drain().finally(() => {
				this.running = undefined;
			});
		}
		await this.running;
	}

	hasPendingChanges(): boolean {
		return this.pending !== undefined || this.running !== undefined;
	}

	getStatus(): CalendarSettingsSaveState {
		return this.status;
	}

	private async drain(): Promise<void> {
		while (this.pending) {
			const pending = this.pending;
			this.pending = undefined;
			const next = structuredClone(this.options.getSettings());
			try {
				await this.options.saveData(next);
			} catch (error) {
				const newerPending = this.getPending();
				if (!newerPending) this.pending = pending;
				else {
					newerPending.previous = pending.previous;
					newerPending.impact = mergeImpact(pending.impact, newerPending.impact);
				}
				this.setStatus('error');
				throw error;
			}
			const newerPending = this.getPending();
			if (newerPending) {
				newerPending.previous = pending.previous;
				newerPending.impact = mergeImpact(pending.impact, newerPending.impact);
				continue;
			}
			await this.options.applyImpact(pending.previous, next, pending.impact);
			this.setStatus('saved');
		}
	}

	private getPending(): PendingSettingsSave | undefined {
		return this.pending;
	}

	private setStatus(status: CalendarSettingsSaveState): void {
		if (status === this.status) return;
		this.status = status;
		this.options.onStatusChange?.(status);
	}
}

function mergeImpact(left: CalendarSettingsImpact, right: CalendarSettingsImpact): CalendarSettingsImpact {
	if (left === 'index' || right === 'index') return 'index';
	if (left === 'render' || right === 'render') return 'render';
	return 'save';
}
