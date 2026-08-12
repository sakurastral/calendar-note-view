import { describe, expect, it, vi } from 'vitest';
import type { CalendarSourceProfile } from '../src/models';
import { DEFAULT_EVENT_PROFILE, loadCalendarSettings } from '../src/settings-data';
import {
	createSourceProfileFromPreset,
	createTypeRule,
	createUniqueName,
	dateFormatMode,
	describeMatching,
	describeProfileSource,
	duplicateSourceProfile,
	duplicateTypeRule,
	getSourceGroupCount,
	getStableProfilePageName,
	getStableTypeRulePageName,
	moveItem,
	normalizeTagToken,
	normalizeWikiLinkToken,
	validateSourceProfile,
} from '../src/settings-helpers';

describe('settings UX helpers', () => {
	it('creates safe Source Profile presets with unique names and immutable IDs', () => {
		vi.stubGlobal('crypto', { randomUUID: vi.fn()
			.mockReturnValueOnce('folder-id')
			.mockReturnValueOnce('start-id') });
		const existing = [{ ...structuredClone(DEFAULT_EVENT_PROFILE), id: 'existing', name: 'Folder events', order: 1 }];
		const folder = createSourceProfileFromPreset(existing, 'folder');
		const startOnly = createSourceProfileFromPreset([...existing, folder], 'start-only');

		expect(folder).toMatchObject({ id: 'profile-folder-id', name: 'Folder events 2', enabled: false, order: 2 });
		expect(folder.matchFilesWithStartPropertyOnly).toBe(false);
		expect(startOnly).toMatchObject({ id: 'profile-start-id', name: 'Property events', enabled: false, order: 3 });
		expect(startOnly.matchFilesWithStartPropertyOnly).toBe(true);
		vi.unstubAllGlobals();
	});

	it('duplicates every Profile field without sharing identity or mutable arrays', () => {
		vi.stubGlobal('crypto', { randomUUID: () => 'copy-id' });
		const source = {
			...structuredClone(DEFAULT_EVENT_PROFILE),
			id: 'source', name: 'Events', order: 1, enabled: true,
			folders: ['Events'], tags: ['#calendar'], wikiLinkTargets: ['[[Holiday]]'],
			wikiLinkProperty: 'type', startProperty: 'start', allowCreate: true,
		};
		const copy = duplicateSourceProfile([source], source.id);
		expect(copy).toMatchObject({ id: 'profile-copy-id', name: 'Events copy', order: 2, folders: ['Events'], tags: ['#calendar'] });
		copy!.folders.push('Archive');
		expect(source.folders).toEqual(['Events']);

		const reloaded = loadCalendarSettings({ schemaVersion: 7, sourceProfiles: [source, copy], typeStyleRules: [] }).settings;
		expect(reloaded.sourceProfiles[1]).toMatchObject({ id: 'profile-copy-id', name: 'Events copy', folders: ['Events', 'Archive'] });
		vi.unstubAllGlobals();
	});

	it('keeps declarative page identity stable when display names change', () => {
		const profile = { ...structuredClone(DEFAULT_EVENT_PROFILE), id: 'profile-stable-id', name: 'Before' };
		const rule = { id: 'rule-stable-id', enabled: true, typeValue: 'Before' };
		const profilePage = getStableProfilePageName(profile);
		const rulePage = getStableTypeRulePageName(rule);
		profile.name = 'After';
		rule.typeValue = 'After';
		expect(getStableProfilePageName(profile)).toBe(profilePage);
		expect(getStableTypeRulePageName(rule)).toBe(rulePage);
	});

	it('describes all, any, and Start-only matching without bypassing configured groups', () => {
		const profile: CalendarSourceProfile = {
			...structuredClone(DEFAULT_EVENT_PROFILE),
			folders: ['Events', 'Meetings'], tags: ['calendar'], startProperty: 'start', matchMode: 'all',
		};
		expect(getSourceGroupCount(profile)).toBe(2);
		expect(describeMatching(profile)).toBe('Matches notes in Events or Meetings and notes tagged #calendar.');
		profile.matchMode = 'any';
		expect(describeMatching(profile)).toContain(' or notes tagged #calendar');
		profile.matchFilesWithStartPropertyOnly = true;
		expect(describeMatching(profile)).not.toContain('Start property only');
		profile.folders = [];
		profile.tags = [];
		expect(describeMatching(profile)).toBe('Matches notes containing the configured Start property only.');
		expect(describeProfileSource(profile)).toBe('Start property only');
	});

	it('reports inline Profile configuration problems without rejecting duplicate names', () => {
		const profile = {
			...structuredClone(DEFAULT_EVENT_PROFILE),
			id: 'one', name: 'Events', enabled: true, startProperty: '',
			wikiLinkProperty: 'type', wikiLinkTargets: [], allowCreate: true,
			createFolder: 'Missing', noteTemplatePath: 'Templates/Missing.md', titleDateFormat: 'bad',
		};
		const duplicate = { ...structuredClone(DEFAULT_EVENT_PROFILE), id: 'two', name: 'events' };
		const app = { vault: { getFolderByPath: () => null, getFileByPath: () => null } };
		const codes = validateSourceProfile(profile, [profile, duplicate], app as never).map((issue) => issue.code);
		expect(codes).toEqual(expect.arrayContaining([
			'missing-start', 'incomplete-wiki-link', 'missing-folder', 'missing-template', 'invalid-date-format', 'duplicate-name',
		]));
	});

	it('normalizes creation folder separators before checking whether it exists', () => {
		const profile = {
			...structuredClone(DEFAULT_EVENT_PROFILE),
			id: 'one', enabled: true, startProperty: 'start', matchFilesWithStartPropertyOnly: true,
			allowCreate: true, createFolder: '/Project\\Calendar//',
		};
		const getFolderByPath = vi.fn((path: string) => path === 'Project/Calendar' ? { path } : null);
		const app = { vault: { getFolderByPath, getFileByPath: () => null } };
		const codes = validateSourceProfile(profile, [profile], app as never).map((issue) => issue.code);

		expect(getFolderByPath).toHaveBeenCalledWith('Project/Calendar');
		expect(codes).not.toContain('missing-folder');
	});

	it('normalizes tokens, format modes, names, and accessible move operations', () => {
		expect(normalizeTagToken('calendar')).toBe('#calendar');
		expect(normalizeTagToken('##calendar/holiday')).toBe('#calendar/holiday');
		expect(normalizeWikiLinkToken('Events/Holiday')).toBe('[[Events/Holiday]]');
		expect(dateFormatMode('DD/MM/YYYY')).toBe('DD/MM/YYYY');
		expect(dateFormatMode('YYYY.MM.DD')).toBe('custom');
		expect(createUniqueName(['New type', 'New type 2'], 'New type')).toBe('New type 3');
		const values = ['a', 'b', 'c'];
		expect(moveItem(values, 2, 0)).toBe(true);
		expect(values).toEqual(['c', 'a', 'b']);
		expect(moveItem(values, 0, -1)).toBe(false);
		const migrated = loadCalendarSettings({ schemaVersion: 7, weekendDays: [6, 0, 6] }).settings;
		expect(migrated.weekendDays).toEqual([0, 6]);
		expect(loadCalendarSettings(JSON.parse(JSON.stringify(migrated))).settings.weekendDays).toEqual([0, 6]);
	});

	it('duplicates Event Type Rules with stable IDs and reload-safe values', () => {
		vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('new').mockReturnValueOnce('copy') });
		const existing = [{ id: 'holiday', enabled: true, typeValue: 'Holiday', icon: 'calendar', backgroundColor: '#fff', textColor: '#000' }];
		const created = createTypeRule(existing);
		const copy = duplicateTypeRule(existing, 'holiday');
		expect(created).toMatchObject({ id: 'rule-new', typeValue: 'New type' });
		expect(copy).toMatchObject({ id: 'rule-copy', typeValue: 'Holiday copy', icon: 'calendar', backgroundColor: '#fff', textColor: '#000' });
		vi.unstubAllGlobals();
	});
});
