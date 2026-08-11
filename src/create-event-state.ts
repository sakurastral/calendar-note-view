import { isCanonicalDate } from './date';
import type { CreateEventInput } from './event-creation';
import type { CalendarSourceProfile } from './models';
import { sortSourceProfiles } from './source-profile';
import type { CalendarTextKey } from './calendar-locale';

export type CreateEventDirtyField = 'title' | 'type' | 'icon' | 'backgroundColor' | 'textColor';

export interface CreateEventValidation {
	valid: boolean;
	field?: 'profileId' | 'title' | 'startDate' | 'endDate';
	message?: CalendarTextKey;
}

export function selectInitialCreateProfile(
	profiles: readonly CalendarSourceProfile[],
	lastProfileId?: string,
	requestedProfileId?: string,
): CalendarSourceProfile | undefined {
	const available = sortSourceProfiles(profiles).filter(isCreateProfile);
	return available.find((profile) => profile.id === requestedProfileId)
		?? available.find((profile) => profile.id === lastProfileId)
		?? available[0];
}

export function applyCreateProfileDefaults(
	input: CreateEventInput,
	profile: CalendarSourceProfile,
	dirty: ReadonlySet<CreateEventDirtyField>,
): void {
	input.profileId = profile.id;
	if (!dirty.has('type')) input.type = profile.defaultType ?? '';
	if (!dirty.has('icon')) input.icon = '';
	if (!dirty.has('backgroundColor')) input.backgroundColor = '';
	if (!dirty.has('textColor')) input.textColor = '';
}

export function validateCreateEventInput(input: CreateEventInput, profiles: readonly CalendarSourceProfile[]): CreateEventValidation {
	if (!profiles.some((profile) => profile.id === input.profileId && isCreateProfile(profile))) {
		return { valid: false, field: 'profileId', message: 'profileUnavailable' };
	}
	if (!input.title.trim()) return { valid: false, field: 'title', message: 'eventTitleRequired' };
	if (!isCanonicalDate(input.startDate)) return { valid: false, field: 'startDate', message: 'invalidStart' };
	const end = input.endDate?.trim();
	if (end && !isCanonicalDate(end)) return { valid: false, field: 'endDate', message: 'invalidEnd' };
	if (end && end < input.startDate) return { valid: false, field: 'endDate', message: 'endBeforeStart' };
	return { valid: true };
}

export function isCreateProfile(profile: CalendarSourceProfile): boolean {
	return profile.enabled && profile.allowCreate && Boolean(profile.startProperty.trim());
}
