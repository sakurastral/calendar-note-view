import type { CalendarFileData, CalendarMetadata, CalendarSourceProfile } from './models';
import { normalizeWikiLinkTarget } from './value-normalizers';

interface ResolvedLinkFile {
	path: string;
}

export interface CalendarLinkMetadataCache {
	getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => ResolvedLinkFile | null;
}

type CalendarTagCollector = (metadata: CalendarMetadata) => readonly string[];

export interface CalendarSourceGroupEvaluation {
	configured: boolean;
	matched: boolean;
}

export interface CalendarSourceMatchEvaluation {
	enabled: boolean;
	markdown: boolean;
	frontmatterExists: boolean;
	startPropertyConfigured: boolean;
	containsStartProperty: boolean;
	folder: CalendarSourceGroupEvaluation;
	tag: CalendarSourceGroupEvaluation;
	wikiLink: CalendarSourceGroupEvaluation & { propertyConfigured: boolean; targetsConfigured: boolean };
	matchMode: 'all' | 'any';
	startOnlyActive: boolean;
	matchesIfEnabled: boolean;
	matches: boolean;
}

/** Matches Source Profiles exclusively against file paths and cached metadata. */
export class CalendarSourceMatcher {
	constructor(
		private readonly metadataCache: CalendarLinkMetadataCache = {},
		private readonly collectObsidianTags: CalendarTagCollector = collectCachedTags,
	) {}

	matches(
		file: CalendarFileData,
		metadata: CalendarMetadata | null,
		profile: CalendarSourceProfile,
	): boolean {
		return this.evaluate(file, metadata, profile).matches;
	}

	evaluate(
		file: CalendarFileData,
		metadata: CalendarMetadata | null,
		profile: CalendarSourceProfile,
	): CalendarSourceMatchEvaluation {
		const markdown = file.extension.toLowerCase() === 'md';
		const frontmatterExists = Boolean(metadata?.frontmatter);
		const startProperty = profile.startProperty.trim();
		const startPropertyConfigured = Boolean(startProperty);
		const containsStartProperty = Boolean(metadata?.frontmatter && startPropertyConfigured &&
			Object.prototype.hasOwnProperty.call(metadata.frontmatter, startProperty));

		const folders = normalizeFolders(profile.folders);
		const folder = {
			configured: folders.length > 0,
			matched: folders.length > 0 && folders.some((value) => matchesFolder(file.path, value)),
		};

		const expectedTags = normalizedTags(profile.tags);
		const actualTags = new Set((metadata ? this.collectObsidianTags(metadata) : []).map(normalizeTag).filter(isString));
		const tag = {
			configured: expectedTags.length > 0,
			matched: expectedTags.length > 0 && expectedTags.some((value) => actualTags.has(value)),
		};

		const wikiLinkProperty = profile.wikiLinkProperty?.trim() ?? '';
		const expectedWikiLinks = normalizedWikiLinks(profile.wikiLinkTargets);
		const wikiLink = {
			configured: Boolean(wikiLinkProperty) || expectedWikiLinks.length > 0,
			propertyConfigured: Boolean(wikiLinkProperty),
			targetsConfigured: expectedWikiLinks.length > 0,
			matched: Boolean(metadata?.frontmatter) && Boolean(wikiLinkProperty) && expectedWikiLinks.length > 0 && this.matchesWikiLinkProperty(
				file.path,
				metadata?.frontmatter ?? {},
				wikiLinkProperty,
				expectedWikiLinks,
			),
		};

		const groups = [folder, tag, wikiLink].filter((group) => group.configured);
		const startOnlyActive = groups.length === 0 && profile.matchFilesWithStartPropertyOnly === true;
		const sourceMatched = groups.length === 0
			? startOnlyActive
			: profile.matchMode === 'any'
				? groups.some((group) => group.matched)
				: groups.every((group) => group.matched);
		const matchesIfEnabled = markdown && frontmatterExists && startPropertyConfigured && containsStartProperty && sourceMatched;
		return {
			enabled: profile.enabled,
			markdown,
			frontmatterExists,
			startPropertyConfigured,
			containsStartProperty,
			folder,
			tag,
			wikiLink,
			matchMode: profile.matchMode,
			startOnlyActive,
			matchesIfEnabled,
			matches: profile.enabled && matchesIfEnabled,
		};
	}

	private matchesWikiLinkProperty(
		sourcePath: string,
		frontmatter: Record<string, unknown>,
		property: string,
		expectedTargets: string[],
	): boolean {
		if (!Object.prototype.hasOwnProperty.call(frontmatter, property)) return false;
		const actualTargets = normalizeWikiLinkValues(frontmatter[property]);
		for (const actualTarget of actualTargets) {
			const actualResolved = this.resolveLinkPath(actualTarget, sourcePath);
			for (const expectedTarget of expectedTargets) {
				const expectedResolved = this.resolveLinkPath(expectedTarget, sourcePath);
				if (actualResolved && expectedResolved) {
					if (actualResolved === expectedResolved) return true;
					continue;
				}
				if (linksMatchTextually(actualTarget, expectedTarget)) return true;
			}
		}
		return false;
	}

	private resolveLinkPath(linkpath: string, sourcePath: string): string | null {
		const normalized = normalizeInternalLinkPath(linkpath);
		if (!normalized || !this.metadataCache.getFirstLinkpathDest) return null;
		const destination = this.metadataCache.getFirstLinkpathDest(normalized, sourcePath);
		return destination ? normalizeVaultPath(destination.path).replace(/\.md$/i, '') : null;
	}
}

export function hasSourceConditions(profile: CalendarSourceProfile): boolean {
	return normalizeFolders(profile.folders).length > 0 ||
		normalizedTags(profile.tags).length > 0 ||
		Boolean(profile.wikiLinkProperty?.trim()) ||
		normalizedWikiLinks(profile.wikiLinkTargets).length > 0;
}

export function matchesSourceProfile(
	file: CalendarFileData,
	metadata: CalendarMetadata | null,
	profile: CalendarSourceProfile,
	metadataCache: CalendarLinkMetadataCache = {},
	tagCollector?: CalendarTagCollector,
): boolean {
	return new CalendarSourceMatcher(metadataCache, tagCollector).matches(file, metadata, profile);
}

export function matchesFolder(filePath: string, configuredFolder: string): boolean {
	const folder = normalizeFolder(configuredFolder);
	if (!folder) return false;
	return normalizeVaultPath(filePath).startsWith(`${folder}/`);
}

function collectCachedTags(metadata: CalendarMetadata): string[] {
	const tags: string[] = [];
	for (const cachedTag of metadata.tags ?? []) tags.push(cachedTag.tag);
	const frontmatterTags = metadata.frontmatter?.tags;
	const values = Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags];
	for (const value of values) {
		if (typeof value !== 'string') continue;
		for (const tag of value.split(/[\s,]+/)) if (tag.trim()) tags.push(tag);
	}
	return tags;
}

function normalizeWikiLinkValues(value: unknown): string[] {
	const values = Array.isArray(value) ? value : [value];
	return unique(values.map(normalizeInternalLinkPath).filter(isString));
}

function normalizeFolders(values: string[]): string[] {
	return unique(values.map(normalizeFolder).filter(Boolean));
}

function normalizedTags(values: string[]): string[] {
	return unique(values.map(normalizeTag).filter(isString));
}

function normalizedWikiLinks(values: string[]): string[] {
	return unique(values.map(normalizeInternalLinkPath).filter(isString));
}

function normalizeTag(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().replace(/^#/, '');
	return normalized || null;
}

function normalizeFolder(value: string): string {
	return normalizeVaultPath(value).replace(/\/$/, '');
}

function normalizeInternalLinkPath(value: unknown): string | null {
	const target = normalizeWikiLinkTarget(value);
	if (!target) return null;
	const withoutSubpath = target.split('#', 1)[0]?.trim() ?? '';
	return normalizeVaultPath(withoutSubpath).replace(/\.md$/i, '') || null;
}

function normalizeVaultPath(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/').trim();
}

function linksMatchTextually(left: string, right: string): boolean {
	const normalizedLeft = normalizeInternalLinkPath(left);
	const normalizedRight = normalizeInternalLinkPath(right);
	return normalizedLeft !== null && normalizedRight !== null && normalizedLeft === normalizedRight;
}

function isString(value: string | null): value is string {
	return value !== null;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
