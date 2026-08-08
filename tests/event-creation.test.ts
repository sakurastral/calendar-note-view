import type { App, TFile } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { EventNoteCreationService } from '../src/event-creation';
import { applyEventTemplate, getEventTemplatePreview, sanitizeFileName } from '../src/event-template';
import type { CalendarSettings, CalendarSourceProfile } from '../src/models';
import { DEFAULT_EVENT_PROFILE, DEFAULT_SETTINGS } from '../src/settings-data';

interface FakeFile {
	path: string;
	basename: string;
	extension: string;
	content: string;
}

class FakeEventApp {
	readonly files = new Map<string, FakeFile>();
	readonly folders = new Set<string>();
	readonly frontmatter = new Map<string, Record<string, unknown>>();
	readonly reindexed: string[] = [];
	readonly vault = {
		getAbstractFileByPath: (path: string): FakeFile | { path: string } | null => this.files.get(path) ?? (this.folders.has(path) ? { path } : null),
		getFileByPath: (path: string): TFile | null => (this.files.get(path) as unknown as TFile | undefined) ?? null,
		createFolder: async (path: string): Promise<void> => { this.folders.add(path); },
		cachedRead: async (file: FakeFile): Promise<string> => file.content,
		create: async (path: string, content: string): Promise<TFile> => {
			const name = path.split('/').at(-1) ?? path;
			const file = { path, basename: name.replace(/\.md$/i, ''), extension: 'md', content };
			this.files.set(path, file);
			return file as unknown as TFile;
		},
	};
	readonly fileManager = {
		processFrontMatter: async (file: FakeFile, callback: (frontmatter: Record<string, unknown>) => void): Promise<void> => {
			const value: Record<string, unknown> = {};
			callback(value);
			this.frontmatter.set(file.path, value);
		},
	};

	add(path: string, content = ''): void {
		const name = path.split('/').at(-1) ?? path;
		this.files.set(path, { path, basename: name.replace(/\.md$/i, ''), extension: 'md', content });
	}
}

function profile(overrides: Partial<CalendarSourceProfile> = {}): CalendarSourceProfile {
	return { ...structuredClone(DEFAULT_EVENT_PROFILE), ...overrides };
}

function settings(sourceProfile: CalendarSourceProfile): CalendarSettings {
	return {
		...structuredClone(DEFAULT_SETTINGS),
		eventPropertyDateFormat: 'DD/MM/YYYY',
		sourceProfiles: [sourceProfile],
	};
}

describe('event templates', () => {
	it('formats every supported variable and separates link display names', () => {
		const sourceProfile = profile({ name: 'Holidays' });
		const result = applyEventTemplate(
			'{date-range}|{start-date}|{end-date}|{year}|{month}|{day}|{title}|{type}|{type-name}|{profile}',
			{ title: 'Typhoon day', startDate: '2024-07-24', endDate: '2024-07-26', type: '[[Holiday|Public holiday]]', profile: sourceProfile },
		);
		expect(result).toBe('2024-07-24～2024-07-26|2024-07-24|2024-07-26|2024|07|24|Typhoon day|[[Holiday|Public holiday]]|Holiday|Holidays');
	});

	it('previews sanitized filenames and profile paths', () => {
		const sourceProfile = profile({ createFolder: '/Events//Holidays/', fileNameTemplate: '{date-range}《{title}》' });
		const preview = getEventTemplatePreview({ title: 'Storm: day?', startDate: '2024-07-24', endDate: '2024-07-24', profile: sourceProfile });
		expect(preview).toMatchObject({ fileName: '2024-07-24《Storm- day-》.md', createFolder: 'Events/Holidays' });
		expect(sanitizeFileName('  ')).toBe('Untitled event');
	});
});

describe('event note creation', () => {
	it('creates folders, applies a template, writes mapped properties, and reindexes', async () => {
		const app = new FakeEventApp();
		app.add('Templates/Event.md', '# {title}\n{date-range}');
		const sourceProfile = profile({
			createFolder: 'Events/Holidays',
			noteTemplatePath: 'Templates/Event',
			generatedTitleProperty: 'title',
		});
		const current = settings(sourceProfile);
		const index = { reindexFile: async (file: TFile): Promise<void> => { app.reindexed.push(file.path); } };
		const service = new EventNoteCreationService(app as unknown as App, () => current, index as never);
		const result = await service.create({
			profileId: sourceProfile.id,
			title: 'Typhoon day',
			startDate: '2024-07-24',
			endDate: '2024-07-26',
			type: '[[Holiday]]',
			icon: 'cloud-rain',
			backgroundColor: '#123456',
		});

		expect(result.path).toBe('Events/Holidays/2024-07-24～2024-07-26《Typhoon day》.md');
		expect(app.folders).toEqual(new Set(['Events', 'Events/Holidays']));
		expect(app.files.get(result.path)?.content).toBe('# Typhoon day\n2024-07-24～2024-07-26');
		expect(app.frontmatter.get(result.path)).toMatchObject({
			title: '2024-07-24～2024-07-26《Typhoon day》',
			'calendar-event-start': '24/07/2024',
			'calendar-event-end': '26/07/2024',
			'calendar-event-title': 'Typhoon day',
			'calendar-event-type': '[[Holiday]]',
			'calendar-event-icon': 'cloud-rain',
			'calendar-event-color': '#123456',
		});
		expect(app.reindexed).toEqual([result.path]);
	});

	it('never overwrites existing files and can append a number or cancel', async () => {
		const app = new FakeEventApp();
		const sourceProfile = profile();
		const current = settings(sourceProfile);
		const original = 'Events/2024-07-24《Existing》.md';
		app.folders.add('Events');
		app.add(original);
		const index = { reindexFile: async (): Promise<void> => undefined };
		const service = new EventNoteCreationService(app as unknown as App, () => current, index as never);
		const appended = await service.create({ profileId: sourceProfile.id, title: 'Existing', startDate: '2024-07-24' });
		expect(appended.path).toBe('Events/2024-07-24《Existing》 2.md');
		const cancelled = await service.create({ profileId: sourceProfile.id, title: 'Existing', startDate: '2024-07-24', collision: 'cancel' });
		expect(cancelled.status).toBe('cancelled');
		expect(app.files.get(original)?.content).toBe('');
	});

	it('omits a cleared end property and rejects unsafe colors', async () => {
		const app = new FakeEventApp();
		const sourceProfile = profile();
		const current = settings(sourceProfile);
		const index = { reindexFile: async (): Promise<void> => undefined };
		const service = new EventNoteCreationService(app as unknown as App, () => current, index as never);
		const result = await service.create({ profileId: sourceProfile.id, title: 'Single', startDate: '2024-07-24', endDate: '' });
		expect(app.frontmatter.get(result.path)).not.toHaveProperty('calendar-event-end');
		expect(() => service.preview({
			profileId: sourceProfile.id,
			title: 'Unsafe',
			startDate: '2024-07-24',
			backgroundColor: 'red; display:none',
		})).toThrow('not a safe CSS color');
	});
});
