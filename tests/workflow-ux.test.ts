import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CALENDAR_TEXT_KEYS, calendarText } from '../src/calendar-locale';
import {
	applyCreateProfileDefaults,
	selectInitialCreateProfile,
	validateCreateEventInput,
} from '../src/create-event-state';
import { millisecondsUntilNextCalendarDay } from '../src/day-rollover';
import { CalendarSourceMatcher } from '../src/matcher';
import type { CalendarSourceProfile } from '../src/models';
import {
	applySourceProfileSetupPreset,
	createSourceProfileSetupDraft,
	finalizeSourceProfileSetupDraft,
} from '../src/settings-helpers';
import { createCalendarSupportSummary } from '../src/support-summary';

const profile: CalendarSourceProfile = {
	id: 'profile-events', name: 'Events', order: 1, enabled: true, sidebarIndicatorMode: 'dots', matchMode: 'all',
	folders: ['Events'], tags: [], wikiLinkTargets: [], startProperty: 'start', allowCreate: true,
	defaultType: 'Meeting', defaultIcon: 'calendar',
};

describe('first-run and setup workflow', () => {
	it('keeps setup in a draft and creates a fresh immutable ID only when finalized', () => {
		const draft = createSourceProfileSetupDraft([], 'folder');
		expect(draft.profile.id).toBe('setup-draft');
		draft.profile.name = 'My events';
		draft.profile.startProperty = 'start';
		draft.profile.folders = ['Events'];
		applySourceProfileSetupPreset(draft, 'tag');
		expect(draft.profile.name).toBe('My events');
		expect(draft.profile.startProperty).toBe('start');
		expect(draft.profile.folders).toEqual([]);
		const final = finalizeSourceProfileSetupDraft(draft, []);
		expect(final.id).toMatch(/^profile-/);
		expect(final.id).not.toBe(draft.profile.id);
	});

	it('renders a first-run CTA and commits the finished profile with one coalesced index save', () => {
		const sidebar = readFileSync('src/sidebar-view.ts', 'utf8');
		const main = readFileSync('src/main.ts', 'utf8');
		expect(sidebar).toContain("this.text('sidebarSetupDescription')");
		expect(sidebar).toContain("this.text('setupSidebarCalendar')");
		const method = main.slice(main.indexOf('async addSetupProfile'), main.indexOf('\n\t}', main.indexOf('async addSetupProfile')));
		expect(method.match(/saveSettings/g)).toHaveLength(1);
		expect(method).toContain("'index', true");
	});
});

describe('matching inspector contract', () => {
	it('exposes the formal Folder, Tag, Wiki Link, all/any, and Start-only checks', () => {
		const matcher = new CalendarSourceMatcher({
			getFirstLinkpathDest: (link) => link.includes('Holiday') ? { path: 'Types/Holiday.md' } : null,
		}, () => ['#calendar']);
		const source = {
			...profile,
			folders: ['Events'], tags: ['calendar'], wikiLinkProperty: 'type', wikiLinkTargets: ['[[Types/Holiday]]'],
		};
		const result = matcher.evaluate(
			{ path: 'Events/Launch.md', basename: 'Launch', extension: 'md' },
			{ frontmatter: { start: '2026-08-11', type: '[[Types/Holiday]]' } },
			source,
		);
		expect(result.folder).toEqual({ configured: true, matched: true });
		expect(result.tag.matched).toBe(true);
		expect(result.wikiLink.matched).toBe(true);
		expect(result.matches).toBe(true);
		const startOnly = matcher.evaluate(
			{ path: 'Other.md', basename: 'Other', extension: 'md' },
			{ frontmatter: { start: '2026-08-11' } },
			{ ...source, folders: [], tags: [], wikiLinkProperty: undefined, wikiLinkTargets: [], matchFilesWithStartPropertyOnly: true },
		);
		expect(startOnly.startOnlyActive).toBe(true);
		expect(startOnly.matches).toBe(true);
	});

	it('inspects only the selected file and reuses matcher, normalizer, and style resolver', () => {
		const source = readFileSync('src/profile-inspector.ts', 'utf8');
		expect(source).toContain('plugin.sourceMatcher.evaluate');
		expect(source).toContain('new CalendarItemNormalizer()');
		expect(source).toContain('new CalendarStyleResolver().resolve');
		expect(source).not.toContain('getMarkdownFiles()');
	});
});

describe('Sidebar semantics, Agenda, keyboard, and rollover', () => {
	it('keeps Create Event and Agenda in the date context menu instead of overlay buttons', () => {
		const source = readFileSync('src/sidebar-view.ts', 'utf8');
		expect(source).toContain("indicators.createEl('button'");
		expect(source).toContain("cls: 'calendar-note-overflow'");
		expect(source).not.toContain('calendar-note-date-add');
		expect(source).not.toContain('calendar-note-date-agenda');
		expect(source).toContain("setTitle(this.text('viewAgenda'))");
		expect(source).toContain("setTitle(this.text('createEvent'))");
		expect(source).not.toContain("createSpan({\n\t\t\t\tcls: 'calendar-note-indicator");
		expect(source).not.toContain('attr: { title:');
	});

	it('opens the date-specific Sidebar Agenda and preserves index order without a vault scan', () => {
		const sidebar = readFileSync('src/sidebar-view.ts', 'utf8');
		const agenda = readFileSync('src/sidebar-agenda-modal.ts', 'utf8');
		expect(sidebar).toContain('new SidebarAgendaModal(this.plugin, date, this.plugin.index.getItemsForDate(date)');
		expect(agenda).toContain('for (const item of this.items)');
		expect(agenda).not.toContain('getMarkdownFiles');
	});

	it('supports Arrow, Page, Shift-year, and Home navigation', () => {
		const source = readFileSync('src/sidebar-view.ts', 'utf8');
		for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home']) expect(source).toContain(key);
		expect(source).toContain('event.shiftKey ? 12 : 1');
		expect(source).toContain('pendingFocusKey');
	});

	it('computes a single next-day timer rather than polling continuously', () => {
		const now = Date.UTC(2026, 7, 11, 23, 59, 0);
		const delay = millisecondsUntilNextCalendarDay({ mode: 'utc' }, now);
		expect(delay).toBeGreaterThanOrEqual(60_000);
		expect(delay).toBeLessThan(121_000);
		const source = readFileSync('src/day-rollover.ts', 'utf8');
		expect(source).not.toContain('setInterval');
		expect(source).toContain('window.clearTimeout');
	});

	it('resizes Sidebar icon frames from actual indicator space and cleans up its observer', () => {
		const source = readFileSync('src/sidebar-view.ts', 'utf8');
		expect(source).toContain('new ResizeObserver(() => this.scheduleIndicatorSizing())');
		expect(source).toContain("indicators.style.setProperty('--calendar-note-indicator-columns'");
		expect(source).toContain("indicators.style.setProperty('--calendar-note-indicator-rows'");
		expect(source).toContain('indicators.clientWidth - horizontalPadding');
		expect(source).toContain('indicators.clientHeight - verticalPadding');
		expect(source).toContain('this.resizeObserver?.disconnect()');
	});
});

describe('Create Event workflow', () => {
	it('uses requested then last-used stable Profile IDs with a safe fallback', () => {
		const second = { ...profile, id: 'profile-second', name: 'Events' };
		expect(selectInitialCreateProfile([profile, second], profile.id, second.id)?.id).toBe(second.id);
		expect(selectInitialCreateProfile([profile, second], second.id)?.id).toBe(second.id);
		expect(selectInitialCreateProfile([profile], 'missing')?.id).toBe(profile.id);
	});

	it('does not overwrite dirty Type or style fields when switching Profile', () => {
		const input = {
			profileId: profile.id, title: 'Launch', startDate: '2026-08-11', endDate: '2026-08-11',
			type: 'Custom', icon: 'star', backgroundColor: '#123456', textColor: '#ffffff', collision: 'append-number' as const,
		};
		applyCreateProfileDefaults(input, { ...profile, id: 'other', defaultType: 'Other' }, new Set(['type', 'icon', 'backgroundColor', 'textColor']));
		expect(input).toMatchObject({ profileId: 'other', type: 'Custom', icon: 'star', backgroundColor: '#123456', textColor: '#ffffff' });
	});

	it('validates inline required fields and inclusive date order', () => {
		expect(validateCreateEventInput({ profileId: profile.id, title: '', startDate: '2026-08-11' }, [profile]).message).toBe('eventTitleRequired');
		expect(validateCreateEventInput({ profileId: profile.id, title: 'A', startDate: '2026-08-11', endDate: '2026-08-10' }, [profile]).message).toBe('endBeforeStart');
		expect(validateCreateEventInput({ profileId: profile.id, title: 'A', startDate: '2026-08-11', endDate: '2026-08-11' }, [profile]).valid).toBe(true);
	});

	it('has collapsed advanced details, keyboard submit, and duplicate-submit protection', () => {
		const source = readFileSync('src/create-event-modal.ts', 'utf8');
		expect(source).toContain("createEl('details'");
		expect(source).toContain("event.key === 'Enter'");
		expect(source).toContain('if (this.submitting) return');
		expect(source).toContain("this.plugin.saveSettings(previous, 'save')");
	});
});

describe('localization, commands, diagnostics, and boundaries', () => {
	it('returns every typed UI key in all six locale choices', () => {
		for (const locale of ['system', 'en', 'zh-TW', 'zh-CN', 'ja', 'ko'] as const) {
			for (const key of CALENDAR_TEXT_KEYS) expect(calendarText(locale, key, {}, 'en')).not.toBe('');
		}
	});

	it('registers fixed command IDs and a single searchable Profile picker', () => {
		const source = readFileSync('src/commands.ts', 'utf8');
		for (const id of ['open-sidebar-calendar', 'go-to-today', 'show-todays-events', 'create-event', 'create-event-with-source-profile', 'refresh-sidebar-index', 'open-calendar-diagnostics']) {
			expect(source).toContain(`id: '${id}'`);
		}
		expect(source).toContain('new SourceProfilePickerModal');
	});

	it('adds local-only list filters and direct Enable or Disable actions', () => {
		const source = readFileSync('src/settings.ts', 'utf8');
		expect(source).toContain("orderedProfiles.length >= 8");
		expect(source).toContain("typeStyleRules.length >= 8");
		expect(source).toContain("profile.enabled ? 'disable' : 'enable'");
		expect(source).toContain("rule.enabled ? 'disable' : 'enable'");
		expect(source).toContain('Filters only the current settings list and never scans the vault.');
	});

	it('creates a sanitized support summary unless paths are explicitly included', () => {
		const input = {
			pluginVersion: '0.5.0', platform: 'Desktop' as const, indexState: 'ready', profileCount: 1, enabledProfileCount: 1,
			eventCount: 0, settingsSchemaVersion: 9,
			diagnostics: [{ id: 'd', code: 'invalid-start-date' as const, severity: 'error' as const, message: 'Invalid', filePath: 'Private/Secret.md', sourceProfileId: 'p' }],
		};
		const safe = createCalendarSupportSummary(input);
		expect(safe).not.toContain('Private/Secret.md');
		expect(safe).not.toContain('filePaths');
		expect(createCalendarSupportSummary(input, true)).toContain('Private/Secret.md');
	});

	it('keeps Sidebar workflow code out of Bases data authority', () => {
		const bases = readFileSync('src/bases-view.ts', 'utf8');
		expect(bases).toContain('this.data.data');
		expect(bases).toContain('this.data.properties');
		expect(bases).not.toContain('sourceProfiles');
		expect(bases).not.toContain('SetupAssistantModal');
	});
});
