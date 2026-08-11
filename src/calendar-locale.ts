import type { CalendarLocale } from './models';

export const CALENDAR_LOCALE_OPTIONS: Record<CalendarLocale, string> = {
	system: 'System default',
	en: 'English',
	'zh-TW': '繁體中文',
	'zh-CN': '简体中文',
	ja: '日本語',
	ko: '한국어',
};

export type CalendarTextKey =
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
	| 'invalidStart' | 'invalidEnd' | 'endBeforeStart' | 'unreadableValue';

const ENGLISH: Record<CalendarTextKey, string> = {
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
};

const TRANSLATIONS: Partial<Record<Exclude<CalendarLocale, 'system' | 'en'>, Record<CalendarTextKey, string>>> = {
	'zh-TW': {
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
	},
	'zh-CN': {
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

export function calendarText(
	locale: CalendarLocale,
	key: CalendarTextKey,
	values: Record<string, string | number> = {},
	systemLocale = getSystemLocale(),
): string {
	const language = translationLocale(locale, systemLocale);
	const template = language === 'en' ? ENGLISH[key] : TRANSLATIONS[language]?.[key] ?? ENGLISH[key];
	return template.replace(/\{([^}]+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}

export function calendarMonthLabels(locale: CalendarLocale, systemLocale = getSystemLocale()): string[] {
	const formatter = new Intl.DateTimeFormat(intlLocale(locale, systemLocale), { month: 'short', timeZone: 'UTC' });
	return Array.from({ length: 12 }, (_value, month) => formatter.format(new Date(Date.UTC(2026, month, 1))));
}

export function calendarWeekdayLabels(locale: CalendarLocale, systemLocale = getSystemLocale()): string[] {
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

function getSystemLocale(): string {
	return typeof navigator === 'undefined' || !navigator.language ? 'en' : navigator.language;
}
