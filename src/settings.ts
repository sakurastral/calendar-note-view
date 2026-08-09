import {
	type App,
	Modal,
	PluginSettingTab,
	Setting,
	type SettingDefinition,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from 'obsidian';
import { isSupportedDateFormat, isValidIanaTimeZone } from './date';
import {
	OBSIDIAN_BACKGROUND_COLOR_OPTIONS,
	OBSIDIAN_TEXT_COLOR_OPTIONS,
} from './color-options';
import type CalendarNoteViewPlugin from './main';
import {
	getDelimitedQuery,
	getLineQuery,
	replaceDelimitedInputSelection,
	replaceLineInputSelection,
} from './input-events';
import type { CalendarSettings, CalendarSourceProfile, CalendarTypeStyleRule } from './models';
import {
	DEFAULT_EVENT_PROFILE,
	parseWikiLinkList,
	removeSourceProfile,
	updateSourceProfile,
	updateTypeStyleRule,
} from './settings-data';
import type { CalendarSettingsImpact } from './settings-persistence';
import {
	createSourceProfileId,
	getSourceProfilePageName,
	moveSourceProfileToOrder,
	sortSourceProfiles,
} from './source-profile';
import {
	CalendarInputSuggest,
	CalendarFloatingSuggest,
} from './suggestions';

const EVENT_TEMPLATE_VARIABLES = [
	'{title}', '{start}', '{end}', '{start-date}', '{end-date}', '{date-range}',
	'{year}', '{month}', '{day}', '{type}', '{type-name}', '{icon}', '{profile}',
].join(', ');

export class CalendarNoteSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: CalendarNoteViewPlugin) {
		super(app, plugin);
	}

	hide(): void {
		void this.plugin.flushSettings();
		super.hide();
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
				}, {
					name: 'Weekend days',
					desc: 'Comma-separated weekday numbers: Sunday is 0 and Saturday is 6.',
					control: { type: 'text', key: 'weekendDays', placeholder: '0, 6', validate: validateWeekendDays },
				}, {
					name: 'Confirm before creating daily note',
					desc: 'Ask before a missing daily note is created from the calendar.',
					control: { type: 'toggle', key: 'confirmBeforeCreatingDailyNote' },
				}, {
					name: 'Maximum indicators per date',
					desc: 'Additional events are summarized as +N.',
					control: { type: 'slider', key: 'maxIndicatorsPerDay', min: 1, max: 8, step: 1 },
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
					desc: `${this.plugin.diagnostics.getAll().length} issues recorded. Use the “Open calendar diagnostics” command to inspect them.`,
				}],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case 'firstDayOfWeek': return String(this.plugin.settings.firstDayOfWeek);
			case 'weekendDays': return this.plugin.settings.weekendDays.join(', ');
			case 'confirmBeforeCreatingDailyNote': return this.plugin.settings.confirmBeforeCreatingDailyNote;
			case 'maxIndicatorsPerDay': return this.plugin.settings.maxIndicatorsPerDay;
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
			case 'weekendDays': {
				if (typeof value !== 'string' || validateWeekendDays(value)) return;
				this.plugin.settings.weekendDays = parseWeekendDays(value);
				break;
			}
			case 'confirmBeforeCreatingDailyNote':
				this.plugin.settings.confirmBeforeCreatingDailyNote = value === true;
				break;
			case 'maxIndicatorsPerDay':
				this.plugin.settings.maxIndicatorsPerDay = Math.min(8, Math.max(1, Number(value)));
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
		await this.plugin.saveSettings(previous, controlImpact(key));
		if (key === 'timeZoneMode') this.update();
	}

	private sourceProfileDefinitions(): SettingDefinitionItem {
		const orderedProfiles = sortSourceProfiles(this.plugin.settings.sourceProfiles);
		return {
			type: 'list',
			heading: 'Source profiles',
			emptyState: 'No source profiles are configured.',
			items: orderedProfiles.map((profile) => this.sourceProfilePage(profile)),
			addItem: {
				name: 'Add source profile',
				action: () => { void this.addSourceProfile(); },
			},
			onDelete: (index) => {
				const profile = orderedProfiles[index];
				if (profile) this.confirmDeleteSourceProfile(profile);
			},
			onReorder: (oldIndex, newIndex) => { void this.reorderSourceProfiles(orderedProfiles, oldIndex, newIndex); },
		};
	}

	private sourceProfilePage(profile: CalendarSourceProfile): SettingDefinitionPage {
		return {
			type: 'page',
			name: getSourceProfilePageName(profile),
			desc: 'Controls which notes appear in the Sidebar Calendar. It does not filter Bases Calendar entries.',
			displayValue: () => profile.enabled ? `Order ${profile.order}` : `Disabled · Order ${profile.order}`,
			items: [{
				type: 'group',
				heading: 'Profile',
				items: [
					this.profileText(profile, 'Name', 'A label used in settings and event creation.', 'name'),
					this.profileId(profile),
					this.profileOrder(profile),
					this.profileToggle(profile, 'Enabled', 'Include this profile in the Sidebar Calendar index.', 'enabled'),
					this.profileIndicatorMode(profile),
				],
			}, {
				type: 'group',
				heading: 'Source matching',
				items: [
					this.profileDropdown(profile, 'Match mode', 'Combine only the non-empty Folder, Tag, and Wiki Link groups. Values inside each group use OR.', 'matchMode', { all: 'All configured groups', any: 'Any configured group' }),
					this.profileList(profile, 'Folders', 'Comma-separated vault folders. Paths are normalized and include nested folders.', 'folders', 'folder'),
					this.profileList(profile, 'Tags', 'Comma-separated Properties or inline tags. A leading # is optional; nested tags match exactly.', 'tags'),
					this.profileText(profile, 'Wiki link property', 'Only this frontmatter property is checked for matching links.', 'wikiLinkProperty', 'property'),
					this.profileWikiLinks(profile),
					this.profileToggle(profile, 'Match start property only', 'Use the required Start property as the only filter when Folder, Tag, and Wiki Link are all empty.', 'matchFilesWithStartPropertyOnly'),
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
				],
			}, {
				type: 'group',
				heading: 'Defaults & event creation',
				items: [
					this.profileToggle(profile, 'Allow event creation', 'Make this profile available in the Create Event modal.', 'allowCreate'),
					this.profileText(profile, 'Default type', 'Initial type used by event creation.', 'defaultType'),
					this.profileText(profile, 'Default icon', 'Used when the note has no icon property value or matching Event Type icon.', 'defaultIcon', 'icon'),
					this.profileColorDropdown(
						profile,
						'Default background color',
						'Optional. Choose Style Settings fallback to inherit the Event fallback color.',
						'defaultBackgroundColor',
						OBSIDIAN_BACKGROUND_COLOR_OPTIONS,
					),
					this.profileColorDropdown(
						profile,
						'Default text color',
						'Optional. Choose Style Settings fallback to inherit the Event fallback color.',
						'defaultTextColor',
						OBSIDIAN_TEXT_COLOR_OPTIONS,
					),
					this.profileText(profile, 'Create folder', 'Folder used for newly created event notes.', 'createFolder', 'folder'),
					this.profileText(profile, 'Note template path', `Optional Markdown template used for new event notes. Its content may use: ${EVENT_TEMPLATE_VARIABLES}`, 'noteTemplatePath'),
					this.profileText(profile, 'File name template', `Available variables: ${EVENT_TEMPLATE_VARIABLES}`, 'fileNameTemplate'),
					this.profileText(profile, 'Generated title property', 'Property that receives the generated title.', 'generatedTitleProperty', 'property'),
					this.profileText(profile, 'Generated title template', `Available variables: ${EVENT_TEMPLATE_VARIABLES}`, 'generatedTitleTemplate'),
					this.profileText(profile, 'Title date format', 'Date format used by title and filename variables.', 'titleDateFormat'),
				],
			}, {
				type: 'group',
				heading: 'Profile actions',
				items: [this.renderDefinition(
					'Delete source profile',
					'Remove this profile and its indexed Sidebar Calendar items.',
					(setting) => {
						setting.addButton((button) => button
							.setButtonText('Delete profile')
							.setDestructive()
							.onClick(() => this.confirmDeleteSourceProfile(profile)));
					},
				)],
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
			onDelete: (index) => {
				const rule = this.plugin.settings.typeStyleRules[index];
				if (rule) void this.deleteTypeRule(rule.id);
			},
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
		suggest?: 'folder' | 'property' | 'icon',
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarInputSuggest | undefined;
			let floatingSuggest: CalendarFloatingSuggest | undefined;
			setting.addText((text) => {
				const saveValue = async (value: string) => this.updateProfile(profile.id, (current) => { current[key] = value; }, profileImpact(key));
				text.setValue(String(profile[key] ?? '')).onChange(saveValue);
				if (suggest === 'folder') floatingSuggest = new CalendarFloatingSuggest(
					text.inputEl,
					(query) => this.plugin.suggestions.getFolderSuggestions(query),
					(value) => value,
					(value) => ({ value, cursor: value.length }),
					saveValue,
				);
				if (suggest === 'property') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getPropertySuggestions(query), undefined, saveValue);
				if (suggest === 'icon') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getIconSuggestions(query), undefined, saveValue);
				text.inputEl.addEventListener('blur', () => {
					void this.plugin.flushSettings();
				});
			});
			return () => {
				inputSuggest?.close();
				floatingSuggest?.dispose();
			};
		});
	}

	private profileList(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'folders' | 'tags',
		suggest?: 'folder',
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarFloatingSuggest | undefined;
			setting.addText((text) => {
				const saveValue = async (value: string) => this.updateProfile(profile.id, (current) => {
					current[key] = value.split(',').map((entry) => entry.trim()).filter(Boolean);
				}, 'index');
				text.setValue(profile[key].join(', ')).onChange(saveValue);
				if (suggest === 'folder') inputSuggest = new CalendarFloatingSuggest(
					text.inputEl,
					(query) => this.plugin.suggestions.getFolderSuggestions(query),
					getDelimitedQuery,
					replaceDelimitedInputSelection,
					saveValue,
				);
				text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings(); });
			});
			return () => inputSuggest?.dispose();
		});
	}

	private profileWikiLinks(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition(
				'Wiki link targets',
				'Enter one target per line. Only values in the configured Wiki link property are checked.',
				(setting) => {
					let suggestions: CalendarFloatingSuggest | undefined;
					setting.addTextArea((text) => {
						text.inputEl.addClass('calendar-note-settings-textarea');
						text.setPlaceholder('[[holiday]]\n[[vacation]]')
							.setValue(profile.wikiLinkTargets.join('\n'))
							.onChange(async (value) => this.updateProfile(profile.id, (current) => {
								current.wikiLinkTargets = parseWikiLinkList(value);
							}, 'index'));
						const saveValue = async (value: string) => this.updateProfile(profile.id, (current) => {
							current.wikiLinkTargets = parseWikiLinkList(value);
						}, 'index');
						suggestions = new CalendarFloatingSuggest(
							text.inputEl,
							(query) => this.plugin.suggestions.getWikiLinkSuggestions(query),
							getLineQuery,
							replaceLineInputSelection,
							saveValue,
						);
						text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings(); });
					});
					return () => suggestions?.dispose();
				},
		);
	}

	private profileColorDropdown(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'defaultBackgroundColor' | 'defaultTextColor',
		options: Record<string, string>,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addDropdown((dropdown) => dropdown
				.addOption('', 'Use style settings fallback')
				.addOptions(options)
				.setValue(profile[key] ?? '')
				.onChange(async (value) => this.updateProfile(profile.id, (current) => {
					current[key] = value || undefined;
				}, 'render')));
		});
	}

	private profileId(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition(
			'Profile ID',
			'Generated automatically and kept stable when the profile name changes.',
			(setting) => {
				setting.addText((text) => text.setValue(profile.id).setDisabled(true));
			},
		);
	}

	private profileOrder(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition(
			'Order',
			'Lower numbers appear first in Source Profiles, event creation, and Sidebar events.',
			(setting) => {
				setting.addText((text) => {
					text.inputEl.type = 'number';
					text.inputEl.min = '1';
					text.inputEl.max = String(this.plugin.settings.sourceProfiles.length);
					text.inputEl.step = '1';
					text.setValue(String(profile.order)).onChange(async (value) => {
						const requestedOrder = Number(value);
						if (!Number.isInteger(requestedOrder) || requestedOrder < 1) return;
						const previous = this.snapshot();
						if (!moveSourceProfileToOrder(this.plugin.settings.sourceProfiles, profile.id, requestedOrder)) return;
						await this.plugin.saveSettings(previous, 'render');
					});
					text.inputEl.addEventListener('blur', () => {
						const current = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === profile.id);
						if (current) text.setValue(String(current.order));
						void this.plugin.flushSettings();
					});
				});
			},
		);
	}

	private profileIndicatorMode(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition(
			'Sidebar indicator',
			'Choose how this profile\'s events appear in Sidebar date cells.',
			(setting) => {
				setting.addDropdown((dropdown) => dropdown
					.addOption('dots', 'Colored dots')
					.addOption('icons', 'Icon badges')
					.setValue(profile.sidebarIndicatorMode)
					.onChange(async (value) => this.updateProfile(profile.id, (current) => {
						current.sidebarIndicatorMode = value === 'icons' ? 'icons' : 'dots';
					}, 'render')));
			},
		);
	}

	private profileToggle(profile: CalendarSourceProfile, name: string, desc: string, key: ProfileBooleanKey): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle
				.setValue(profile[key] === true)
				.onChange(async (value) => this.updateProfile(profile.id, (current) => { current[key] = value; }, profileImpact(key))));
		});
	}

	private profileDropdown(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'matchMode',
		options: Record<string, string>,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addDropdown((dropdown) => dropdown
				.addOptions(options)
				.setValue(profile[key])
				.onChange(async (value) => this.updateProfile(profile.id, (current) => {
					current.matchMode = value === 'any' ? 'any' : 'all';
					this.refreshDomState();
				}, 'index')));
		});
	}

	private ruleText(rule: CalendarTypeStyleRule, name: string, desc: string, key: RuleStringKey): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addText((text) => {
				text.setValue(String(rule[key] ?? ''))
					.onChange(async (value) => this.updateRule(rule.id, (current) => { current[key] = value; }));
				text.inputEl.addEventListener('blur', () => {
					void this.plugin.flushSettings().then(() => {
						if (key === 'typeValue') this.update();
					});
				});
			});
		});
	}

	private ruleToggle(rule: CalendarTypeStyleRule, name: string, desc: string, key: 'enabled'): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle
				.setValue(rule[key])
				.onChange(async (value) => this.updateRule(rule.id, (current) => { current[key] = value; })));
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
		profile.id = createSourceProfileId();
		profile.name = 'New source profile';
		profile.order = this.plugin.settings.sourceProfiles.length + 1;
		profile.matchFilesWithStartPropertyOnly = false;
		this.plugin.settings.sourceProfiles.push(profile);
		await this.plugin.saveSettings(previous, 'index', true);
		this.update();
	}

	private confirmDeleteSourceProfile(profile: CalendarSourceProfile): void {
		new ConfirmDeleteSourceProfileModal(this.app, profile.name, () => {
			void this.deleteSourceProfile(profile.id);
		}).open();
	}

	private async deleteSourceProfile(profileId: string): Promise<void> {
		const previous = this.snapshot();
		if (!removeSourceProfile(this.plugin.settings, profileId)) return;
		await this.plugin.saveSettings(previous, 'index', true);
		this.update();
	}

	private async addTypeRule(): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.typeStyleRules.push({ id: createId('rule'), enabled: true, typeValue: 'New type' });
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async deleteTypeRule(ruleId: string): Promise<void> {
		const previous = this.snapshot();
		const index = this.plugin.settings.typeStyleRules.findIndex((rule) => rule.id === ruleId);
		if (index < 0) return;
		this.plugin.settings.typeStyleRules.splice(index, 1);
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async reorder<T>(values: T[], oldIndex: number, newIndex: number): Promise<void> {
		const previous = this.snapshot();
		const [value] = values.splice(oldIndex, 1);
		if (value !== undefined) values.splice(newIndex, 0, value);
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async reorderSourceProfiles(
		orderedProfiles: CalendarSourceProfile[],
		oldIndex: number,
		newIndex: number,
	): Promise<void> {
		const profile = orderedProfiles[oldIndex];
		if (!profile) return;
		const previous = this.snapshot();
		if (!moveSourceProfileToOrder(this.plugin.settings.sourceProfiles, profile.id, newIndex + 1)) return;
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async updateProfile(
		profileId: string,
		update: (profile: CalendarSourceProfile) => void,
		impact: CalendarSettingsImpact,
	): Promise<void> {
		const previous = this.snapshot();
		if (!updateSourceProfile(this.plugin.settings, profileId, update)) return;
		await this.plugin.saveSettings(previous, impact);
	}

	private async updateRule(ruleId: string, update: (rule: CalendarTypeStyleRule) => void): Promise<void> {
		const previous = this.snapshot();
		if (!updateTypeStyleRule(this.plugin.settings, ruleId, update)) return;
		await this.plugin.saveSettings(previous, 'render');
	}

	private snapshot(): CalendarSettings {
		return structuredClone(this.plugin.settings);
	}
}

class ConfirmDeleteSourceProfileModal extends Modal {
	constructor(
		app: App,
		private readonly profileName: string,
		private readonly onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle('Delete source profile?');
		this.contentEl.createEl('p', {
			text: `“${this.profileName}” will be removed from Calendar Note View. Event notes in your vault will not be deleted.`,
		});
		new Setting(this.contentEl)
			.addButton((button) => button
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton((button) => button
				.setButtonText('Delete')
				.setDestructive()
				.onClick(() => {
					this.close();
					this.onConfirm();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

type ProfileStringKey =
	| 'name'
	| 'startProperty'
	| 'endProperty'
	| 'titleProperty'
	| 'typeProperty'
	| 'iconProperty'
	| 'colorProperty'
	| 'textColorProperty'
	| 'wikiLinkProperty'
	| 'defaultType'
	| 'defaultIcon'
	| 'defaultBackgroundColor'
	| 'defaultTextColor'
	| 'createFolder'
	| 'noteTemplatePath'
	| 'fileNameTemplate'
	| 'generatedTitleProperty'
	| 'generatedTitleTemplate'
	| 'titleDateFormat';

type ProfileBooleanKey = 'enabled' | 'matchFilesWithStartPropertyOnly' | 'allowCreate';
type RuleStringKey = 'typeValue' | 'icon' | 'backgroundColor' | 'textColor';

function controlImpact(key: string): CalendarSettingsImpact {
	if (key === 'eventPropertyDateFormat') return 'index';
	if (key === 'confirmBeforeCreatingDailyNote') return 'save';
	return 'render';
}

function profileImpact(key: ProfileStringKey | ProfileBooleanKey): CalendarSettingsImpact {
	if ([
		'enabled', 'matchFilesWithStartPropertyOnly', 'startProperty', 'endProperty', 'titleProperty',
		'typeProperty', 'iconProperty', 'colorProperty', 'textColorProperty', 'wikiLinkProperty',
	].includes(key)) return 'index';
	if (['defaultIcon', 'defaultBackgroundColor', 'defaultTextColor'].includes(key)) return 'render';
	return 'save';
}

function validateDateFormat(value: string): string | undefined {
	return isSupportedDateFormat(value) ? undefined : 'The format must contain YYYY, MM, and DD exactly once.';
}

function validateWeekendDays(value: string): string | undefined {
	const parts = value.split(',').map((entry) => entry.trim()).filter(Boolean);
	return parts.length > 0 && parts.every((entry) => /^[0-6]$/.test(entry))
		? undefined
		: 'Enter one or more weekday numbers from 0 through 6.';
}

function parseWeekendDays(value: string): number[] {
	return [...new Set(value.split(',').map((entry) => Number(entry.trim())))].sort((left, right) => left - right);
}

function createId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
