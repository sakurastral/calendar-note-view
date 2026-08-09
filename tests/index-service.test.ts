import type { App, EventRef, TFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
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
		getFirstLinkpathDest: (linkpath: string): FakeFile | null => {
			const target = linkpath.replace(/\.md$/i, '');
			return this.files.find((file) => file.path.replace(/\.md$/i, '') === target || file.basename === target) ?? null;
		},
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

	renameFolder(oldPath: string, newPath: string): void {
		for (const file of this.files.filter((candidate) => candidate.path.startsWith(`${oldPath}/`))) {
			const oldFilePath = file.path;
			const cache = this.caches.get(oldFilePath);
			file.path = `${newPath}/${oldFilePath.slice(oldPath.length + 1)}`;
			this.caches.delete(oldFilePath);
			if (cache) this.caches.set(file.path, cache);
		}
	}
}

function toFile(path: string): FakeFile {
	const name = path.split('/').pop() ?? path;
	return { path, basename: name.replace(/\.md$/, ''), extension: 'md' };
}

function profile(id: string, overrides: Partial<CalendarSourceProfile> = {}): CalendarSourceProfile {
	return {
		...structuredClone(DEFAULT_EVENT_PROFILE), id, enabled: true, folders: ['Events'], startProperty: 'start',
		endProperty: 'end', titleProperty: 'event-title', matchFilesWithStartPropertyOnly: false, ...overrides,
	};
}

function settings(profiles: CalendarSourceProfile[]): CalendarSettings {
	return { ...structuredClone(DEFAULT_SETTINGS), sourceProfiles: profiles };
}

describe('calendar index', () => {
	it('indexes an Events folder profile with Start-only disabled and unrelated Wiki Link alternatives', async () => {
		const app = new FakeApp();
		app.add('Events/2026-08-04 Example.md', {
			'calendar-event-start': '2026-08-04',
			'calendar-event-end': '2026-08-05',
			'calendar-event-title': 'Example',
		});
		const current = settings([profile('events', {
			folders: ['Events'],
			wikiLinkProperty: 'event-type',
			wikiLinkTargets: ['[[holiday]]', '[[vacation]]'],
			matchMode: 'any',
			matchFilesWithStartPropertyOnly: false,
			startProperty: 'calendar-event-start',
			endProperty: 'calendar-event-end',
			titleProperty: 'calendar-event-title',
		})]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());

		await service.initialize();

		expect(service.getAllItems()).toMatchObject([{
			filePath: 'Events/2026-08-04 Example.md',
			startDate: '2026-08-04',
			endDate: '2026-08-05',
			title: 'Example',
		}]);
		service.dispose();
	});

	it('builds initially, indexes multiple profiles, and avoids duplicate items', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { start: '2024-07-24' });
		const current = settings([profile('one'), profile('two')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		expect(service.getStatus()).toBe('not-initialized');
		await service.initialize();
		expect(service.getStatus()).toBe('ready');
		expect(service.getAllItems()).toHaveLength(2);
		expect(service.getItemCountByProfile('one')).toBe(1);
		expect(service.getItemCountByProfile('two')).toBe(1);
		await service.reindexFile(app.files[0] as unknown as TFile);
		expect(service.getAllItems()).toHaveLength(2);
		service.dispose();
		expect(service.getStatus()).toBe('not-initialized');
	});

	it('incrementally updates, renames, moves, and deletes without stale paths', async () => {
		const app = new FakeApp();
		const original = app.add('Events/A.md', { start: '2024-07-24' });
		const current = settings([profile('events')]);
		const diagnostics = new CalendarDiagnosticsService();
		const service = new CalendarIndexService(app as unknown as App, () => current, diagnostics);
		await service.initialize();

		app.caches.set(original.path, { frontmatter: { start: '2024-07-25' } });
		await service.reindexFile(original as unknown as TFile);
		expect(service.getAllItems()[0]?.startDate).toBe('2024-07-25');

		app.remove(original.path);
		const renamed = app.add('Events/Renamed.md', { start: '2024-07-25' });
		await service.renameFile(renamed as unknown as TFile, original.path);
		expect(service.getAllItems().map((item) => item.filePath)).toEqual(['Events/Renamed.md']);
		expect(diagnostics.getByFile(original.path)).toEqual([]);

		app.remove(renamed.path);
		const moved = app.add('Archive/Renamed.md', { start: '2024-07-25' });
		await service.renameFile(moved as unknown as TFile, renamed.path);
		expect(service.getAllItems()).toEqual([]);

		service.removeFile(moved.path);
		expect(service.getAllItems()).toEqual([]);
		service.dispose();
	});

	it('queries inclusive ranges and applies stable documented sorting', async () => {
		const app = new FakeApp();
		app.add('Events/Single.md', { start: '2024-07-24', 'event-title': 'Single' });
		app.add('Events/Long.md', { start: '2024-07-24', end: '2024-07-27', 'event-title': 'Long' });
		app.add('Events/Short.md', { start: '2024-07-24', end: '2024-07-25', 'event-title': 'Short' });
		app.add('Events/Previous.md', { start: '2024-07-20', end: '2024-07-24', 'event-title': 'Previous' });
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
		app.add('Events/A.md', { start: '2024-07-24' });
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

	it('reindexes after Obsidian resolves a property-scoped wiki link', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const app = new FakeApp();
		const event = app.add('Events/A.md', { start: '2024-07-24' });
		app.caches.set(event.path, { frontmatter: { start: '2024-07-24', 'event-type': '[[Calendar/Holiday]]' } });
		app.add('Calendar/Holiday.md', {});
		const current = settings([profile('events', {
			folders: [], wikiLinkProperty: 'event-type', wikiLinkTargets: ['[[Calendar/Holiday]]'],
		})]);
		const service = new CalendarIndexService(
			app as unknown as App,
			() => current,
			new CalendarDiagnosticsService(),
			undefined,
			0,
		);
		await service.initialize();
		expect(service.getAllItems()).toHaveLength(1);

		app.metadataEvents.emit('resolve', event);
		await new Promise((resolve) => window.setTimeout(resolve, 5));
		expect(service.getAllItems()).toHaveLength(1);
		service.dispose();
		vi.unstubAllGlobals();
	});

	it('rebuilds for relevant settings changes only', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { start: '2024-07-24' });
		let current = settings([profile('events')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		const changes: CalendarIndexChange[] = [];
		service.subscribe((change) => changes.push(change));
		const previous = structuredClone(current);
		current = { ...current, firstDayOfWeek: 1 };
		await service.handleSettingsChanged(previous, current);
		expect(changes).toEqual([]);
		const beforeNameChange = structuredClone(current);
		current = { ...current, sourceProfiles: [{ ...current.sourceProfiles[0]!, name: 'Renamed' }] };
		await service.handleSettingsChanged(beforeNameChange, current);
		expect(changes).toEqual([]);
		const beforeOrderChange = structuredClone(current);
		current = { ...current, sourceProfiles: [{ ...current.sourceProfiles[0]!, order: 4 }] };
		await service.handleSettingsChanged(beforeOrderChange, current);
		expect(changes).toEqual([]);
		const beforeIndicatorChange = structuredClone(current);
		current = { ...current, sourceProfiles: [{ ...current.sourceProfiles[0]!, sidebarIndicatorMode: 'icons' }] };
		await service.handleSettingsChanged(beforeIndicatorChange, current);
		expect(changes).toEqual([]);
		const beforeRuleChange = structuredClone(current);
		current = { ...current, typeStyleRules: [{ id: 'holiday', enabled: true, typeValue: 'Holiday' }] };
		await service.handleSettingsChanged(beforeRuleChange, current);
		expect(changes).toEqual([]);
		const beforeProfileChange = structuredClone(current);
		current = { ...current, sourceProfiles: [profile('different', { folders: ['Other'] })] };
		await service.handleSettingsChanged(beforeProfileChange, current);
		expect(changes).toEqual([{ reason: 'settings-change' }]);
		service.dispose();
	});

	it('uses explicit Source Profile order for Sidebar item sorting', async () => {
		const app = new FakeApp();
		app.add('Events/A.md', { start: '2024-07-24', 'event-title': 'Same event' });
		const later = profile('later', { order: 20 });
		const earlier = profile('earlier', { order: 1 });
		const current = settings([later, earlier]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService());
		await service.initialize();
		expect(service.getAllItems().map((item) => item.sourceProfileId)).toEqual(['earlier', 'later']);
		service.dispose();
	});

	it('handles create, metadata change, delete, and Sidebar subscribers incrementally', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const app = new FakeApp();
		const current = settings([profile('events')]);
		const service = new CalendarIndexService(app as unknown as App, () => current, new CalendarDiagnosticsService(), undefined, 0);
		const render = vi.fn();
		service.subscribe(render);
		await service.initialize();
		expect(render).toHaveBeenLastCalledWith({ reason: 'initialize' });

		const created = app.add('Events/New.md', { start: '2024-08-01', 'event-title': 'New' });
		app.vaultEvents.emit('create', created);
		await new Promise((resolve) => window.setTimeout(resolve, 5));
		expect(service.getAllItems()[0]?.title).toBe('New');

		app.caches.set(created.path, { frontmatter: { start: '2024-08-02', 'event-title': 'Changed' } });
		app.metadataEvents.emit('changed', created, '', app.caches.get(created.path));
		await new Promise((resolve) => window.setTimeout(resolve, 5));
		expect(service.getAllItems()[0]).toMatchObject({ startDate: '2024-08-02', title: 'Changed' });

		app.remove(created.path);
		app.vaultEvents.emit('delete', created);
		expect(service.getAllItems()).toEqual([]);
		expect(render).toHaveBeenCalled();
		service.dispose();
		vi.unstubAllGlobals();
	});

	it('removes ghost items and diagnostics when a folder is renamed or moved', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const app = new FakeApp();
		app.add('Events/Valid.md', { start: '2024-08-01' });
		app.add('Events/Invalid.md', { start: 'not-a-date' });
		const current = settings([profile('events')]);
		const diagnostics = new CalendarDiagnosticsService();
		const service = new CalendarIndexService(app as unknown as App, () => current, diagnostics, undefined, 0);
		await service.initialize();
		expect(service.getAllItems()).toHaveLength(1);
		expect(diagnostics.getByFile('Events/Invalid.md')).toHaveLength(1);

		app.renameFolder('Events', 'Archive');
		app.vaultEvents.emit('rename', { path: 'Archive' }, 'Events');
		await new Promise((resolve) => window.setTimeout(resolve, 5));
		expect(service.getAllItems()).toEqual([]);
		expect(diagnostics.getByFile('Events/Invalid.md')).toEqual([]);
		expect(diagnostics.getAll().filter((diagnostic) => diagnostic.filePath.startsWith('Events/'))).toEqual([]);
		service.dispose();
		vi.unstubAllGlobals();
	});
});
