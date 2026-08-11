import { FuzzySuggestModal, type FuzzyMatch } from 'obsidian';
import { calendarText } from './calendar-locale';
import type CalendarNoteViewPlugin from './main';
import type { CalendarSourceProfile } from './models';
import { describeProfileSource } from './settings-helpers';
import { sortSourceProfiles } from './source-profile';

export class SourceProfilePickerModal extends FuzzySuggestModal<CalendarSourceProfile> {
	constructor(
		private readonly plugin: CalendarNoteViewPlugin,
		private readonly onChoose: (profile: CalendarSourceProfile) => void,
	) {
		super(plugin.app);
		this.setPlaceholder(calendarText(plugin.settings.calendarLocale, 'searchProfiles'));
	}

	getItems(): CalendarSourceProfile[] {
		return sortSourceProfiles(this.plugin.settings.sourceProfiles)
			.filter((profile) => profile.enabled && profile.allowCreate && profile.startProperty.trim());
	}

	getItemText(profile: CalendarSourceProfile): string {
		return `${profile.name} ${shortId(profile.id)} ${describeProfileSource(profile)}`;
	}

	renderSuggestion(match: FuzzyMatch<CalendarSourceProfile>, element: HTMLElement): void {
		const profile = match.item;
		element.createDiv({ cls: 'suggestion-title', text: `${profile.name} · ${shortId(profile.id)}` });
		element.createDiv({ cls: 'suggestion-note', text: describeProfileSource(profile) });
	}

	onChooseItem(profile: CalendarSourceProfile): void {
		this.onChoose(profile);
	}
}

function shortId(id: string): string {
	return id.length > 8 ? id.slice(-8) : id;
}
