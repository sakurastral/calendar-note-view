import type { CalendarSourceProfile } from './models';

export function createSourceProfileId(): string {
	const uuid = crypto?.randomUUID?.();
	return `profile-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`}`;
}

export function sortSourceProfiles(profiles: readonly CalendarSourceProfile[]): CalendarSourceProfile[] {
	return profiles
		.map((profile, index) => ({ profile, index }))
		.sort((left, right) => left.profile.order - right.profile.order || left.index - right.index || left.profile.id.localeCompare(right.profile.id))
		.map(({ profile }) => profile);
}

export function normalizeSourceProfileOrder(profiles: CalendarSourceProfile[]): void {
	for (const [index, profile] of sortSourceProfiles(profiles).entries()) profile.order = index + 1;
}

export function moveSourceProfileToOrder(
	profiles: CalendarSourceProfile[],
	profileId: string,
	requestedOrder: number,
): boolean {
	const ordered = sortSourceProfiles(profiles);
	const currentIndex = ordered.findIndex((profile) => profile.id === profileId);
	if (currentIndex < 0 || !Number.isInteger(requestedOrder)) return false;
	const [profile] = ordered.splice(currentIndex, 1);
	if (!profile) return false;
	const targetIndex = Math.min(ordered.length, Math.max(0, requestedOrder - 1));
	ordered.splice(targetIndex, 0, profile);
	for (const [index, value] of ordered.entries()) value.order = index + 1;
	profiles.splice(0, profiles.length, ...ordered);
	return true;
}

export function getSourceProfilePageName(profile: CalendarSourceProfile): string {
	return `${profile.name} · ${shortProfileId(profile.id)}`;
}

function shortProfileId(profileId: string): string {
	const value = profileId.replace(/^profile-/, '');
	return value.length > 8 ? value.slice(0, 8) : value;
}
