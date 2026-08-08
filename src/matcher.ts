import type { CalendarFileData, CalendarMetadata, CalendarSourceProfile } from './models';
import { normalizeWikiLinkTarget } from './value-normalizers';

export function hasSourceConditions(profile: CalendarSourceProfile): boolean {
	return normalizedList(profile.folders).length > 0 ||
		normalizedTags(profile.tags).length > 0 ||
		(Boolean(profile.wikiLinkProperty?.trim()) && normalizedList(profile.wikiLinkTargets).length > 0);
}

export function matchesSourceProfile(
	file: CalendarFileData,
	metadata: CalendarMetadata | null,
	profile: CalendarSourceProfile,
): boolean {
	if (!profile.enabled || file.extension.toLowerCase() !== 'md' || !metadata?.frontmatter) return false;
	const startProperty = profile.startProperty.trim();
	if (!startProperty || !(startProperty in metadata.frontmatter)) return false;

	const checks: boolean[] = [];
	const folders = normalizedList(profile.folders).map(normalizeFolder);
	if (folders.length > 0) checks.push(folders.some((folder) => matchesFolder(file.path, folder)));

	const expectedTags = normalizedTags(profile.tags);
	if (expectedTags.length > 0) {
		const actualTags = collectTags(metadata);
		checks.push(expectedTags.some((tag) => actualTags.has(tag)));
	}

	const targets = normalizedList(profile.wikiLinkTargets)
		.map(normalizeWikiLinkTarget)
		.filter((target): target is string => target !== null);
	const property = profile.wikiLinkProperty?.trim();
	if (property && targets.length > 0) {
		const raw = metadata.frontmatter[property];
		const actual = (Array.isArray(raw) ? raw : [raw])
			.map(normalizeWikiLinkTarget)
			.filter((target): target is string => target !== null);
		checks.push(targets.some((target) => actual.includes(target)));
	}

	if (checks.length === 0) return profile.matchFilesWithStartPropertyOnly === true;
	return profile.matchMode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

export function matchesFolder(filePath: string, configuredFolder: string): boolean {
	const folder = normalizeFolder(configuredFolder);
	if (!folder) return false;
	const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
	return normalizedPath.startsWith(`${folder}/`);
}

function collectTags(metadata: CalendarMetadata): Set<string> {
	const values = new Set<string>();
	const frontmatterTags = metadata.frontmatter?.tags;
	const rawTags = Array.isArray(frontmatterTags)
		? frontmatterTags
		: typeof frontmatterTags === 'string'
			? frontmatterTags.split(/[ ,]+/)
			: [];
	for (const tag of rawTags) {
		const normalized = normalizeTag(tag);
		if (normalized) values.add(normalized);
	}
	for (const cache of metadata.tags ?? []) {
		const normalized = normalizeTag(cache.tag);
		if (normalized) values.add(normalized);
	}
	return values;
}

function normalizedList(values: string[]): string[] {
	return values.map((value) => value.trim()).filter(Boolean);
}

function normalizedTags(values: string[]): string[] {
	return values.map(normalizeTag).filter((tag): tag is string => tag !== null);
}

function normalizeTag(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim().replace(/^#/, '');
	return normalized || null;
}

function normalizeFolder(value: string): string {
	return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
}
