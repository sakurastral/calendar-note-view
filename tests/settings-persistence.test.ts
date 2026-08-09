import { describe, expect, it, vi } from 'vitest';
import type { CalendarSettings } from '../src/models';
import { DEFAULT_SETTINGS } from '../src/settings-data';
import { CalendarSettingsPersistence } from '../src/settings-persistence';

function settings(name: string): CalendarSettings {
	const value = structuredClone(DEFAULT_SETTINGS);
	value.sourceProfiles[0]!.name = name;
	return value;
}

describe('settings persistence', () => {
	it('coalesces rapid input into one latest save and one index rebuild', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		let current = settings('E');
		const saved: CalendarSettings[] = [];
		const applyImpact = vi.fn();
		const persistence = new CalendarSettingsPersistence({
			getSettings: () => current,
			saveData: async (value) => { saved.push(structuredClone(value)); },
			applyImpact,
			debounceMilliseconds: 10_000,
		});

		for (const name of ['Ev', 'Eve', 'Events']) {
			const previous = structuredClone(current);
			current = settings(name);
			persistence.schedule(previous, 'index');
		}
		await persistence.flush();

		expect(saved).toHaveLength(1);
		expect(saved[0]?.sourceProfiles[0]?.name).toBe('Events');
		expect(applyImpact).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});

	it('serializes slow saveData calls so the newest state is always written last', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		let current = settings('First');
		const saved: string[] = [];
		let releaseFirst!: () => void;
		const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
		let calls = 0;
		const applyImpact = vi.fn();
		const persistence = new CalendarSettingsPersistence({
			getSettings: () => current,
			saveData: async (value) => {
				saved.push(value.sourceProfiles[0]?.name ?? '');
				calls += 1;
				if (calls === 1) await firstWrite;
			},
			applyImpact,
			debounceMilliseconds: 10_000,
		});

		persistence.schedule(settings('Before first'), 'save');
		const flushing = persistence.flush();
		await Promise.resolve();
		const previous = structuredClone(current);
		current = settings('Latest');
		persistence.schedule(previous, 'save');
		releaseFirst();
		await flushing;

		expect(saved).toEqual(['First', 'Latest']);
		expect(saved.at(-1)).toBe('Latest');
		expect(applyImpact).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});
});
