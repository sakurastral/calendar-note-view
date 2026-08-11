import {
	type App,
	Menu,
	Notice,
	PluginSettingTab,
	setIcon,
	Setting,
	type SettingDefinition,
	type SettingDefinitionItem,
	type SettingDefinitionPage,
} from 'obsidian';
import {
	formatCalendarDate,
	isSupportedDateFormat,
	isValidIanaTimeZone,
} from './date';
import { CALENDAR_LOCALE_OPTIONS, calendarText, type CalendarTextKey } from './calendar-locale';
import {
	OBSIDIAN_BACKGROUND_COLOR_OPTIONS,
	OBSIDIAN_TEXT_COLOR_OPTIONS,
} from './color-options';
import type CalendarNoteViewPlugin from './main';
import type { CalendarSettings, CalendarSourceProfile, CalendarTypeStyleRule } from './models';
import { collectEventTypeValues } from './event-types';
import {
	removeSourceProfile,
	updateSourceProfile,
	updateTypeStyleRule,
} from './settings-data';
import {
	createSourceProfileFromPreset,
	createTypeRule,
	dateFormatMode,
	DATE_FORMAT_PRESETS,
	describeMatching,
	describeProfileSource,
	duplicateSourceProfile,
	duplicateTypeRule,
	getSourceGroupCount,
	getStableProfilePageName,
	getStableTypeRulePageName,
	hasAnyConfiguredSource,
	moveItem,
	normalizeMultiValue,
	normalizeTagToken,
	normalizeWikiLinkToken,
	sortProfilesForDisplay,
	type SourceProfilePreset,
	validateSourceProfile,
} from './settings-helpers';
import { CalendarMultiValueEditor } from './settings-multi-value';
import { AddSourceProfileModal, ConfirmSettingsActionModal } from './settings-modals';
import type { CalendarSettingsImpact, CalendarSettingsSaveState } from './settings-persistence';
import { moveSourceProfileToOrder } from './source-profile';
import { CalendarInputSuggest, CalendarFloatingSuggest } from './suggestions';
import { CalendarDiagnosticsModal } from './diagnostics-modal';
import { hasSourceConditions } from './matcher';
import { ProfileMatchingInspectorModal } from './profile-inspector';
import { SetupAssistantModal } from './setup-assistant-modal';

const EVENT_TEMPLATE_VARIABLES = [
	'{title}', '{start}', '{end}', '{start-date}', '{end-date}', '{date-range}',
	'{year}', '{month}', '{day}', '{type}', '{type-name}', '{icon}', '{profile}',
].join(', ');

const WEEKDAYS = [
	{ value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
	{ value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
	{ value: 0, label: 'Sun' },
] as const;

interface QuickStatusElements {
	profiles: HTMLElement;
	events: HTMLElement;
	diagnostics: HTMLElement;
	index: HTMLElement;
}

export class CalendarNoteSettingTab extends PluginSettingTab {
	private readonly quickStatusElements = new Set<QuickStatusElements>();
	private readonly saveStatusElements = new Set<HTMLElement>();
	private readonly matchingSummaryElements = new Map<string, Set<HTMLElement>>();
	private readonly customDateModes = new Set<'displayDateFormat' | 'eventPropertyDateFormat'>();
	private readonly unsubscribeIndex: () => void;
	private profileFilter = '';
	private ruleFilter = '';
	private profileFilterTimer?: number;
	private ruleFilterTimer?: number;

	constructor(app: App, private readonly plugin: CalendarNoteViewPlugin) {
		super(app, plugin);
		this.unsubscribeIndex = plugin.index.subscribe(() => this.refreshRuntimeStatus());
	}

	dispose(): void {
		this.unsubscribeIndex();
		if (this.profileFilterTimer !== undefined) window.clearTimeout(this.profileFilterTimer);
		if (this.ruleFilterTimer !== undefined) window.clearTimeout(this.ruleFilterTimer);
	}

	hide(): void {
		void this.plugin.flushSettings().catch(() => undefined);
		super.hide();
	}

	setSaveStatus(status: CalendarSettingsSaveState): void {
		for (const element of this.saveStatusElements) {
			element.setText(this.text(status === 'saving' ? 'saving' : status === 'error' ? 'saveFailed' : 'saved'));
			element.dataset.status = status;
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			this.quickStatusDefinitions(),
			this.calendarBehaviorDefinitions(),
			this.dateTimeDefinitions(),
			...this.sourceProfileDefinitions(),
			...this.typeRuleDefinitions(),
			this.diagnosticsDefinitions(),
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case 'firstDayOfWeek': return String(this.plugin.settings.firstDayOfWeek);
			case 'calendarLocale': return this.plugin.settings.calendarLocale;
			case 'confirmBeforeCreatingDailyNote': return this.plugin.settings.confirmBeforeCreatingDailyNote;
			case 'maxIndicatorsPerDay': return this.plugin.settings.maxIndicatorsPerDay;
			case 'timeZoneMode': return this.plugin.settings.timeZone.mode;
			default: return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const previous = this.snapshot();
		switch (key) {
			case 'calendarLocale':
				this.plugin.settings.calendarLocale = isCalendarLocale(value) ? value : 'system';
				break;
			case 'firstDayOfWeek':
				this.plugin.settings.firstDayOfWeek = Number(value);
				break;
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
			default:
				return;
		}
		await this.plugin.saveSettings(previous, controlImpact(key));
		if (key === 'timeZoneMode') this.update();
	}

	private quickStatusDefinitions(): SettingDefinitionItem {
		return {
			type: 'group',
			heading: this.text('quickStatus'),
			cls: 'calendar-note-settings-status-group',
			items: [this.renderDefinition(this.text('calendarStatus'), 'A live summary from the existing Sidebar index.', (setting) => {
				setting.settingEl.addClass('calendar-note-status-setting');
				setting.descEl.empty();
				const dashboard = setting.descEl.createDiv({ cls: 'calendar-note-status-grid' });
				const elements: QuickStatusElements = {
					profiles: this.statusCard(dashboard, this.text('enabledProfiles')),
					events: this.statusCard(dashboard, this.text('indexedEvents')),
					diagnostics: this.statusCard(dashboard, this.text('diagnosticsLabel')),
					index: this.statusCard(dashboard, this.text('indexStatus')),
				};
				this.quickStatusElements.add(elements);
				this.updateQuickStatus(elements);
				setting.addButton((button) => button
					.setButtonText(this.text('openDiagnostics'))
					.setIcon('circle-alert')
					.onClick(() => new CalendarDiagnosticsModal(this.plugin).open()));
				setting.addButton((button) => button
					.setButtonText(this.text('refreshIndex'))
					.setIcon('refresh-cw')
					.onClick(async () => {
						button.setDisabled(true).setButtonText(this.text('refreshing'));
						try {
							await this.plugin.index.refresh();
						} catch {
							new Notice('Could not refresh the calendar index.');
						} finally {
							button.setDisabled(false).setButtonText(this.text('refreshIndex'));
							this.refreshRuntimeStatus();
						}
					}));
				const hasValidProfile = this.plugin.settings.sourceProfiles.some((profile) => profile.enabled && profile.startProperty.trim() &&
					(hasSourceConditions(profile) || profile.matchFilesWithStartPropertyOnly));
				if (!hasValidProfile) {
					setting.addButton((button) => button
						.setButtonText(this.text('createFirstProfile'))
						.setCta()
						.onClick(() => this.openSetupAssistant()));
				} else if (!this.plugin.settings.sourceProfiles.some((profile) => profile.enabled && profile.allowCreate && profile.startProperty.trim())) {
					setting.addButton((button) => button
						.setButtonText(this.text('configureEventCreation'))
						.onClick(() => this.openSetupAssistant()));
				}
				return () => this.quickStatusElements.delete(elements);
			}), this.renderDefinition(this.text('settingsSaveStatus'), 'Changes save automatically and are coalesced before expensive updates.', (setting) => {
				const status = setting.controlEl.createSpan({ cls: 'calendar-note-save-status' });
				this.saveStatusElements.add(status);
				this.setSaveStatus(this.plugin.getSettingsSaveState());
				return () => this.saveStatusElements.delete(status);
			})],
		};
	}

	private calendarBehaviorDefinitions(): SettingDefinitionItem {
		return {
			type: 'group',
			heading: this.text('calendarBehavior'),
			items: [{
				name: this.text('calendarLanguage'),
				desc: 'Controls month, weekday, navigation, menu, and calendar status labels.',
				control: { type: 'dropdown', key: 'calendarLocale', options: CALENDAR_LOCALE_OPTIONS },
			}, {
				name: this.text('firstDayOfWeek'),
				desc: 'Choose the first column used by calendar views.',
				control: {
					type: 'dropdown', key: 'firstDayOfWeek',
					options: { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' },
				},
			}, this.weekendDaysDefinition(), {
				name: this.text('confirmDailyCreation'),
				desc: 'Ask before a missing daily note is created from the calendar.',
				control: { type: 'toggle', key: 'confirmBeforeCreatingDailyNote' },
			}, {
				name: this.text('maximumIndicators'),
				desc: 'Additional events are summarized as +N.',
				control: { type: 'slider', key: 'maxIndicatorsPerDay', min: 1, max: 8, step: 1 },
			}],
		};
	}

	private dateTimeDefinitions(): SettingDefinitionItem {
		return {
			type: 'group',
			heading: this.text('dateAndTime'),
			items: [{
				name: this.text('timeZone'),
				desc: 'Used to determine today. Date-only events are never shifted between dates.',
				control: {
					type: 'dropdown', key: 'timeZoneMode',
					options: { system: 'System', utc: 'UTC', custom: 'Custom IANA time zone' },
				},
			}, this.customTimeZoneDefinition(),
			this.dateFormatDefinition(this.text('displayDateFormat'), 'Controls calendar labels, tooltips, and previews. It does not change stored event values.', 'displayDateFormat', 'render'),
			this.dateFormatDefinition(this.text('propertyDateFormat'), 'Strictly parses Start and End properties. Internal dates remain YYYY-MM-DD.', 'eventPropertyDateFormat', 'index')],
		};
	}

	private sourceProfileDefinitions(): SettingDefinitionItem[] {
		const orderedProfiles = sortProfilesForDisplay(this.plugin.settings.sourceProfiles);
		const filteredProfiles = this.profileFilter
			? orderedProfiles.filter((profile) => `${profile.name} ${profile.startProperty} ${describeProfileSource(profile)}`.toLocaleLowerCase().includes(this.profileFilter.toLocaleLowerCase()))
			: orderedProfiles;
		const definitions: SettingDefinitionItem[] = [];
		if (orderedProfiles.length >= 8) definitions.push(this.localFilterDefinition('Source Profile filter', this.profileFilter, 'profile'));
		definitions.push({
			type: 'list',
			heading: this.text('sourceProfiles'),
			emptyState: 'No source profiles are configured.',
			items: filteredProfiles.map((profile) => this.sourceProfilePage(profile)),
			addItem: { name: this.text('addSourceProfile'), action: () => this.openAddSourceProfile() },
			onDelete: (index) => {
				const profile = orderedProfiles[index];
				if (profile) this.confirmDeleteSourceProfile(profile);
			},
			onReorder: (oldIndex, newIndex) => { void this.reorderSourceProfiles(orderedProfiles, oldIndex, newIndex); },
		});
		return definitions;
	}

	private sourceProfilePage(profile: CalendarSourceProfile): SettingDefinitionPage {
		const issues = validateSourceProfile(profile, this.plugin.settings.sourceProfiles, this.app);
		return {
			type: 'page',
			name: getStableProfilePageName(profile),
			desc: this.profileListDescription(profile),
			displayValue: () => `${this.text(profile.enabled ? 'enabled' : 'disabled')} · ${profile.sidebarIndicatorMode === 'icons' ? 'Icons' : 'Dots'} · ${this.plugin.index.getItemCountByProfile(profile.id)} events`,
			status: () => issues.length > 0 ? 'warning' : null,
			items: [{
				type: 'group', heading: this.text('overview'), items: [
					this.profileText(profile, 'Name', 'Display label used in settings and event creation. The immutable ID keeps duplicate names separate.', 'name', undefined, true),
					this.profileToggle(profile, 'Enabled', 'Include this profile in the Sidebar Calendar index.', 'enabled', true),
					this.profileIndicatorMode(profile),
					this.profileEventCount(profile),
					...issues.map((issue) => this.validationDefinition(issue.message, issue.severity)),
				],
			}, {
				type: 'group', heading: this.text('sourceMatching'), items: [
					this.matchingSummaryDefinition(profile),
					this.renderDefinition(this.text('testThisProfile'), this.text('chooseNote'), (setting) => {
						setting.addButton((button) => button.setButtonText(this.text('testNote')).setIcon('flask-conical').onClick(() => {
							new ProfileMatchingInspectorModal(this.plugin, profile).open();
						}));
					}),
					this.profileDropdown(profile, 'Match mode', 'Combine only non-empty source groups. Values within a group always use OR.', 'matchMode', { all: 'All configured groups', any: 'Any configured group' }, () => getSourceGroupCount(profile) >= 2),
					this.profileMultiValue(profile, 'Folders', 'Matches selected folders and their descendants.', 'folders', 'Add a folder', (query) => this.plugin.suggestions.getFolderSuggestions(query), normalizeMultiValue),
					this.profileMultiValue(profile, 'Tags', 'Matches complete Properties or inline tags. Nested tags must be selected explicitly.', 'tags', 'Add a tag', (query) => this.plugin.suggestions.getTagSuggestions(query), normalizeTagToken),
					this.profileText(profile, 'Wiki link property', 'Only this frontmatter property is checked for matching links.', 'wikiLinkProperty', 'property', false, () => this.updateMatchingSummary(profile)),
					this.profileMultiValue(profile, 'Wiki link targets', 'Only values from the configured Wiki link property are checked.', 'wikiLinkTargets', 'Add a Wiki Link target', (query) => this.plugin.suggestions.getWikiLinkSuggestions(query), normalizeWikiLinkToken),
					this.profileToggle(profile, 'Match start property only', 'Use the required Start property as the only source filter.', 'matchFilesWithStartPropertyOnly', true, () => !hasAnyConfiguredSource(profile)),
				],
			}, {
				type: 'group', heading: this.text('propertyMapping'), items: [
					this.profileText(profile, 'Start property', 'Required event start date property.', 'startProperty', 'property', true),
					this.profileText(profile, 'End property', 'Optional inclusive end date property.', 'endProperty', 'property'),
					this.profileText(profile, 'Title property', 'Optional display title property.', 'titleProperty', 'property'),
					this.profileText(profile, 'Type property', 'Optional type or wiki-link property.', 'typeProperty', 'property'),
					this.profileText(profile, 'Icon property', 'Optional Obsidian icon name property.', 'iconProperty', 'property'),
					this.profileText(profile, 'Background color property', 'Optional safe CSS color property.', 'colorProperty', 'property'),
					this.profileText(profile, 'Text color property', 'Optional safe CSS color property.', 'textColorProperty', 'property'),
				],
			}, {
				type: 'group', heading: this.text('displayDefaults'), items: [
					this.profileDefaultType(profile),
					this.profileText(profile, 'Default icon', 'Used when no note property or Event Type Rule supplies an icon.', 'defaultIcon', 'icon'),
					this.profileColorDropdown(profile, 'Default background color', 'Choose Style Settings fallback to inherit the Event fallback.', 'defaultBackgroundColor', OBSIDIAN_BACKGROUND_COLOR_OPTIONS),
					this.profileColorDropdown(profile, 'Default text color', 'Choose Style Settings fallback to inherit the Event fallback.', 'defaultTextColor', OBSIDIAN_TEXT_COLOR_OPTIONS),
				],
			}, {
				type: 'group', heading: this.text('eventCreation'), items: [
					this.profileToggle(profile, 'Allow event creation', 'Make this profile available in the Create Event modal.', 'allowCreate', true),
					this.profileText(profile, 'Create folder', 'Folder used for newly created event notes.', 'createFolder', 'folder', true, undefined, () => profile.allowCreate),
					this.profileText(profile, 'Note template path', `Optional Markdown template. Variables: ${EVENT_TEMPLATE_VARIABLES}`, 'noteTemplatePath', 'file', true, undefined, () => profile.allowCreate),
					this.profileText(profile, 'File name template', `Available variables: ${EVENT_TEMPLATE_VARIABLES}`, 'fileNameTemplate', undefined, false, undefined, () => profile.allowCreate),
					this.profileText(profile, 'Generated title property', 'Property that receives the generated title.', 'generatedTitleProperty', 'property', false, undefined, () => profile.allowCreate),
					this.profileText(profile, 'Generated title template', `Available variables: ${EVENT_TEMPLATE_VARIABLES}`, 'generatedTitleTemplate', undefined, false, undefined, () => profile.allowCreate),
					this.profileText(profile, 'Title date format', 'Date format used by title and filename variables.', 'titleDateFormat', undefined, true, undefined, () => profile.allowCreate),
				],
			}, {
				type: 'group', heading: this.text('advancedDetails'), items: [this.profileId(profile), this.profileOrder(profile)],
			}, {
				type: 'group', heading: this.text('actions'), items: [this.profileActions(profile)],
			}],
		};
	}

	private typeRuleDefinitions(): SettingDefinitionItem[] {
		const rules = this.ruleFilter
			? this.plugin.settings.typeStyleRules.filter((rule) => `${rule.typeValue} ${rule.icon ?? ''}`.toLocaleLowerCase().includes(this.ruleFilter.toLocaleLowerCase()))
			: this.plugin.settings.typeStyleRules;
		const definitions: SettingDefinitionItem[] = [];
		if (this.plugin.settings.typeStyleRules.length >= 8) definitions.push(this.localFilterDefinition('Event Type Rule filter', this.ruleFilter, 'rule'));
		definitions.push({
			type: 'list',
			heading: this.text('eventTypeRules'),
			emptyState: 'No event type rules are configured.',
			items: rules.map((rule) => this.typeRulePage(rule)),
			addItem: { name: this.text('addTypeRule'), action: () => { void this.addTypeRule(); } },
			onDelete: (index) => {
				const rule = this.plugin.settings.typeStyleRules[index];
				if (rule) this.confirmDeleteTypeRule(rule);
			},
			onReorder: (oldIndex, newIndex) => { void this.reorderTypeRules(oldIndex, newIndex); },
		});
		return definitions;
	}

	private typeRulePage(rule: CalendarTypeStyleRule): SettingDefinitionPage {
		const duplicate = this.plugin.settings.typeStyleRules.some((candidate) => candidate.id !== rule.id && candidate.typeValue.trim() === rule.typeValue.trim());
		return {
			type: 'page',
			name: getStableTypeRulePageName(rule),
			desc: this.typeRuleListDescription(rule),
			displayValue: () => this.text(rule.enabled ? 'enabled' : 'disabled'),
			status: () => duplicate ? 'warning' : null,
			items: [{
				type: 'group', heading: this.text('overview'), items: [
					this.ruleToggle(rule, 'Enabled', 'Include this rule in style resolution.', 'enabled'),
					this.ruleText(rule, 'Type value', 'Plain text and equivalent wiki links match the same type.', 'typeValue', undefined, true),
					...(duplicate ? [this.validationDefinition('Another enabled rule has the same Type value. The first enabled rule wins.', 'warning')] : []),
				],
			}, {
				type: 'group', heading: 'Style', items: [
					this.ruleText(rule, 'Icon', 'Obsidian icon name. Leave empty to inherit.', 'icon', 'icon'),
					this.ruleText(rule, 'Background color', 'Safe CSS color or variable. Leave empty to inherit.', 'backgroundColor'),
					this.ruleText(rule, 'Text color', 'Safe CSS color or variable. Leave empty to inherit.', 'textColor'),
					this.ruleStylePreview(rule),
				],
			}, {
				type: 'group', heading: this.text('actions'), items: [this.typeRuleActions(rule)],
			}],
		};
	}

	private diagnosticsDefinitions(): SettingDefinitionItem {
		const diagnostics = this.plugin.diagnostics.getAll();
		const counts = { error: 0, warning: 0, info: 0 };
		for (const diagnostic of diagnostics) counts[diagnostic.severity] += 1;
		return {
			type: 'group', heading: this.text('diagnosticsLabel'), items: [this.renderDefinition(
				'Index diagnostics',
				`${diagnostics.length} issues · ${counts.error} errors · ${counts.warning} warnings · ${counts.info} info`,
				(setting) => {
					setting.addButton((button) => button.setButtonText(this.text('openDiagnostics')).setIcon('circle-alert').onClick(() => new CalendarDiagnosticsModal(this.plugin).open()));
					setting.addButton((button) => button.setButtonText(this.text('refreshIndex')).setIcon('refresh-cw').onClick(async () => {
						button.setDisabled(true);
						try { await this.plugin.index.refresh(); } finally { button.setDisabled(false); }
					}));
				},
			)],
		};
	}

	private weekendDaysDefinition(): SettingDefinition {
		return this.renderDefinition(this.text('weekendDays'), 'Select one or more days. This setting is shared by Sidebar and Bases defaults.', (setting) => {
			const group = setting.controlEl.createDiv({ cls: 'calendar-note-weekday-picker', attr: { role: 'group', 'aria-label': this.text('weekendDays') } });
			for (const weekday of WEEKDAYS) {
				const button = group.createEl('button', { cls: 'calendar-note-weekday-button', text: weekday.label, attr: { type: 'button' } });
				const refresh = () => {
					const selected = this.plugin.settings.weekendDays.includes(weekday.value);
					button.toggleClass('is-selected', selected);
					button.setAttribute('aria-pressed', String(selected));
				};
				refresh();
				button.addEventListener('click', () => { void (async () => {
					const previous = this.snapshot();
					const days = new Set(this.plugin.settings.weekendDays);
					if (days.has(weekday.value)) {
						if (days.size === 1) return;
						days.delete(weekday.value);
					} else days.add(weekday.value);
					this.plugin.settings.weekendDays = [...days].sort((left, right) => left - right);
					refresh();
					await this.plugin.saveSettings(previous, 'render');
				})(); });
			}
		});
	}

	private customTimeZoneDefinition(): SettingDefinition {
		return this.renderDefinition('Custom time zone', 'Search an IANA time zone. The preview uses the current local instant.', (setting) => {
			let suggest: CalendarInputSuggest | undefined;
			const preview = setting.descEl.createDiv({ cls: 'calendar-note-setting-preview' });
			setting.addText((text) => {
				const current = this.plugin.settings.timeZone.mode === 'custom' ? this.plugin.settings.timeZone.timeZone : 'Asia/Taipei';
				const renderPreview = (value: string) => {
					preview.setText(isValidIanaTimeZone(value) ? timeZonePreview(value) : 'Enter a valid IANA time zone.');
					preview.toggleClass('is-error', !isValidIanaTimeZone(value));
				};
				const save = async (value: string) => {
					renderPreview(value);
					if (!isValidIanaTimeZone(value)) return;
					const previous = this.snapshot();
					this.plugin.settings.timeZone = { mode: 'custom', timeZone: value.trim() };
					await this.plugin.saveSettings(previous, 'render');
				};
				text.setValue(current).setPlaceholder('Search time zones').onChange(save);
				renderPreview(current);
				suggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getTimeZoneSuggestions(query), undefined, save);
				text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings().catch(() => undefined); });
			});
			return () => suggest?.close();
		}, () => this.plugin.settings.timeZone.mode === 'custom');
	}

	private dateFormatDefinition(
		name: string,
		desc: string,
		key: 'displayDateFormat' | 'eventPropertyDateFormat',
		impact: CalendarSettingsImpact,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			const current = this.plugin.settings[key];
			const forceCustom = this.customDateModes.has(key);
			const mode = forceCustom ? 'custom' : dateFormatMode(current);
			const preview = setting.descEl.createDiv({ cls: 'calendar-note-setting-preview' });
			const renderPreview = (format: string) => {
				const formatted = formatCalendarDate('2026-08-09', format);
				preview.setText(formatted ? `Example: ${formatted}` : 'The format must contain YYYY, MM, and DD exactly once.');
				preview.toggleClass('is-error', !formatted);
			};
			renderPreview(current);
			setting.addDropdown((dropdown) => {
				for (const preset of DATE_FORMAT_PRESETS) dropdown.addOption(preset, preset);
				dropdown.addOption('custom', 'Custom');
				dropdown.setValue(mode).onChange(async (value) => {
					if (value === 'custom') {
						this.customDateModes.add(key);
						this.update();
						return;
					}
					this.customDateModes.delete(key);
					const previous = this.snapshot();
					this.plugin.settings[key] = value;
					await this.plugin.saveSettings(previous, impact);
					this.update();
				});
			});
			if (mode === 'custom') {
				setting.addText((text) => {
					text.setValue(current).setPlaceholder('YYYY.MM.DD').onChange(async (value) => {
						renderPreview(value);
						if (!isSupportedDateFormat(value)) return;
						const previous = this.snapshot();
						this.plugin.settings[key] = value;
						await this.plugin.saveSettings(previous, impact);
					});
					text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings().catch(() => undefined); });
				});
			}
		});
	}

	private profileText(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: ProfileStringKey,
		suggest?: 'folder' | 'property' | 'icon' | 'file',
		updateOnBlur = false,
		onChange?: () => void,
		visible?: () => boolean,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarInputSuggest | undefined;
			let floatingSuggest: CalendarFloatingSuggest | undefined;
			setting.addText((text) => {
				const saveValue = async (value: string) => {
					await this.updateProfile(profile.id, (current) => { current[key] = value; }, profileImpact(key));
					onChange?.();
				};
				text.setValue(String(profile[key] ?? '')).onChange(saveValue);
				if (suggest === 'folder') floatingSuggest = new CalendarFloatingSuggest(text.inputEl, (query) => this.plugin.suggestions.getFolderSuggestions(query), (value) => value, (value) => ({ value, cursor: value.length }), saveValue);
				if (suggest === 'property') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getPropertySuggestions(query), undefined, saveValue);
				if (suggest === 'icon') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getIconSuggestions(query), undefined, saveValue);
				if (suggest === 'file') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getMarkdownFileSuggestions(query), undefined, saveValue);
				text.inputEl.addEventListener('blur', () => {
					void this.plugin.flushSettings().then(() => { if (updateOnBlur) this.update(); }).catch(() => undefined);
				});
			});
			return () => { inputSuggest?.close(); floatingSuggest?.dispose(); };
		}, visible);
	}

	private profileMultiValue(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'folders' | 'tags' | 'wikiLinkTargets',
		placeholder: string,
		getSuggestions: (query: string) => string[],
		normalize: (value: string) => string,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.controlEl.empty();
			const editor = new CalendarMultiValueEditor({
				containerEl: setting.controlEl,
				values: profile[key],
				placeholder,
				ariaLabel: name,
				getSuggestions,
				normalize,
				onChange: async (values) => {
					await this.updateProfile(profile.id, (current) => { current[key] = values; }, 'index');
					this.updateMatchingSummary(profile);
					this.refreshDomState();
				},
				onCommit: () => this.plugin.flushSettings().then(() => this.update()).catch(() => undefined),
			});
			return () => editor.dispose();
		});
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
				.onChange(async (value) => this.updateProfile(profile.id, (current) => { current[key] = value || undefined; }, 'render')));
		});
	}

	private profileDefaultType(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Default type', 'Initial type used by event creation. Values come from Event Type Rules, other Profile defaults, and the current Sidebar index.', (setting) => {
			const values = collectEventTypeValues(this.plugin.settings, this.plugin.index.getAllItems(), [profile.defaultType]);
			setting.addDropdown((dropdown) => {
				dropdown.addOption('', 'None');
				for (const value of values) dropdown.addOption(value, value);
				dropdown.setValue(profile.defaultType ?? '').onChange(async (value) => {
					await this.updateProfile(profile.id, (current) => { current.defaultType = value || undefined; }, 'save');
				});
			});
		});
	}

	private profileId(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Profile ID', 'Generated automatically and never changes when the display name changes.', (setting) => {
			setting.addText((text) => text.setValue(profile.id).setDisabled(true));
			setting.addExtraButton((button) => button.setIcon('copy').setTooltip('Copy profile ID').onClick(async () => {
				await navigator.clipboard.writeText(profile.id);
				new Notice('Copied profile ID.');
			}));
		});
	}

	private profileOrder(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Order', 'Drag profiles in the list or enter an exact position here.', (setting) => {
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
				text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings().then(() => this.update()).catch(() => undefined); });
			});
		});
	}

	private profileIndicatorMode(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Sidebar indicator', 'Choose how this profile appears in Sidebar date cells.', (setting) => {
			setting.addDropdown((dropdown) => dropdown
				.addOption('dots', 'Colored dots')
				.addOption('icons', 'Icon badges')
				.setValue(profile.sidebarIndicatorMode)
				.onChange(async (value) => this.updateProfile(profile.id, (current) => {
					current.sidebarIndicatorMode = value === 'icons' ? 'icons' : 'dots';
				}, 'render')));
		});
	}

	private profileToggle(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: ProfileBooleanKey,
		refreshState = false,
		visible?: () => boolean,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle.setValue(profile[key] === true).onChange(async (value) => {
				await this.updateProfile(profile.id, (current) => { current[key] = value; }, profileImpact(key));
				this.updateMatchingSummary(profile);
				if (refreshState) this.update();
			}));
		}, visible);
	}

	private profileDropdown(
		profile: CalendarSourceProfile,
		name: string,
		desc: string,
		key: 'matchMode',
		options: Record<string, string>,
		visible?: () => boolean,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addDropdown((dropdown) => dropdown.addOptions(options).setValue(profile[key]).onChange(async (value) => {
				await this.updateProfile(profile.id, (current) => { current.matchMode = value === 'any' ? 'any' : 'all'; }, 'index');
				this.updateMatchingSummary(profile);
			}));
		}, visible);
	}

	private matchingSummaryDefinition(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Matching summary', 'A live explanation of the configured source groups.', (setting) => {
			const summary = setting.controlEl.createDiv({ cls: 'calendar-note-matching-summary', text: describeMatching(profile) });
			const elements = this.matchingSummaryElements.get(profile.id) ?? new Set<HTMLElement>();
			elements.add(summary);
			this.matchingSummaryElements.set(profile.id, elements);
			return () => {
				elements.delete(summary);
				if (elements.size === 0) this.matchingSummaryElements.delete(profile.id);
			};
		});
	}

	private profileEventCount(profile: CalendarSourceProfile): SettingDefinition {
		return { name: 'Indexed events', desc: `${this.plugin.index.getItemCountByProfile(profile.id)} events currently use this profile.` };
	}

	private profileActions(profile: CalendarSourceProfile): SettingDefinition {
		return this.renderDefinition('Profile actions', 'Duplicate, move, or remove this Source Profile.', (setting) => {
			setting.addButton((button) => button.setButtonText(this.text(profile.enabled ? 'disable' : 'enable')).onClick(() => {
				void this.updateProfile(profile.id, (current) => { current.enabled = !current.enabled; }, 'index').then(() => this.updatePreservingScroll());
			}));
			setting.addButton((button) => button.setButtonText(this.text('testThisProfile')).setIcon('flask-conical').onClick(() => {
				new ProfileMatchingInspectorModal(this.plugin, profile).open();
			}));
			setting.addButton((button) => button.setButtonText('Duplicate').setIcon('copy').onClick(() => { void this.duplicateProfile(profile.id); }));
			setting.addButton((button) => button.setButtonText('Move up').setIcon('arrow-up').setDisabled(profile.order <= 1).onClick(() => { void this.moveProfile(profile.id, -1); }));
			setting.addButton((button) => button.setButtonText('Move down').setIcon('arrow-down').setDisabled(profile.order >= this.plugin.settings.sourceProfiles.length).onClick(() => { void this.moveProfile(profile.id, 1); }));
			setting.addButton((button) => button.setButtonText('Delete').setDestructive().onClick(() => this.confirmDeleteSourceProfile(profile)));
		});
	}

	private ruleText(
		rule: CalendarTypeStyleRule,
		name: string,
		desc: string,
		key: RuleStringKey,
		suggest?: 'icon',
		updateOnBlur = false,
	): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			let inputSuggest: CalendarInputSuggest | undefined;
			setting.addText((text) => {
				const save = async (value: string) => {
					if (key === 'typeValue' && !value.trim()) return;
					await this.updateRule(rule.id, (current) => { current[key] = value; });
				};
				text.setValue(String(rule[key] ?? '')).onChange(save);
				if (suggest === 'icon') inputSuggest = new CalendarInputSuggest(this.app, text.inputEl, (query) => this.plugin.suggestions.getIconSuggestions(query), undefined, save);
				text.inputEl.addEventListener('blur', () => { void this.plugin.flushSettings().then(() => { if (updateOnBlur) this.update(); }).catch(() => undefined); });
			});
			return () => inputSuggest?.close();
		});
	}

	private ruleToggle(rule: CalendarTypeStyleRule, name: string, desc: string, key: 'enabled'): SettingDefinition {
		return this.renderDefinition(name, desc, (setting) => {
			setting.addToggle((toggle) => toggle.setValue(rule[key]).onChange(async (value) => this.updateRule(rule.id, (current) => { current[key] = value; })));
		});
	}

	private ruleStylePreview(rule: CalendarTypeStyleRule): SettingDefinition {
		return this.renderDefinition('Preview', 'A compact preview of the rule values. Empty values inherit from the Source Profile or Style Settings.', (setting) => {
			const preview = setting.controlEl.createDiv({ cls: 'calendar-note-type-rule-preview' });
			const icon = preview.createSpan({ cls: 'calendar-note-type-rule-preview-icon' });
			setIcon(icon, rule.icon || 'calendar');
			preview.createSpan({ text: rule.typeValue });
			if (rule.backgroundColor) preview.style.backgroundColor = rule.backgroundColor;
			if (rule.textColor) preview.style.color = rule.textColor;
		});
	}

	private typeRuleActions(rule: CalendarTypeStyleRule): SettingDefinition {
		const index = this.plugin.settings.typeStyleRules.findIndex((candidate) => candidate.id === rule.id);
		return this.renderDefinition('Rule actions', 'Duplicate, move, or remove this Event Type Rule.', (setting) => {
			setting.addButton((button) => button.setButtonText(this.text(rule.enabled ? 'disable' : 'enable')).onClick(() => {
				void this.updateRule(rule.id, (current) => { current.enabled = !current.enabled; }).then(() => this.updatePreservingScroll());
			}));
			setting.addButton((button) => button.setButtonText('Duplicate').setIcon('copy').onClick(() => { void this.duplicateRule(rule.id); }));
			setting.addButton((button) => button.setButtonText('Move up').setIcon('arrow-up').setDisabled(index <= 0).onClick(() => { void this.moveRule(rule.id, -1); }));
			setting.addButton((button) => button.setButtonText('Move down').setIcon('arrow-down').setDisabled(index >= this.plugin.settings.typeStyleRules.length - 1).onClick(() => { void this.moveRule(rule.id, 1); }));
			setting.addButton((button) => button.setButtonText('Delete').setDestructive().onClick(() => this.confirmDeleteTypeRule(rule)));
		});
	}

	private validationDefinition(message: string, severity: 'warning' | 'error'): SettingDefinition {
		return this.renderDefinition(severity === 'error' ? 'Needs attention' : 'Check this setting', message, (setting) => {
			setting.settingEl.addClass('calendar-note-validation-row', `is-${severity}`);
			const icon = setting.controlEl.createSpan({ cls: 'calendar-note-validation-icon' });
			setIcon(icon, severity === 'error' ? 'circle-x' : 'triangle-alert');
		});
	}

	private renderDefinition(
		name: string,
		desc: string,
		render: (setting: Setting) => void | (() => void),
		visible?: () => boolean,
	): SettingDefinition {
		return { name, desc, visible, render: (setting) => render(setting) };
	}

	private localFilterDefinition(name: string, value: string, target: 'profile' | 'rule'): SettingDefinitionItem {
		return {
			type: 'group',
			heading: name,
			items: [this.renderDefinition(name, 'Filters only the current settings list and never scans the vault.', (setting) => {
				setting.addSearch((search) => {
					search.setValue(value).onChange((next) => {
						if (target === 'profile') this.profileFilter = next;
						else this.ruleFilter = next;
						const timer = target === 'profile' ? this.profileFilterTimer : this.ruleFilterTimer;
						if (timer !== undefined) window.clearTimeout(timer);
						const nextTimer = window.setTimeout(() => {
							this.updatePreservingScroll();
							window.setTimeout(() => {
								const input = this.containerEl.querySelector<HTMLInputElement>('.calendar-note-local-filter');
								input?.focus();
							}, 0);
						}, 160);
						if (target === 'profile') this.profileFilterTimer = nextTimer;
						else this.ruleFilterTimer = nextTimer;
					});
					search.inputEl.addClass('calendar-note-local-filter');
				});
			})],
		};
	}

	private statusCard(container: HTMLElement, label: string): HTMLElement {
		const card = container.createDiv({ cls: 'calendar-note-status-card' });
		card.createDiv({ cls: 'calendar-note-status-label', text: label });
		return card.createDiv({ cls: 'calendar-note-status-value' });
	}

	private updateQuickStatus(elements: QuickStatusElements): void {
		elements.profiles.setText(String(this.plugin.settings.sourceProfiles.filter((profile) => profile.enabled).length));
		elements.events.setText(String(this.plugin.index.getAllItems().length));
		elements.diagnostics.setText(String(this.plugin.diagnostics.getAll().length));
		const status = this.plugin.index.getStatus();
		elements.index.setText(this.text(status === 'not-initialized' ? 'indexNotInitialized' : status === 'initializing' ? 'indexInitializing' : 'indexReady'));
	}

	private refreshRuntimeStatus(): void {
		for (const elements of this.quickStatusElements) this.updateQuickStatus(elements);
	}

	private updateMatchingSummary(profile: CalendarSourceProfile): void {
		for (const element of this.matchingSummaryElements.get(profile.id) ?? []) element.setText(describeMatching(profile));
	}

	private profileListDescription(profile: CalendarSourceProfile): DocumentFragment {
		const fragment = createFragment();
		const summary = fragment.createDiv({ cls: 'calendar-note-settings-list-summary' });
		summary.createDiv({ cls: 'calendar-note-settings-list-title', text: profile.name });
		summary.createDiv({ cls: 'calendar-note-settings-list-meta', text: `${profile.enabled ? 'Enabled' : 'Disabled'} · Start: ${profile.startProperty || 'Not set'} · Indicator: ${profile.sidebarIndicatorMode === 'icons' ? 'Icons' : 'Dots'}` });
		summary.createDiv({ cls: 'calendar-note-settings-list-source', text: describeProfileSource(profile) });
		this.addProfileMenuButton(summary, profile);
		return fragment;
	}

	private typeRuleListDescription(rule: CalendarTypeStyleRule): DocumentFragment {
		const fragment = createFragment();
		const summary = fragment.createDiv({ cls: 'calendar-note-settings-list-summary calendar-note-settings-rule-summary' });
		const title = summary.createDiv({ cls: 'calendar-note-settings-list-title' });
		const preview = title.createSpan({ cls: 'calendar-note-settings-rule-preview', attr: { 'aria-label': `Style preview for ${rule.typeValue}` } });
		const icon = preview.createSpan();
		setIcon(icon, rule.icon || 'calendar');
		if (rule.backgroundColor) preview.style.backgroundColor = rule.backgroundColor;
		if (rule.textColor) preview.style.color = rule.textColor;
		title.createSpan({ text: rule.typeValue });
		summary.createDiv({ cls: 'calendar-note-settings-list-meta', text: `${rule.enabled ? 'Enabled' : 'Disabled'} · ${rule.icon || 'Inherited icon'} · ${rule.backgroundColor || 'Inherited background'} · ${rule.textColor || 'Inherited text'}` });
		this.addTypeRuleMenuButton(summary, rule);
		return fragment;
	}

	private addProfileMenuButton(container: HTMLElement, profile: CalendarSourceProfile): void {
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-settings-more', attr: { type: 'button', 'aria-label': `More actions for ${profile.name}` } });
		setIcon(button, 'more-horizontal');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const menu = new Menu();
			menu.addItem((item) => item.setTitle(this.text('edit')).setIcon('pencil').onClick(() => this.activatePageRow(container)));
			menu.addItem((item) => item.setTitle(this.text(profile.enabled ? 'disable' : 'enable')).setIcon(profile.enabled ? 'circle-pause' : 'circle-play').onClick(() => {
				void this.updateProfile(profile.id, (current) => { current.enabled = !current.enabled; }, 'index').then(() => this.updatePreservingScroll());
			}));
			menu.addItem((item) => item.setTitle(this.text('duplicate')).setIcon('copy').onClick(() => { void this.duplicateProfile(profile.id); }));
			menu.addItem((item) => item.setTitle(this.text('moveUp')).setIcon('arrow-up').setDisabled(profile.order <= 1).onClick(() => { void this.moveProfile(profile.id, -1); }));
			menu.addItem((item) => item.setTitle(this.text('moveDown')).setIcon('arrow-down').setDisabled(profile.order >= this.plugin.settings.sourceProfiles.length).onClick(() => { void this.moveProfile(profile.id, 1); }));
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(this.text('delete')).setIcon('trash').onClick(() => this.confirmDeleteSourceProfile(profile)));
			menu.showAtMouseEvent(event);
		});
	}

	private addTypeRuleMenuButton(container: HTMLElement, rule: CalendarTypeStyleRule): void {
		const index = this.plugin.settings.typeStyleRules.findIndex((candidate) => candidate.id === rule.id);
		const button = container.createEl('button', { cls: 'clickable-icon calendar-note-settings-more', attr: { type: 'button', 'aria-label': `More actions for ${rule.typeValue}` } });
		setIcon(button, 'more-horizontal');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const menu = new Menu();
			menu.addItem((item) => item.setTitle(this.text('edit')).setIcon('pencil').onClick(() => this.activatePageRow(container)));
			menu.addItem((item) => item.setTitle(this.text(rule.enabled ? 'disable' : 'enable')).setIcon(rule.enabled ? 'circle-pause' : 'circle-play').onClick(() => {
				void this.updateRule(rule.id, (current) => { current.enabled = !current.enabled; }).then(() => this.updatePreservingScroll());
			}));
			menu.addItem((item) => item.setTitle(this.text('duplicate')).setIcon('copy').onClick(() => { void this.duplicateRule(rule.id); }));
			menu.addItem((item) => item.setTitle(this.text('moveUp')).setIcon('arrow-up').setDisabled(index <= 0).onClick(() => { void this.moveRule(rule.id, -1); }));
			menu.addItem((item) => item.setTitle(this.text('moveDown')).setIcon('arrow-down').setDisabled(index >= this.plugin.settings.typeStyleRules.length - 1).onClick(() => { void this.moveRule(rule.id, 1); }));
			menu.addSeparator();
			menu.addItem((item) => item.setTitle(this.text('delete')).setIcon('trash').onClick(() => this.confirmDeleteTypeRule(rule)));
			menu.showAtMouseEvent(event);
		});
	}

	private openAddSourceProfile(): void {
		new AddSourceProfileModal(this.app, (preset) => { void this.addSourceProfile(preset); }, this.plugin.settings.calendarLocale).open();
	}

	private openSetupAssistant(): void {
		new SetupAssistantModal(this.plugin, (profile) => this.plugin.addSetupProfile(profile)).open();
	}

	private activatePageRow(container: HTMLElement): void {
		const EventConstructor = container.ownerDocument.defaultView?.MouseEvent ?? MouseEvent;
		container.dispatchEvent(new EventConstructor('click', { bubbles: true }));
	}

	private async addSourceProfile(preset: SourceProfilePreset): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.sourceProfiles.push(createSourceProfileFromPreset(this.plugin.settings.sourceProfiles, preset));
		await this.plugin.saveSettings(previous, 'index', true);
		this.update();
		new Notice('Source profile added.');
	}

	private async duplicateProfile(profileId: string): Promise<void> {
		const duplicate = duplicateSourceProfile(this.plugin.settings.sourceProfiles, profileId);
		if (!duplicate) return;
		const previous = this.snapshot();
		this.plugin.settings.sourceProfiles.push(duplicate);
		await this.plugin.saveSettings(previous, 'index', true);
		this.update();
	}

	private async moveProfile(profileId: string, direction: -1 | 1): Promise<void> {
		const profile = this.plugin.settings.sourceProfiles.find((candidate) => candidate.id === profileId);
		if (!profile) return;
		const previous = this.snapshot();
		if (!moveSourceProfileToOrder(this.plugin.settings.sourceProfiles, profileId, profile.order + direction)) return;
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private confirmDeleteSourceProfile(profile: CalendarSourceProfile): void {
		new ConfirmSettingsActionModal(this.app, 'Delete source profile?', `“${profile.name}” will be removed. Event notes in your vault will not be deleted.`, 'Delete', () => { void this.deleteSourceProfile(profile.id); }).open();
	}

	private async deleteSourceProfile(profileId: string): Promise<void> {
		const previous = this.snapshot();
		if (!removeSourceProfile(this.plugin.settings, profileId)) return;
		await this.plugin.saveSettings(previous, 'index', true);
		this.update();
	}

	private async reorderSourceProfiles(ordered: CalendarSourceProfile[], oldIndex: number, newIndex: number): Promise<void> {
		const profile = ordered[oldIndex];
		if (!profile) return;
		const previous = this.snapshot();
		if (!moveSourceProfileToOrder(this.plugin.settings.sourceProfiles, profile.id, newIndex + 1)) return;
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async addTypeRule(): Promise<void> {
		const previous = this.snapshot();
		this.plugin.settings.typeStyleRules.push(createTypeRule(this.plugin.settings.typeStyleRules));
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async duplicateRule(ruleId: string): Promise<void> {
		const duplicate = duplicateTypeRule(this.plugin.settings.typeStyleRules, ruleId);
		if (!duplicate) return;
		const previous = this.snapshot();
		this.plugin.settings.typeStyleRules.push(duplicate);
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async moveRule(ruleId: string, direction: -1 | 1): Promise<void> {
		const index = this.plugin.settings.typeStyleRules.findIndex((rule) => rule.id === ruleId);
		if (index < 0) return;
		const previous = this.snapshot();
		if (!moveItem(this.plugin.settings.typeStyleRules, index, index + direction)) return;
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async reorderTypeRules(oldIndex: number, newIndex: number): Promise<void> {
		const previous = this.snapshot();
		if (!moveItem(this.plugin.settings.typeStyleRules, oldIndex, newIndex)) return;
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private confirmDeleteTypeRule(rule: CalendarTypeStyleRule): void {
		new ConfirmSettingsActionModal(this.app, 'Delete Event Type Rule?', `“${rule.typeValue}” will be removed. Event notes are not changed.`, 'Delete', () => { void this.deleteTypeRule(rule.id); }).open();
	}

	private async deleteTypeRule(ruleId: string): Promise<void> {
		const previous = this.snapshot();
		const index = this.plugin.settings.typeStyleRules.findIndex((rule) => rule.id === ruleId);
		if (index < 0) return;
		this.plugin.settings.typeStyleRules.splice(index, 1);
		await this.plugin.saveSettings(previous, 'render', true);
		this.update();
	}

	private async updateProfile(profileId: string, update: (profile: CalendarSourceProfile) => void, impact: CalendarSettingsImpact): Promise<void> {
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

	private updatePreservingScroll(): void {
		const scrollTop = this.containerEl.scrollTop;
		this.update();
		window.setTimeout(() => { this.containerEl.scrollTop = scrollTop; }, 0);
	}

	private text(key: CalendarTextKey, values: Record<string, string | number> = {}): string {
		return calendarText(this.plugin.settings.calendarLocale, key, values);
	}
}

type ProfileStringKey =
	| 'name' | 'startProperty' | 'endProperty' | 'titleProperty' | 'typeProperty'
	| 'iconProperty' | 'colorProperty' | 'textColorProperty' | 'wikiLinkProperty'
	| 'defaultType' | 'defaultIcon' | 'defaultBackgroundColor' | 'defaultTextColor'
	| 'createFolder' | 'noteTemplatePath' | 'fileNameTemplate' | 'generatedTitleProperty'
	| 'generatedTitleTemplate' | 'titleDateFormat';

type ProfileBooleanKey = 'enabled' | 'matchFilesWithStartPropertyOnly' | 'allowCreate';
type RuleStringKey = 'typeValue' | 'icon' | 'backgroundColor' | 'textColor';

function controlImpact(key: string): CalendarSettingsImpact {
	if (key === 'confirmBeforeCreatingDailyNote') return 'save';
	return 'render';
}

function isCalendarLocale(value: unknown): value is CalendarSettings['calendarLocale'] {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CALENDAR_LOCALE_OPTIONS, value);
}

function profileImpact(key: ProfileStringKey | ProfileBooleanKey): CalendarSettingsImpact {
	if ([
		'enabled', 'matchFilesWithStartPropertyOnly', 'startProperty', 'endProperty', 'titleProperty',
		'typeProperty', 'iconProperty', 'colorProperty', 'textColorProperty', 'wikiLinkProperty',
	].includes(key)) return 'index';
	if (['defaultIcon', 'defaultBackgroundColor', 'defaultTextColor'].includes(key)) return 'render';
	return 'save';
}

function timeZonePreview(timeZone: string): string {
	return `Current time: ${new Intl.DateTimeFormat(undefined, {
		timeZone,
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(new Date())}`;
}
