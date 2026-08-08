import {
	type App,
	PluginSettingTab,
	type Setting,
	type SettingDefinition,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from 'obsidian';
import { isSupportedDateFormat, isValidIanaTimeZone } from './date';
import type CalendarNoteViewPlugin from './main';
import type { CalendarSettings, CalendarSourceProfile, CalendarTypeStyleRule } from './models';
import { DEFAULT_EVENT_PROFILE } from './settings-data';
import { CalendarInputSuggest } from './suggestions';

export class CalendarNoteSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: CalendarNoteViewPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: 'group',
				heading: 'Calendar behavior',
				items: [{
					name: 'First day of week',
					desc: 'Choose the first column used by calendar views.',
					control: {
						type: 'dropdown',
						key: 'firstDayOfWeek',
						options: { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' },
					},
				}],
			},
			{
				type: 'group',
				heading: 'Date & time',
				items: [
					{
						name: 'Time zone',
						desc: 'Used to determine today. Date-only events are never shifted between dates.',
						control: {
							type: 'dropdown', key: 'timeZoneMode',
							options: { system: 'System', utc: 'UTC', custom: 'Custom IANA time zone' },
						},
					},
					{
						name: 'Custom time zone',
						desc: 'Enter an IANA time zone such as Asia/Taipei.',
						visible: () => this.plugin.settings.timeZone.mode === 'custom',
						control: {
							type: 'text', key: 'customTimeZone', placeholder: 'Asia/Taipei',
							validate: (value) => isValidIanaTimeZone(value) ? undefined : 'Enter a valid IANA time zone.',
						},
					},
					{
						name: 'Display date format',
						desc: 'Used by calendar interfaces, tooltips, and previews.',
						control: {
							type: 'text', key: 'displayDateFormat', placeholder: 'YYYY-MM-DD',
							validate: validateDateFormat,
						},
					},
					{
						name: 'Event property date format',
						desc: 'Strictly parses event properties. Internal dates remain YYYY-MM-DD.',
						control: {
							type: 'text', key: 'eventPropertyDateFormat', placeholder: 'YYYY-MM-DD',
							validate: validateDateFormat,
						},
					},
				],
			},
			this.sourceProfileDefinitions(),
			this.typeRuleDefinitions(),
			{
				type: 'group',
				heading: 'Diagnostics',
				items: [{
					name: 'Current index diagnostics',
					desc: `${this.plugin.diagnostics.getAll().length} issues recorded. A detailed diagnostics view is planned for Stage 3.`,
				}],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case 'firstDayOfWeek': return String(this.plugin.settings.firstDayOfWeek);
			case 'timeZoneMode': return this.plugin.settings.timeZone.mode;
			case 'customTimeZone': return this.plugin.settings.timeZone.mode === 'custom' ? this.plugin.settings.timeZone.timeZone : 'Asia/Taipei';
			case 'displayDateFormat': return this.plugin.settings.displayDateFormat;
			case 'eventPropertyDateFormat': return this.plugin.settings.eventPropertyDateFormat;
			default: return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const previous = this.snapshot();
		switch (key) {
			case 'firstDayOfWeek':
				this.plugin.settings.firstDayOfWeek = Number(value);
				break;
			case 'timeZoneMode':
				this.plugin.settings.timeZone = value === 'utc'
					? { mode: 'utc' }
					: value === 'custom'
						? { mode: 'custom', timeZone: 'Asia/Taipei' }
						: { mode: 'system' };
				break;
			case 'customTimeZone':
				if (typeof value !== 'string' || !isValidIanaTimeZone(value)) return;
				this.plugin.settings.timeZone = { mode: 'custom', timeZone: value.trim() };
				break;
			case 'displayDateFormat':
				if (typeof value !== 'string' || !isSupportedDateFormat(value)) return;
				this.plugin.settings.displayDateFormat = value;
				break;
			case 'eventPropertyDateFormat':
				if (typeof value !== 'string' || !isSupportedDateFormat(value)) return;
				this.plugin.settings.eventPropertyDateFormat = value;
				break;
			default:
				return;
		}
		await this.plugin.saveSettings(previous);
		if (key === 'timeZoneMode') this.update();
	}

	private sourceProfileDefinitions(): SettingDefinitionItem {
		return {
			type: 'list',
			heading: 'Source profiles',
			emptyState: 'No source profiles are configured.',
			items: this.plugin.settings.sourceProfiles.map((profile) => this.sourceProfilePage(profile)),
			addItem: {
				name: 'Add source profile',
				action: () => { void this.addSourceProfile(); },
			},
			onDelete: (index) => { void this.deleteSourceProfile(index); },
			onReorder: (oldIndex, newIndex) => { void this.reorder(this.plugin.settings.sourceProfiles, oldIndex, newIndex); },
		};
	}

	private sourceProfilePage(profile: CalendarSourceProfile): SettingDefinitionPage {
		return {
			type: 'page',
			name: profile.name,
			desc: 'Controls which notes appear in the Sidebar Calendar. It does not filter Bases Calendar entries.',
			displayValue: () => profile.enabled ? profile.kind : 'Disabled',
			items: [{
				type: 'group',
				heading: 'Profile',
				items: [
					this.profileText(profile, 'Name', 'A label used in settings and event creation.', 'name'),
					this.profileToggle(profile, 'Enabled', 'Include this profile in the Sidebar Calendar index.', 'enabled'),
					this.profileDropdown(profile, 'Kind', 'Choose whether matching notes represent events or tasks.', 'kind', { event: 'Event', task: 'Task' }),
					this.profileDropdown(profile, 'Match mode', 'Values within one group use OR; this controls how groups combine.', 'matchMode', { all: 'All configured groups', any: 'Any configured group' }),
				],
			}, {
				type: 'group',
				heading: 'Source matching',
				items: [
					this.profileList(profile, 'Folders', 'Comma-separated folders. Nested folders are included.', 'folders', 'folder'),
					this.profileList(profile, 'Tags', 'Comma-separated tags matched exactly.', 'tags'),
					this.profileText(profile, 'Wiki link property', 'Only this frontmatter property is inspected.', 'wikiLinkProperty', 'property'),
					this.profileList(profile, 'Wiki link targets', 'Comma-separated link targets.', 'wikiLinkTargets'),
					this.profileToggle(profile, 'Match start property only', 'Allow matching by the start property when no source conditions exist.', 'matchFilesWithStartPropertyOnly'),
				],
			}, {
				type: 'group',
				heading: 'Property mapping',
				items: [
					this.profileText(profile, 'Start property', 'Required event start date property.', 'startProperty', 'property'),
					this.profileText(profile, 'End property', 'Optional inclusive end date property.', 'endProperty', 'property'),
					this.profileText(profile, 'Title property', 'Optional display title property.', 'titleProperty', 'property'),
					this.profileText(profile, 'Type property', 'Optional type or wiki-link property.', 'typeProperty', 'property'),
					this.profileText(profile, 'Icon property', 'Optional Obsidian icon name property.', 'iconProperty', 'property'),
					this.profileText(profile, 'Background color property', 'Optional safe CSS color property.', 'colorProperty', 'property'),
					this.profileText(profile, 'Text color property', 'Optional safe CSS color property.', 'textColorProperty', 'property'),
					{ ...this.profileText(profile, 'Completed property', 'Optional task completion property.', 'completedProperty', 'property'), visible: () => profile.kind === 'task' },
				],
			}, {
				type: 'group',
				heading: 'Defaults',
				items: [
					this.profileText(profile, 'Default icon', 'Used when the note has no icon override.', 'defaultIcon'),
					this.profileText(profile, 'Create folder', 'Reused by event creation in Stage 2.', 'createFolder', 'folder'),
				],
			}],
		};
	}

	private typeRuleDefinitions(): SettingDefinitionItem {
		return {
			type: 'list',
			heading: 'Event type rules',
			emptyState: 'No event type rules are configured.',
			items: this.plugin.settings.typeStyleRules.map((rule) => this.typeRulePage(rule)),
			addItem: { name: 'Add type rule', action: () => { void this.addTypeRule(); } },
			onDelete: (index) => { void this.deleteTypeRule(index); },
			onReorder: (oldIndex, newIndex) => { void this.reorder(this.plugin.settings.typeStyleRules, oldIndex, newIndex); },
		};
	}

	private typeRulePage(rule: CalendarTypeStyleRule): SettingDefinitionPage {
		return {
			type: 'page',
			name: rule.typeValue,
			desc: 'Rules are checked in order. Note properties take priority.',
			displayValue: () => rule.enabled ? 'Enabled' : 'Disabled',
			items: [{
				type: 'group',
				heading: 'Rule',
				items: [
					this.ruleToggle(rule, 'Enabled', 'Include this rule in style resolution.', 'enabled'),
					this.ruleText(rule, 'Type value', 'Plain text and equivalent wiki links match the same type.', 'typeValue'),
					this.ruleText(rule, 'Icon', 'Obsidian icon name.', 'icon'),
					this.ruleText(rule, 'Background color', 'Hex, rgb(), hsl(), or a CSS variable.', 'backgroundColor'),
					this.ruleText(rule, 'Text color', 'Hex, rgb(), hsl(), or a CSS variable.', 'textColor'),
				],
			}],
		};
	}

	private profileText(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: ProfileStringKey,
		suggest?: 'folder' | 'property',
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarInputSuggest | undefined;
			setting.addText((text) => {
				text.setValue(String(profile[key] ?? '')).onChange(async (value) => this.updateProfile(() => { profile[key] = value; }));
				if (suggest === 'folder') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getFolderSuggestions(query));
				if (suggest === 'property') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getPropertySuggestions(query));
			});
			return () => inputSuggest?.close();
		});
	}

	private profileList(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'folders' | 'tags' | 'wikiLinkTargets',
		suggest?: 'folder',
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarInputSuggest | undefined;
			setting.addText((text) => {
				text.setValue(profile[key].join(', ')).onChange(async (value) => this.updateProfile(() => {
					profile[key] = value.split(',').map((entry) => entry.trim()).filter(Boolean);
				}));
				if (suggest === 'folder') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getFolderSuggestions(query));
			});
			return () => inputSuggest?.close();
		});
	}

	private profileToggle(profile: CalendarSourceProfile, name: string, desc: string, key: ProfileBooleanKey): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle
				.setValue(profile[key] === true)
				.onChange(async (value) => this.updateProfile(() => { profile[key] = value; })));
		});
	}

	private profileDropdown(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'kind' | 'matchMode',
		options: Record<string, string>,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addDropdown((dropdown) => dropdown
				.addOptions(options)
				.setValue(profile[key])
				.onChange(async (value) => this.updateProfile(() => {
					if (key === 'kind') profile.kind = value === 'task' ? 'task' : 'event';
					else profile.matchMode = value === 'any' ? 'any' : 'all';
					this.refreshDomState();
				})));
		});
	}

	private ruleText(rule: CalendarTypeStyleRule, name: string, desc: string, key: RuleStringKey): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addText((text) => text
				.setValue(String(rule[key] ?? ''))
				.onChange(async (value) => this.updateRule(() => { rule[key] = value; })));
		});
	}

	private ruleToggle(rule: CalendarTypeStyleRule, name: string, desc: string, key: 'enabled'): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle
				.setValue(rule[key])
				.onChange(async (value) => this.updateRule(() => { rule[key] = value; })));
		});
	}

	private renderDefinition(
		name: string,
		desc: string,
		render: (setting: Setting) => void | (() => void),
	): SettingDefinition {
		return { name, desc, render: (setting) => render(setting) };
	}

	private async addSourceProfile(): Promise<void> {
		const previous = this.snapshot();
		const profile = structuredClone(DEFAULT_EVENT_PROFILE);
		profile.id = createId('profile');
		profile.name = 'New source profile';
		profile.matchFilesWithStartPropertyOnly = false;
		this.plugin.settings.sourceProfiles.push(profile);
		await this.plugin.saveSettings(previous);
		this.update();
	}

	private async deleteSourceProfile(index: number): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.sourceProfiles.splice(index, 1);
		await this.plugin.saveSettings(previous);
		this.update();
	}

	private async addTypeRule(): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.typeStyleRules.push({ id: createId('rule'), enabled: true, typeValue: 'New type' });
		await this.plugin.saveSettings(previous);
		this.update();
	}

	private async deleteTypeRule(index: number): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.typeStyleRules.splice(index, 1);
		await this.plugin.saveSettings(previous);
		this.update();
	}

	private async reorder<T>(values: T[], oldIndex: number, newIndex: number): Promise<void> {
		const previous = this.snapshot();
		const [value] = values.splice(oldIndex, 1);
		if (value !== undefined) values.splice(newIndex, 0, value);
		await this.plugin.saveSettings(previous);
		this.update();
	}

	private async updateProfile(update: () => void): Promise<void> {
		const previous = this.snapshot();
		update();
		await this.plugin.saveSettings(previous);
	}

	private async updateRule(update: () => void): Promise<void> {
		const previous = this.snapshot();
		update();
		await this.plugin.saveSettings(previous);
	}

	private snapshot(): CalendarSettings {
		return structuredClone(this.plugin.settings);
	}
}

type ProfileStringKey =
	| 'name'
	| 'wikiLinkProperty'
	| 'startProperty'
	| 'endProperty'
	| 'titleProperty'
	| 'typeProperty'
	| 'iconProperty'
	| 'colorProperty'
	| 'textColorProperty'
	| 'completedProperty'
	| 'defaultIcon'
	| 'createFolder';

type ProfileBooleanKey = 'enabled' | 'matchFilesWithStartPropertyOnly';
type RuleStringKey = 'typeValue' | 'icon' | 'backgroundColor' | 'textColor';

function validateDateFormat(value: string): string | undefined {
	return isSupportedDateFormat(value) ? undefined : 'The format must contain YYYY, MM, and DD exactly once.';
}

function createId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
