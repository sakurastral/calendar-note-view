import type { CalendarLocale } from './models';

export const CALENDAR_LOCALE_OPTIONS: Record<CalendarLocale, string> = {
	system: 'Obsidian language',
	en: 'English',
	'zh-TW': '繁體中文',
	'zh-CN': '简体中文',
	ja: '日本語',
	ko: '한국어',
};

let obsidianLocale = 'en';

/** Sets the public Obsidian app language used by the persisted `system` option. */
export function setCalendarObsidianLocale(locale: string): void {
	obsidianLocale = locale.trim() || 'en';
}

export type CalendarTextKey =
	| 'sidebarSide' | 'sidebarSideDescription' | 'sidebarLeft' | 'sidebarRight'
	| 'previousMonth' | 'nextMonth' | 'today' | 'refreshCalendar'
	| 'calendarYear' | 'calendarMonth' | 'createEventOn' | 'dailyNoteExists'
	| 'refreshFailed' | 'openDailyNote' | 'createDailyNote' | 'createEvent'
	| 'eventsOnDate' | 'noEvents' | 'openNote' | 'openInNewTab'
	| 'copyObsidianLink' | 'copiedObsidianLink' | 'more' | 'moreEventsOn'
	| 'chooseStartProperty' | 'invalidStartProperty' | 'baseQueryEmpty' | 'baseDatesEmpty'
	| 'monthEventsEmpty' | 'skippedInvalidEntries' | 'viewSkippedEntries' | 'agendaTitle'
	| 'openAgenda' | 'selectedDate' | 'eventTypeLabel' | 'visiblePropertiesLabel'
	| 'baseCreateTitle' | 'eventTitleLabel' | 'startDateLabel' | 'endDateLabel'
	| 'eventTypeOptional' | 'cancel' | 'create' | 'baseStartNotWritable' | 'baseCreateFailed'
	| 'invalidStart' | 'invalidEnd' | 'endBeforeStart' | 'unreadableValue'
	| 'calendarNoteView' | 'openSidebarCalendar' | 'goToToday' | 'showTodaysEvents'
	| 'createEventWithProfile' | 'refreshSidebarIndex' | 'openCalendarDiagnostics'
	| 'sidebarSetupTitle' | 'sidebarSetupDescription' | 'setupSidebarCalendar'
	| 'configureEventCreation' | 'eventCreationUnavailable' | 'viewAgenda'
	| 'sourceProfileLabel' | 'sourceProfileDescription' | 'inclusiveEndDateLabel'
	| 'eventTypeLabelOptional' | 'advancedDetails' | 'advancedOverrides'
	| 'iconOverride' | 'backgroundOverride' | 'textOverride' | 'collisionBehavior'
	| 'appendNumber' | 'cancelCreation' | 'generatedOutput' | 'generatedTitle'
	| 'fileName' | 'createFolder' | 'template' | 'vaultRoot' | 'none'
	| 'displayedStartDate' | 'completeRequiredFields' | 'eventTitleRequired'
	| 'profileUnavailable' | 'creating' | 'created' | 'createFailed' | 'filenameExists'
	| 'userOverride' | 'profileDefault' | 'eventTypeRule' | 'styleSettingsFallback' | 'themeFallback'
	| 'chooseProfile' | 'searchProfiles' | 'noCreateProfiles'
	| 'setupAssistant' | 'setupChooseSource' | 'setupSourceMatching' | 'setupPropertyMapping'
	| 'setupEventCreation' | 'setupReview' | 'back' | 'next' | 'finish'
	| 'choosePresetDescription' | 'folderBased' | 'tagBased' | 'wikiLinkBased'
	| 'startPropertyOnly' | 'advancedEmpty' | 'profileName' | 'foldersLabel' | 'tagsLabel'
	| 'wikiLinkPropertyLabel' | 'wikiLinkTargetsLabel' | 'startPropertyLabel'
	| 'endPropertyLabel' | 'titlePropertyLabel' | 'typePropertyLabel' | 'allowEventCreation'
	| 'setupCancelNotice' | 'testThisProfile' | 'matchingInspector' | 'chooseNote'
	| 'testNote' | 'testResult' | 'pass' | 'fail' | 'notApplicable' | 'profileEnabled'
	| 'markdownFile' | 'frontmatterExists' | 'startConfigured' | 'containsStart'
	| 'startParse' | 'endParse' | 'folderGroup' | 'tagGroup' | 'wikiLinkGroup'
	| 'finalMatch' | 'startOnlyActive' | 'normalizedEvent' | 'matchedTypeRule'
	| 'styleSources' | 'diagnosticsLabel' | 'disabledAssumption' | 'fileNotFound'
	| 'calendarDiagnostics' | 'noDiagnostics' | 'severitySummary' | 'codeLabel'
	| 'messageLabel' | 'fileLabel' | 'sourceProfileColumn' | 'profileSetting'
	| 'copyProfileId' | 'copySupportSummary' | 'supportSummaryCopied' | 'includeFilePaths'
	| 'indexNotInitialized' | 'indexInitializing' | 'indexReady' | 'saving' | 'saved' | 'saveFailed'
	| 'enabled' | 'disabled' | 'enable' | 'disable' | 'edit' | 'duplicate'
	| 'moveUp' | 'moveDown' | 'delete' | 'moreActions' | 'refreshing'
	| 'profileAdded' | 'profileCreated' | 'recommendedAction' | 'createFirstProfile'
	| 'dailyNoteAction' | 'dailyNoteIndicator' | 'eventIndicator' | 'monthChanged'
	| 'quickStatus' | 'calendarBehavior' | 'dateAndTime' | 'sourceProfiles' | 'eventTypeRules'
	| 'overview' | 'sourceMatching' | 'propertyMapping' | 'displayDefaults' | 'eventCreation'
	| 'actions' | 'calendarLanguage' | 'firstDayOfWeek' | 'weekendDays' | 'timeZone'
	| 'displayDateFormat' | 'propertyDateFormat' | 'confirmDailyCreation' | 'maximumIndicators'
	| 'enabledProfiles' | 'indexedEvents' | 'indexStatus' | 'settingsSaveStatus'
	| 'openDiagnostics' | 'refreshIndex' | 'calendarStatus' | 'addSourceProfile' | 'addTypeRule';

const ENGLISH: Record<CalendarTextKey, string> = {
	sidebarSide: 'Sidebar opening position', sidebarLeft: 'Left sidebar', sidebarRight: 'Right sidebar',
	sidebarSideDescription: 'Used the next time you open Sidebar Calendar. An existing Calendar on the other side will move to this side.',
	previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today', refreshCalendar: 'Refresh calendar',
	calendarYear: 'Calendar year', calendarMonth: 'Calendar month', createEventOn: 'Create event on {date}',
	dailyNoteExists: 'Daily note exists', refreshFailed: 'Could not refresh the calendar index.',
	openDailyNote: 'Open daily note', createDailyNote: 'Create daily note', createEvent: 'Create event',
	eventsOnDate: 'Events on this date', noEvents: 'No events', openNote: 'Open note', openInNewTab: 'Open in new tab',
	copyObsidianLink: 'Copy Obsidian link', copiedObsidianLink: 'Copied Obsidian link.', more: '+{count} more',
	moreEventsOn: '{count} more events on {date}', chooseStartProperty: 'Choose a start property in the view options.',
	invalidStartProperty: 'The selected start property is not available in this Base.',
	baseQueryEmpty: 'The current Base query has no entries.', baseDatesEmpty: 'No Base entries contain valid calendar dates.',
	monthEventsEmpty: 'There are no events in this month.', skippedInvalidEntries: '{count} entries were skipped because their dates are invalid.',
	viewSkippedEntries: 'View skipped entries', agendaTitle: '{date} · {count} events', openAgenda: 'View events on {date}',
	selectedDate: 'Selected date: {date}', eventTypeLabel: 'Type', visiblePropertiesLabel: 'Properties',
	baseCreateTitle: 'Create Base event', eventTitleLabel: 'Title', startDateLabel: 'Start date', endDateLabel: 'End date',
	eventTypeOptional: 'Event type (optional)', cancel: 'Cancel', create: 'Create',
	baseStartNotWritable: 'Event creation is unavailable because Start property is not a writable note property.',
	baseCreateFailed: 'Could not create the Base event.', invalidStart: 'Invalid start date', invalidEnd: 'Invalid end date',
	endBeforeStart: 'End date is before start date', unreadableValue: 'A property value could not be read',
	calendarNoteView: 'Calendar note view', openSidebarCalendar: 'Open Sidebar Calendar', goToToday: 'Go to today',
	showTodaysEvents: "Show today's events", createEventWithProfile: 'Create event with Source Profile…',
	refreshSidebarIndex: 'Refresh Sidebar index', openCalendarDiagnostics: 'Open Calendar diagnostics',
	sidebarSetupTitle: 'Set up Sidebar Calendar', sidebarSetupDescription: 'Sidebar Calendar needs a Source Profile. Bases Calendar works without one.',
	setupSidebarCalendar: 'Set up Sidebar Calendar', configureEventCreation: 'Configure event creation',
	eventCreationUnavailable: 'No enabled Source Profile allows event creation.', viewAgenda: 'View agenda',
	sourceProfileLabel: 'Source Profile', sourceProfileDescription: 'Controls the folder, template, property mapping, and defaults.',
	inclusiveEndDateLabel: 'Inclusive end date', eventTypeLabelOptional: 'Event type (optional)', advancedDetails: 'Advanced details',
	advancedOverrides: '{count} overrides', iconOverride: 'Icon override', backgroundOverride: 'Background override', textOverride: 'Text override',
	collisionBehavior: 'If the filename already exists', appendNumber: 'Append a number', cancelCreation: 'Cancel creation',
	generatedOutput: 'Generated output', generatedTitle: 'Generated title', fileName: 'File name', createFolder: 'Create folder',
	template: 'Template', vaultRoot: 'Vault root', none: 'None', displayedStartDate: 'Displayed start date',
	completeRequiredFields: 'Complete the required fields.', eventTitleRequired: 'Event title is required.',
	profileUnavailable: 'Choose a Source Profile that allows event creation.', creating: 'Creating…', created: 'Created',
	createFailed: 'Could not create the event note.', filenameExists: 'An event note with that filename already exists.',
	userOverride: 'User override', profileDefault: 'Source Profile default', eventTypeRule: 'Event Type Rule',
	styleSettingsFallback: 'Style Settings fallback', themeFallback: 'Obsidian theme fallback', chooseProfile: 'Choose Source Profile',
	searchProfiles: 'Search Source Profiles', noCreateProfiles: 'No create-enabled Source Profiles are available.',
	setupAssistant: 'Sidebar Calendar setup', setupChooseSource: 'Choose source', setupSourceMatching: 'Source matching',
	setupPropertyMapping: 'Required property mapping', setupEventCreation: 'Optional event creation', setupReview: 'Review and test',
	back: 'Back', next: 'Next', finish: 'Finish', choosePresetDescription: 'Choose how notes become Sidebar events.',
	folderBased: 'Folder-based', tagBased: 'Tag-based', wikiLinkBased: 'Wiki Link-based', startPropertyOnly: 'Start-property-only',
	advancedEmpty: 'Advanced / empty', profileName: 'Profile name', foldersLabel: 'Folders', tagsLabel: 'Tags',
	wikiLinkPropertyLabel: 'Wiki Link property', wikiLinkTargetsLabel: 'Wiki Link targets', startPropertyLabel: 'Start property',
	endPropertyLabel: 'End property', titlePropertyLabel: 'Title property', typePropertyLabel: 'Type property', allowEventCreation: 'Allow event creation',
	setupCancelNotice: 'Setup was cancelled. No Source Profile was saved.', testThisProfile: 'Test this profile',
	matchingInspector: 'Source Profile matching inspector', chooseNote: 'Choose a Markdown note', testNote: 'Test note', testResult: 'Test result',
	pass: 'Pass', fail: 'Fail', notApplicable: 'Not configured', profileEnabled: 'Profile enabled', markdownFile: 'Markdown file',
	frontmatterExists: 'Frontmatter exists', startConfigured: 'Start property configured', containsStart: 'Note contains Start property',
	startParse: 'Start date parses', endParse: 'End date parses', folderGroup: 'Folder group', tagGroup: 'Tag group',
	wikiLinkGroup: 'Wiki Link group', finalMatch: 'Final match', startOnlyActive: 'Start-only active', normalizedEvent: 'Normalized event',
	matchedTypeRule: 'First matching Event Type Rule', styleSources: 'Resolved style sources', diagnosticsLabel: 'Diagnostics',
	disabledAssumption: 'This Profile is disabled. The checks below also show whether it would match if enabled.',
	fileNotFound: 'The selected Markdown note could not be found.', calendarDiagnostics: 'Calendar diagnostics', noDiagnostics: 'No calendar diagnostics.',
	severitySummary: '{errors} errors · {warnings} warnings · {info} info', codeLabel: 'Code', messageLabel: 'Message', fileLabel: 'File',
	sourceProfileColumn: 'Source Profile', profileSetting: 'Profile setting', copyProfileId: 'Copy Profile ID',
	copySupportSummary: 'Copy support summary', supportSummaryCopied: 'Support summary copied.', includeFilePaths: 'Include file paths',
	indexNotInitialized: 'Not initialized', indexInitializing: 'Initializing…', indexReady: 'Ready', saving: 'Saving…', saved: 'Saved',
	saveFailed: 'Save failed', enabled: 'Enabled', disabled: 'Disabled', enable: 'Enable', disable: 'Disable', edit: 'Edit',
	duplicate: 'Duplicate', moveUp: 'Move up', moveDown: 'Move down', delete: 'Delete', moreActions: 'More actions', refreshing: 'Refreshing…',
	profileAdded: 'Source Profile added.', profileCreated: 'Source Profile created.', recommendedAction: 'Recommended action',
	createFirstProfile: 'Create your first Source Profile', dailyNoteAction: 'Open or create daily note for {date}',
	dailyNoteIndicator: 'Daily note exists for {date}', eventIndicator: 'Open {title}', monthChanged: 'Showing {month}',
	quickStatus: 'Quick status', calendarBehavior: 'Calendar behavior', dateAndTime: 'Date & time', sourceProfiles: 'Source Profiles',
	eventTypeRules: 'Event Type Rules', overview: 'Overview', sourceMatching: 'Source matching', propertyMapping: 'Property mapping',
	displayDefaults: 'Display defaults', eventCreation: 'Event creation', actions: 'Actions', calendarLanguage: 'Calendar language',
	firstDayOfWeek: 'First day of week', weekendDays: 'Weekend days', timeZone: 'Time zone', displayDateFormat: 'Display date format',
	propertyDateFormat: 'Event property date format', confirmDailyCreation: 'Confirm before creating daily note', maximumIndicators: 'Maximum indicators per date',
	enabledProfiles: 'Enabled Profiles', indexedEvents: 'Indexed events', indexStatus: 'Index status', settingsSaveStatus: 'Settings save status',
	openDiagnostics: 'Open diagnostics', refreshIndex: 'Refresh index', calendarStatus: 'Calendar status', addSourceProfile: 'Add Source Profile', addTypeRule: 'Add type rule',
};

const TRANSLATION_OVERRIDES: Record<Exclude<CalendarLocale, 'system' | 'en'>, Partial<Record<CalendarTextKey, string>>> = {
	'zh-TW': {
		sidebarSide: '側邊欄開啟位置', sidebarLeft: '左側邊欄', sidebarRight: '右側邊欄',
		sidebarSideDescription: '下次開啟側邊欄日曆時套用；若日曆已在另一側開啟，會移至所選位置。',
		previousMonth: '上個月', nextMonth: '下個月', today: '今天', refreshCalendar: '重新整理日曆',
		calendarYear: '日曆年份', calendarMonth: '日曆月份', createEventOn: '在 {date} 建立事件',
		dailyNoteExists: '已有每日筆記', refreshFailed: '無法重新整理日曆索引。',
		openDailyNote: '開啟每日筆記', createDailyNote: '建立每日筆記', createEvent: '建立事件',
		eventsOnDate: '這一天的事件', noEvents: '沒有事件', openNote: '開啟筆記', openInNewTab: '在新分頁開啟',
		copyObsidianLink: '複製 Obsidian 連結', copiedObsidianLink: '已複製 Obsidian 連結。', more: '另有 {count} 個',
		moreEventsOn: '{date} 另有 {count} 個事件', chooseStartProperty: '請在檢視選項中選擇開始日期屬性。',
		invalidStartProperty: '選取的開始日期屬性無法在此 Base 中使用。', baseQueryEmpty: '目前的 Base 查詢沒有項目。',
		baseDatesEmpty: 'Base 項目中沒有有效的日曆日期。', monthEventsEmpty: '這個月沒有事件。',
		skippedInvalidEntries: '有 {count} 個項目因日期無效而略過。', viewSkippedEntries: '查看略過的項目',
		agendaTitle: '{date} · {count} 個事件', openAgenda: '查看 {date} 的事件', selectedDate: '已選取日期：{date}',
		eventTypeLabel: '類型', visiblePropertiesLabel: '屬性', baseCreateTitle: '建立 Base 事件', eventTitleLabel: '標題',
		startDateLabel: '開始日期', endDateLabel: '結束日期', eventTypeOptional: '事件類型（選填）', cancel: '取消', create: '建立',
		baseStartNotWritable: '開始日期屬性不是可寫入的筆記屬性，因此無法建立事件。', baseCreateFailed: '無法建立 Base 事件。',
		invalidStart: '開始日期無效', invalidEnd: '結束日期無效', endBeforeStart: '結束日期早於開始日期', unreadableValue: '無法讀取屬性值',
		calendarNoteView: '日曆筆記檢視', openSidebarCalendar: '開啟側邊欄日曆', goToToday: '前往今天', showTodaysEvents: '顯示今天的事件',
		createEventWithProfile: '使用來源設定檔建立事件…', refreshSidebarIndex: '重新整理側邊欄索引', openCalendarDiagnostics: '開啟日曆診斷',
		sidebarSetupTitle: '設定側邊欄日曆', sidebarSetupDescription: '側邊欄日曆需要來源設定檔；Bases 日曆不需要。', setupSidebarCalendar: '設定側邊欄日曆',
		configureEventCreation: '設定事件建立功能', eventCreationUnavailable: '沒有已啟用且允許建立事件的來源設定檔。', viewAgenda: '查看日程',
		sourceProfileLabel: '來源設定檔', inclusiveEndDateLabel: '包含當日的結束日期', advancedDetails: '進階詳細資料', creating: '建立中…',
		created: '已建立', createFailed: '無法建立事件筆記。', setupAssistant: '側邊欄日曆設定精靈', setupChooseSource: '選擇來源',
		setupSourceMatching: '來源比對', setupPropertyMapping: '必要屬性對應', setupEventCreation: '選用的事件建立功能', setupReview: '檢閱與測試',
		back: '返回', next: '下一步', finish: '完成', testThisProfile: '測試此設定檔', matchingInspector: '來源設定檔比對檢查器',
		chooseNote: '選擇 Markdown 筆記', testNote: '測試筆記', pass: '通過', fail: '未通過', notApplicable: '未設定', profileEnabled: '設定檔已啟用',
		markdownFile: 'Markdown 檔案', frontmatterExists: '存在 frontmatter', startConfigured: '已設定開始日期屬性', containsStart: '筆記包含開始日期屬性',
		startParse: '開始日期可解析', endParse: '結束日期可解析', folderGroup: '資料夾群組', tagGroup: '標籤群組', wikiLinkGroup: 'Wiki Link 群組',
		finalMatch: '最終比對', startOnlyActive: '僅開始日期屬性模式生效', calendarDiagnostics: '日曆診斷', noDiagnostics: '沒有日曆診斷。',
		copySupportSummary: '複製支援摘要', supportSummaryCopied: '已複製支援摘要。', indexNotInitialized: '尚未初始化', indexInitializing: '初始化中…',
		indexReady: '就緒', saving: '儲存中…', saved: '已儲存', saveFailed: '儲存失敗', enabled: '已啟用', disabled: '已停用', enable: '啟用',
		disable: '停用', edit: '編輯', duplicate: '複製', moveUp: '上移', moveDown: '下移', delete: '刪除', createFirstProfile: '建立第一個來源設定檔',
		dailyNoteAction: '開啟或建立 {date} 的每日筆記', dailyNoteIndicator: '{date} 已有每日筆記', monthChanged: '目前顯示 {month}',
		quickStatus: '快速狀態', calendarBehavior: '日曆行為', dateAndTime: '日期與時間', sourceProfiles: '來源設定檔', eventTypeRules: '事件類型規則',
		overview: '概覽', sourceMatching: '來源比對', propertyMapping: '屬性對應', displayDefaults: '顯示預設值', eventCreation: '事件建立', actions: '操作',
		calendarLanguage: '外掛語言', firstDayOfWeek: '每週第一天', weekendDays: '週末日期', timeZone: '時區', displayDateFormat: '顯示日期格式',
		propertyDateFormat: '事件屬性日期格式', confirmDailyCreation: '建立每日筆記前確認', maximumIndicators: '每個日期最多顯示的指示器',
		enabledProfiles: '已啟用設定檔', indexedEvents: '索引事件', indexStatus: '索引狀態', settingsSaveStatus: '設定儲存狀態',
		openDiagnostics: '開啟診斷', refreshIndex: '重新整理索引', calendarStatus: '日曆狀態', addSourceProfile: '新增來源設定檔', addTypeRule: '新增類型規則',
	},
	'zh-CN': {
		sidebarSide: '侧边栏打开位置', sidebarLeft: '左侧边栏', sidebarRight: '右侧边栏',
		sidebarSideDescription: '下次打开侧边栏日历时应用；若日历已在另一侧打开，将移至所选位置。',
		previousMonth: '上个月', nextMonth: '下个月', today: '今天', refreshCalendar: '刷新日历',
		calendarYear: '日历年份', calendarMonth: '日历月份', createEventOn: '在 {date} 创建事件',
		dailyNoteExists: '已有日记', refreshFailed: '无法刷新日历索引。',
		openDailyNote: '打开日记', createDailyNote: '创建日记', createEvent: '创建事件',
		eventsOnDate: '这一天的事件', noEvents: '没有事件', openNote: '打开笔记', openInNewTab: '在新标签页打开',
		copyObsidianLink: '复制 Obsidian 链接', copiedObsidianLink: '已复制 Obsidian 链接。', more: '另有 {count} 个',
		moreEventsOn: '{date} 另有 {count} 个事件', chooseStartProperty: '请在视图选项中选择开始日期属性。',
		invalidStartProperty: '所选开始日期属性无法在此 Base 中使用。', baseQueryEmpty: '当前 Base 查询没有条目。',
		baseDatesEmpty: 'Base 条目中没有有效的日历日期。', monthEventsEmpty: '这个月没有事件。',
		skippedInvalidEntries: '有 {count} 个条目因日期无效而被跳过。', viewSkippedEntries: '查看跳过的条目',
		agendaTitle: '{date} · {count} 个事件', openAgenda: '查看 {date} 的事件', selectedDate: '已选择日期：{date}',
		eventTypeLabel: '类型', visiblePropertiesLabel: '属性', baseCreateTitle: '创建 Base 事件', eventTitleLabel: '标题',
		startDateLabel: '开始日期', endDateLabel: '结束日期', eventTypeOptional: '事件类型（可选）', cancel: '取消', create: '创建',
		baseStartNotWritable: '开始日期属性不是可写入的笔记属性，因此无法创建事件。', baseCreateFailed: '无法创建 Base 事件。',
		invalidStart: '开始日期无效', invalidEnd: '结束日期无效', endBeforeStart: '结束日期早于开始日期', unreadableValue: '无法读取属性值',
	},
	ja: {
		sidebarSide: 'サイドバーの表示位置', sidebarLeft: '左サイドバー', sidebarRight: '右サイドバー',
		sidebarSideDescription: '次にカレンダーを開くときに適用します。反対側に開いている場合は、選択した側に移動します。',
		previousMonth: '前の月', nextMonth: '次の月', today: '今日', refreshCalendar: 'カレンダーを更新',
		calendarYear: 'カレンダーの年', calendarMonth: 'カレンダーの月', createEventOn: '{date} にイベントを作成',
		dailyNoteExists: 'デイリーノートがあります', refreshFailed: 'カレンダー索引を更新できませんでした。',
		openDailyNote: 'デイリーノートを開く', createDailyNote: 'デイリーノートを作成', createEvent: 'イベントを作成',
		eventsOnDate: 'この日のイベント', noEvents: 'イベントなし', openNote: 'ノートを開く', openInNewTab: '新しいタブで開く',
		copyObsidianLink: 'Obsidian リンクをコピー', copiedObsidianLink: 'Obsidian リンクをコピーしました。', more: '他 {count} 件',
		moreEventsOn: '{date} に他 {count} 件のイベント', chooseStartProperty: 'ビューオプションで開始日プロパティを選択してください。',
		invalidStartProperty: '選択した開始日プロパティはこの Base で利用できません。', baseQueryEmpty: '現在の Base クエリにエントリがありません。',
		baseDatesEmpty: '有効なカレンダー日付を持つ Base エントリがありません。', monthEventsEmpty: 'この月にイベントはありません。',
		skippedInvalidEntries: '日付が無効なため {count} 件のエントリをスキップしました。', viewSkippedEntries: 'スキップしたエントリを表示',
		agendaTitle: '{date} · {count} 件のイベント', openAgenda: '{date} のイベントを表示', selectedDate: '選択日: {date}',
		eventTypeLabel: '種類', visiblePropertiesLabel: 'プロパティ', baseCreateTitle: 'Base イベントを作成', eventTitleLabel: 'タイトル',
		startDateLabel: '開始日', endDateLabel: '終了日', eventTypeOptional: 'イベント種類（任意）', cancel: 'キャンセル', create: '作成',
		baseStartNotWritable: '開始日が書き込み可能なノートプロパティではないため、イベントを作成できません。', baseCreateFailed: 'Base イベントを作成できませんでした。',
		invalidStart: '開始日が無効です', invalidEnd: '終了日が無効です', endBeforeStart: '終了日が開始日より前です', unreadableValue: 'プロパティ値を読み取れません',
	},
	ko: {
		sidebarSide: '사이드바 열기 위치', sidebarLeft: '왼쪽 사이드바', sidebarRight: '오른쪽 사이드바',
		sidebarSideDescription: '다음에 달력을 열 때 적용됩니다. 반대쪽에 열려 있는 달력은 선택한 쪽으로 이동합니다.',
		previousMonth: '이전 달', nextMonth: '다음 달', today: '오늘', refreshCalendar: '달력 새로고침',
		calendarYear: '달력 연도', calendarMonth: '달력 월', createEventOn: '{date}에 이벤트 만들기',
		dailyNoteExists: '데일리 노트가 있습니다', refreshFailed: '달력 색인을 새로고칠 수 없습니다.',
		openDailyNote: '데일리 노트 열기', createDailyNote: '데일리 노트 만들기', createEvent: '이벤트 만들기',
		eventsOnDate: '이 날짜의 이벤트', noEvents: '이벤트 없음', openNote: '노트 열기', openInNewTab: '새 탭에서 열기',
		copyObsidianLink: 'Obsidian 링크 복사', copiedObsidianLink: 'Obsidian 링크를 복사했습니다.', more: '{count}개 더 보기',
		moreEventsOn: '{date}에 이벤트 {count}개 더 있음', chooseStartProperty: '보기 옵션에서 시작 날짜 속성을 선택하세요.',
		invalidStartProperty: '선택한 시작 날짜 속성을 이 Base에서 사용할 수 없습니다.', baseQueryEmpty: '현재 Base 쿼리에 항목이 없습니다.',
		baseDatesEmpty: '유효한 달력 날짜가 있는 Base 항목이 없습니다.', monthEventsEmpty: '이번 달에는 이벤트가 없습니다.',
		skippedInvalidEntries: '날짜가 잘못되어 {count}개 항목을 건너뛰었습니다.', viewSkippedEntries: '건너뛴 항목 보기',
		agendaTitle: '{date} · 이벤트 {count}개', openAgenda: '{date}의 이벤트 보기', selectedDate: '선택한 날짜: {date}',
		eventTypeLabel: '유형', visiblePropertiesLabel: '속성', baseCreateTitle: 'Base 이벤트 만들기', eventTitleLabel: '제목',
		startDateLabel: '시작 날짜', endDateLabel: '종료 날짜', eventTypeOptional: '이벤트 유형(선택 사항)', cancel: '취소', create: '만들기',
		baseStartNotWritable: '시작 날짜가 쓰기 가능한 노트 속성이 아니므로 이벤트를 만들 수 없습니다.', baseCreateFailed: 'Base 이벤트를 만들 수 없습니다.',
		invalidStart: '시작 날짜가 잘못되었습니다', invalidEnd: '종료 날짜가 잘못되었습니다', endBeforeStart: '종료 날짜가 시작 날짜보다 빠릅니다', unreadableValue: '속성 값을 읽을 수 없습니다',
	},
};

const TRANSLATIONS: Record<Exclude<CalendarLocale, 'system' | 'en'>, Record<CalendarTextKey, string>> = {
	'zh-TW': { ...ENGLISH, ...TRANSLATION_OVERRIDES['zh-TW'] },
	'zh-CN': { ...ENGLISH, ...TRANSLATION_OVERRIDES['zh-CN'] },
	ja: { ...ENGLISH, ...TRANSLATION_OVERRIDES.ja },
	ko: { ...ENGLISH, ...TRANSLATION_OVERRIDES.ko },
};

export const CALENDAR_TEXT_KEYS = Object.freeze(Object.keys(ENGLISH) as CalendarTextKey[]);

export function calendarText(
	locale: CalendarLocale,
	key: CalendarTextKey,
	values: Record<string, string | number> = {},
	systemLocale = obsidianLocale,
): string {
	const language = translationLocale(locale, systemLocale);
	const template = language === 'en' ? ENGLISH[key] : TRANSLATIONS[language][key];
	return template.replace(/\{([^}]+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}

export function calendarMonthLabels(locale: CalendarLocale, systemLocale = obsidianLocale): string[] {
	const formatter = new Intl.DateTimeFormat(intlLocale(locale, systemLocale), { month: 'short', timeZone: 'UTC' });
	return Array.from({ length: 12 }, (_value, month) => formatter.format(new Date(Date.UTC(2026, month, 1))));
}

export function calendarWeekdayLabels(locale: CalendarLocale, systemLocale = obsidianLocale): string[] {
	const formatter = new Intl.DateTimeFormat(intlLocale(locale, systemLocale), { weekday: 'short', timeZone: 'UTC' });
	return Array.from({ length: 7 }, (_value, weekday) => formatter.format(new Date(Date.UTC(2023, 0, 1 + weekday))));
}

function intlLocale(locale: CalendarLocale, systemLocale: string): string {
	return locale === 'system' ? systemLocale : locale;
}

function translationLocale(locale: CalendarLocale, systemLocale: string): Exclude<CalendarLocale, 'system'> {
	if (locale !== 'system') return locale;
	const normalized = systemLocale.toLowerCase();
	if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hant')) return 'zh-TW';
	if (normalized.startsWith('zh')) return 'zh-CN';
	if (normalized.startsWith('ja')) return 'ja';
	if (normalized.startsWith('ko')) return 'ko';
	return 'en';
}
