import type { App, EventRef, TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { CalendarDiagnosticsService } from '../src/diagnostics';
import { CalendarIndexService, type CalendarIndexChange } from '../src/index-service';
import type { CalendarMetadata, CalendarSettings, CalendarSourceProfile } from '../src/models';
import { DEFAULT_EVENT_PROFILE, DEFAULT_SETTINGS } from '../src/settings-data';

type Listener = (...arguments_: unknown[]) => void;

interface FakeFile {
	path: string;
	basename: string;
	extension: string;
}

class FakeEmitter {
	private readonly listeners = new Map<string, Set<Listener>>();

	on(event: string, listener: Listener): EventRef {
		const listeners = this.listeners.get(event) ?? new Set<Listener>();
		listeners.add(listener);
		this.listeners.set(event, listeners);
		return { event, listener };
	}

	offref(ref: EventRef): void {
		const value = ref as unknown as { event: string; listener: Listener };
		this.listeners.get(value.event)?.delete(value.listener);
	}

	emit(event: string, ...arguments_: unknown[]): void {
		for (const listener of this.listeners.get(event) ?? []) listener(...arguments_);
	}
}

class FakeApp {
	readonly vaultEvents = new FakeEmitter();
	readonly metadataEvents = new FakeEmitter();
	readonly files: FakeFile[] = [];
	readonly caches = new Map<string, CalendarMetadata>();
	readonly vault = {
		getMarkdownFiles: (): TFile[] => this.files as unknown as TFile[],
		on: (event: string, listener: Listener): EventRef => this.vaultEvents.on(event, listener),
		offref: (ref: EventRef): void => this.vaultEvents.offref(ref),
	};
	readonly metadataCache = {
		getFileCache: (file: FakeFile): CalendarMetadata | null => this.caches.get(file.path) ?? null,
		on: (event: string, listener: Listener): EventRef => this.metadataEvents.on(event, listener),
		offref: (ref: EventRef): void => this.metadataEvents.offref(ref),
	};

	add(path: string, frontmatter: Record<string, unknown>): FakeFile {
		const file = toFile(path);
		this.files.push(file);
		this.caches.set(path, { frontmatter });
		return file;
	}

	remove(path: string): void {
		const index = this.files.findIndex((file) => file.path === path);
		if (index >= 0) this.files.splice(index, 1);
		this.caches.delete(path);
	}
}

function toFile(path: string): FakeFile {
	const name = path.split('/').pop() ?? path;
	return { path, basename: name.replace(/\.md$/, ''), extension: 'md' };
}

function profile(id: string, overrides: Partial<CalendarSourceProfile> = {}): CalendarSourceProfile {
	return { ...structuredClone(DEFAULT_EVENT_PROFILE), id, folders: ['Events'], matchFilesWithStartPropertyOnly: false, ...overrides };
}

function settings(profiles: CalendarSourceProfile[]): CalendarSettings {
	return { ...structuredClone(DEFAULT_SETTINGS), sourceProfiles: profiles };
}

describe('calendar index', () => {
	it('builds initially, indexes multiple profiles, and avoids duplicate items', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { 'calendar-event-start': '2024-07-24' });
		const current = settings([profile('one'), profile('two')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		expect(service.getAllItems()).toHaveLength(2);
		await service.reindexFile(app.files[0] as unknown as TFile);
		expect(service.getAllItems()).toHaveLength(2);
		service.dispose();
	});

	it('incrementally updates, renames, moves, and deletes without stale paths', async () => {
		const app = new FakeApp();
		const original = app.add('Events/A.md', { 'calendar-event-start': '2024-07-24' });
		const current = settings([profile('events')]);
		const diagnostics = new CalendarDiagnosticsService();
		const service = new CalendarIndexService(app as unknown as App, () => current, diagnostics);
		await service.initialize();

		app.caches.set(original.path, { frontmatter: { 'calendar-event-start': '2024-07-25' } });
		await service.reindexFile(original as unknown as TFile);
		expect(service.getAllItems()[0]?.startDate).toBe('2024-07-25');

		app.remove(original.path);
		const renamed = app.add('Events/Renamed.md', { 'calendar-event-start': '2024-07-25' });
		await service.renameFile(renamed as unknown as TFile, original.path);
		expect(service.getAllItems().map((item) => item.filePath)).toEqual(['Events/Renamed.md']);
		expect(diagnostics.getByFile(original.path)).toEqual([]);

		app.remove(renamed.path);
		const moved = app.add('Archive/Renamed.md', { 'calendar-event-start': '2024-07-25' });
		await service.renameFile(moved as unknown as TFile, renamed.path);
		expect(service.getAllItems()).toEqual([]);

		service.removeFile(moved.path);
		expect(service.getAllItems()).toEqual([]);
		service.dispose();
	});

	it('queries inclusive ranges and applies stable documented sorting', async () => {
		const app = new FakeApp();
		app.add('Events/Single.md', { 'calendar-event-start': '2024-07-24', 'calendar-event-title': 'Single' });
		app.add('Events/Long.md', { 'calendar-event-start': '2024-07-24', 'calendar-event-end': '2024-07-27', 'calendar-event-title': 'Long' });
		app.add('Events/Short.md', { 'calendar-event-start': '2024-07-24', 'calendar-event-end': '2024-07-25', 'calendar-event-title': 'Short' });
		app.add('Events/Previous.md', { 'calendar-event-start': '2024-07-20', 'calendar-event-end': '2024-07-24', 'calendar-event-title': 'Previous' });
		const current = settings([profile('events')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		expect(service.getItemsForDate('2024-07-24').map((item) => item.title)).toEqual(['Previous', 'Long', 'Short', 'Single']);
		expect(service.getItemsInRange('2024-07-26', '2024-07-31').map((item) => item.title)).toEqual(['Long']);
		expect(() => service.getItemsInRange('invalid', '2024-07-31')).toThrow(TypeError);
		service.dispose();
	});

	it('refreshes safely and sends exactly one notification', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { 'calendar-event-start': '2024-07-24' });
		const current = settings([profile('events')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		const changes: CalendarIndexChange[] = [];
		service.subscribe((change) => changes.push(change));
		await service.refresh();
		expect(changes).toEqual([{ reason: 'rebuild' }]);
		expect(service.getAllItems()).toHaveLength(1);
		service.dispose();
	});

	it('rebuilds for relevant settings changes only', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { 'calendar-event-start': '2024-07-24' });
		let current = settings([profile('events')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		const changes: CalendarIndexChange[] = [];
		service.subscribe((change) => changes.push(change));
		const previous = structuredClone(current);
		current = { ...current, firstDayOfWeek: 1 };
		await service.handleSettingsChanged(previous, current);
		expect(changes).toEqual([]);
		const beforeProfileChange = structuredClone(current);
		current = { ...current, sourceProfiles: [profile('different')] };
		await service.handleSettingsChanged(beforeProfileChange, current);
		expect(changes).toEqual([{ reason: 'settings-change' }]);
		service.dispose();
	});
});
