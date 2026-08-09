import type { CalendarFileData, CalendarMetadata, CalendarSourceProfile } from './models';
import { normalizeWikiLinkTarget } from './value-normalizers';

interface ResolvedLinkFile {
	path: string;
}

export interface CalendarLinkMetadataCache {
	getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => ResolvedLinkFile | null;
}

type CalendarTagCollector = (metadata: CalendarMetadata) => readonly string[];

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
		if (!profile.enabled || file.extension.toLowerCase() !== 'md' || !metadata?.frontmatter) return false;
		const startProperty = profile.startProperty.trim();
		if (!startProperty || !Object.prototype.hasOwnProperty.call(metadata.frontmatter, startProperty)) return false;

		const groups: boolean[] = [];
		const folders = normalizeFolders(profile.folders);
		if (folders.length > 0) groups.push(folders.some((folder) => matchesFolder(file.path, folder)));

		const expectedTags = normalizedTags(profile.tags);
		if (expectedTags.length > 0) {
			const actualTags = new Set(this.collectObsidianTags(metadata).map(normalizeTag).filter(isString));
			groups.push(expectedTags.some((tag) => actualTags.has(tag)));
		}

		const wikiLinkProperty = profile.wikiLinkProperty?.trim() ?? '';
		const expectedWikiLinks = normalizedWikiLinks(profile.wikiLinkTargets);
		if (wikiLinkProperty || expectedWikiLinks.length > 0) {
			groups.push(Boolean(wikiLinkProperty) && expectedWikiLinks.length > 0 && this.matchesWikiLinkProperty(
				file.path,
				metadata.frontmatter,
				wikiLinkProperty,
				expectedWikiLinks,
			));
		}

		if (groups.length === 0) return profile.matchFilesWithStartPropertyOnly === true;
		return profile.matchMode === 'any' ? groups.some(Boolean) : groups.every(Boolean);
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
