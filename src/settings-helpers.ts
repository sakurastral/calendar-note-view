import type { App } from 'obsidian';
import { isSupportedDateFormat } from './date';
import { normalizeVaultPath } from './event-template';
import type { CalendarSourceProfile, CalendarTypeStyleRule } from './models';
import { DEFAULT_EVENT_PROFILE } from './settings-data';
import { createSourceProfileId, sortSourceProfiles } from './source-profile';

export type SourceProfilePreset = 'folder' | 'tag' | 'wiki-link' | 'start-only' | 'advanced';

export interface SourceProfileSetupDraft {
	profile: CalendarSourceProfile;
	preset: SourceProfilePreset;
}

export interface ProfileValidationIssue {
	code: 'missing-start' | 'empty-source' | 'incomplete-wiki-link' | 'missing-folder' | 'missing-template' | 'invalid-date-format' | 'duplicate-name';
	message: string;
	severity: 'warning' | 'error';
}

export const DATE_FORMAT_PRESETS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;

export function createSourceProfileFromPreset(
	profiles: readonly CalendarSourceProfile[],
	preset: SourceProfilePreset,
): CalendarSourceProfile {
	const profile = structuredClone(DEFAULT_EVENT_PROFILE);
	profile.id = createSourceProfileId();
	profile.name = createUniqueName(profiles.map((candidate) => candidate.name), presetName(preset));
	profile.order = profiles.length + 1;
	profile.enabled = false;
	profile.matchFilesWithStartPropertyOnly = preset === 'start-only';
	return profile;
}

export function createSourceProfileSetupDraft(
	profiles: readonly CalendarSourceProfile[],
	preset: SourceProfilePreset = 'folder',
): SourceProfileSetupDraft {
	const profile = createSourceProfileFromPreset(profiles, preset);
	profile.id = 'setup-draft';
	profile.enabled = true;
	return { profile, preset };
}

export function applySourceProfileSetupPreset(
	draft: SourceProfileSetupDraft,
	preset: SourceProfilePreset,
): void {
	draft.preset = preset;
	draft.profile.folders = [];
	draft.profile.tags = [];
	draft.profile.wikiLinkProperty = undefined;
	draft.profile.wikiLinkTargets = [];
	draft.profile.matchFilesWithStartPropertyOnly = preset === 'start-only';
}

export function finalizeSourceProfileSetupDraft(
	draft: SourceProfileSetupDraft,
	profiles: readonly CalendarSourceProfile[],
): CalendarSourceProfile {
	const profile = structuredClone(draft.profile);
	profile.id = createSourceProfileId();
	profile.name = createUniqueName(profiles.map((candidate) => candidate.name), profile.name);
	profile.order = profiles.length + 1;
	return profile;
}

export function duplicateSourceProfile(
	profiles: readonly CalendarSourceProfile[],
	profileId: string,
): CalendarSourceProfile | undefined {
	const source = profiles.find((profile) => profile.id === profileId);
	if (!source) return undefined;
	const duplicate = structuredClone(source);
	duplicate.id = createSourceProfileId();
	duplicate.name = createUniqueName(profiles.map((profile) => profile.name), `${source.name} copy`);
	duplicate.order = profiles.length + 1;
	return duplicate;
}

export function createTypeRule(rules: readonly CalendarTypeStyleRule[]): CalendarTypeStyleRule {
	return {
		id: createStableId('rule'),
		enabled: true,
		typeValue: createUniqueName(rules.map((rule) => rule.typeValue), 'New type'),
	};
}

export function duplicateTypeRule(
	rules: readonly CalendarTypeStyleRule[],
	ruleId: string,
): CalendarTypeStyleRule | undefined {
	const source = rules.find((rule) => rule.id === ruleId);
	if (!source) return undefined;
	return {
		...structuredClone(source),
		id: createStableId('rule'),
		typeValue: createUniqueName(rules.map((rule) => rule.typeValue), `${source.typeValue} copy`),
	};
}

export function createUniqueName(existingNames: readonly string[], requestedName: string): string {
	const normalized = new Set(existingNames.map((name) => name.trim().toLocaleLowerCase()));
	const base = requestedName.trim() || 'Untitled';
	if (!normalized.has(base.toLocaleLowerCase())) return base;
	let suffix = 2;
	while (normalized.has(`${base} ${suffix}`.toLocaleLowerCase())) suffix += 1;
	return `${base} ${suffix}`;
}

export function moveItem<T>(values: T[], oldIndex: number, newIndex: number): boolean {
	if (oldIndex < 0 || oldIndex >= values.length || newIndex < 0 || newIndex >= values.length || oldIndex === newIndex) return false;
	const [value] = values.splice(oldIndex, 1);
	if (value === undefined) return false;
	values.splice(newIndex, 0, value);
	return true;
}

export function getStableProfilePageName(profile: CalendarSourceProfile): string {
	return `Source profile · ${shortId(profile.id, 'profile-')}`;
}

export function getStableTypeRulePageName(rule: CalendarTypeStyleRule): string {
	return `Event type rule · ${shortId(rule.id, 'rule-')}`;
}

export function getSourceGroupCount(profile: CalendarSourceProfile): number {
	return Number(profile.folders.some(Boolean))
		+ Number(profile.tags.some(Boolean))
		+ Number(Boolean(profile.wikiLinkProperty?.trim()) && profile.wikiLinkTargets.some(Boolean));
}

export function hasAnyConfiguredSource(profile: CalendarSourceProfile): boolean {
	return profile.folders.some(Boolean)
		|| profile.tags.some(Boolean)
		|| Boolean(profile.wikiLinkProperty?.trim())
		|| profile.wikiLinkTargets.some(Boolean);
}

export function describeProfileSource(profile: CalendarSourceProfile): string {
	const groups: string[] = [];
	if (profile.folders.length > 0) groups.push(`Folders: ${summarizeValues(profile.folders)}`);
	if (profile.tags.length > 0) groups.push(`Tags: ${summarizeValues(profile.tags.map(normalizeTagToken))}`);
	if (profile.wikiLinkTargets.length > 0) groups.push(`Wiki links: ${summarizeValues(profile.wikiLinkTargets)}`);
	if (groups.length === 0 && profile.matchFilesWithStartPropertyOnly) groups.push('Start property only');
	return groups.join(' · ') || 'No source condition';
}

export function describeMatching(profile: CalendarSourceProfile): string {
	const groups: string[] = [];
	if (profile.folders.length > 0) groups.push(`notes in ${joinNatural(profile.folders)}`);
	if (profile.tags.length > 0) groups.push(`notes tagged ${joinNatural(profile.tags.map(normalizeTagToken))}`);
	if (profile.wikiLinkProperty?.trim() && profile.wikiLinkTargets.length > 0) {
		groups.push(`notes whose ${profile.wikiLinkProperty.trim()} property links to ${joinNatural(profile.wikiLinkTargets)}`);
	}
	if (groups.length === 0) {
		return profile.matchFilesWithStartPropertyOnly
			? 'Matches notes containing the configured Start property only.'
			: 'No source condition is configured, so this profile does not match notes.';
	}
	const separator = profile.matchMode === 'all' ? ' and ' : ' or ';
	return `Matches ${groups.join(separator)}.`;
}

export function validateSourceProfile(
	profile: CalendarSourceProfile,
	profiles: readonly CalendarSourceProfile[],
	app?: Pick<App, 'vault'>,
): ProfileValidationIssue[] {
	const issues: ProfileValidationIssue[] = [];
	if (!profile.startProperty.trim()) {
		issues.push({ code: 'missing-start', severity: 'error', message: 'Choose a Start property before enabling this profile.' });
	}
	const hasWikiProperty = Boolean(profile.wikiLinkProperty?.trim());
	const hasWikiTargets = profile.wikiLinkTargets.some(Boolean);
	if (hasWikiProperty !== hasWikiTargets) {
		issues.push({ code: 'incomplete-wiki-link', severity: 'error', message: 'Wiki Link matching requires both a property and at least one target.' });
	}
	if (profile.enabled && !hasAnyConfiguredSource(profile) && !profile.matchFilesWithStartPropertyOnly) {
		issues.push({ code: 'empty-source', severity: 'error', message: 'Add a source condition or enable Match start property only.' });
	}
	if (profiles.some((candidate) => candidate.id !== profile.id && candidate.name.trim().toLocaleLowerCase() === profile.name.trim().toLocaleLowerCase())) {
		issues.push({ code: 'duplicate-name', severity: 'warning', message: 'Another profile has this name. Stable IDs keep them separate, but distinct names are easier to identify.' });
	}
	if (profile.allowCreate && app) {
		const folder = normalizeVaultPath(profile.createFolder ?? '');
		if (folder && !app.vault.getFolderByPath(folder)) {
			issues.push({ code: 'missing-folder', severity: 'warning', message: `The creation folder “${folder}” does not exist yet.` });
		}
		const template = profile.noteTemplatePath?.trim();
		if (template && !app.vault.getFileByPath(template)) {
			issues.push({ code: 'missing-template', severity: 'warning', message: `The template “${template}” could not be found.` });
		}
		if (profile.titleDateFormat?.trim() && !isSupportedDateFormat(profile.titleDateFormat)) {
			issues.push({ code: 'invalid-date-format', severity: 'error', message: 'Title date format must contain YYYY, MM, and DD exactly once.' });
		}
	}
	return issues;
}

export function normalizeMultiValue(value: string): string {
	return value.trim();
}

export function normalizeTagToken(value: string): string {
	const tag = value.trim().replace(/^#+/, '');
	return tag ? `#${tag}` : '';
}

export function normalizeWikiLinkToken(value: string): string {
	const target = value.trim();
	if (!target) return '';
	return target.startsWith('[[') && target.endsWith(']]') ? target : `[[${target}]]`;
}

export function dateFormatMode(format: string): string {
	return DATE_FORMAT_PRESETS.includes(format as typeof DATE_FORMAT_PRESETS[number]) ? format : 'custom';
}

export function countEventsForProfile(items: readonly { sourceProfileId: string }[], profileId: string): number {
	return items.reduce((count, item) => count + Number(item.sourceProfileId === profileId), 0);
}

export function sortProfilesForDisplay(profiles: readonly CalendarSourceProfile[]): CalendarSourceProfile[] {
	return sortSourceProfiles(profiles);
}

function presetName(preset: SourceProfilePreset): string {
	if (preset === 'folder') return 'Folder events';
	if (preset === 'tag') return 'Tagged events';
	if (preset === 'wiki-link') return 'Linked events';
	if (preset === 'start-only') return 'Property events';
	return 'New profile';
}

function createStableId(prefix: string): string {
	const uuid = crypto?.randomUUID?.();
	return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`}`;
}

function shortId(value: string, prefix: string): string {
	const normalized = value.replace(new RegExp(`^${prefix}`), '');
	return normalized.length > 8 ? normalized.slice(0, 8) : normalized;
}

function summarizeValues(values: readonly string[]): string {
	if (values.length <= 2) return values.join(', ');
	return `${values.slice(0, 2).join(', ')} +${values.length - 2}`;
}

function joinNatural(values: readonly string[]): string {
	if (values.length <= 1) return values[0] ?? '';
	return `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;
}
