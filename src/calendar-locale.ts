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
	| 'chooseStartProperty';

const ENGLISH: Record<CalendarTextKey, string> = {
	previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today', refreshCalendar: 'Refresh calendar',
	calendarYear: 'Calendar year', calendarMonth: 'Calendar month', createEventOn: 'Create event on {date}',
	dailyNoteExists: 'Daily note exists', refreshFailed: 'Could not refresh the calendar index.',
	openDailyNote: 'Open daily note', createDailyNote: 'Create daily note', createEvent: 'Create event',
	eventsOnDate: 'Events on this date', noEvents: 'No events', openNote: 'Open note', openInNewTab: 'Open in new tab',
	copyObsidianLink: 'Copy Obsidian link', copiedObsidianLink: 'Copied Obsidian link.', more: '+{count} more',
	moreEventsOn: '{count} more events on {date}', chooseStartProperty: 'Choose a start property in the view options.',
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
	},
	'zh-CN': {
		previousMonth: '上个月', nextMonth: '下个月', today: '今天', refreshCalendar: '刷新日历',
		calendarYear: '日历年份', calendarMonth: '日历月份', createEventOn: '在 {date} 创建事件',
		dailyNoteExists: '已有日记', refreshFailed: '无法刷新日历索引。',
		openDailyNote: '打开日记', createDailyNote: '创建日记', createEvent: '创建事件',
		eventsOnDate: '这一天的事件', noEvents: '没有事件', openNote: '打开笔记', openInNewTab: '在新标签页打开',
		copyObsidianLink: '复制 Obsidian 链接', copiedObsidianLink: '已复制 Obsidian 链接。', more: '另有 {count} 个',
		moreEventsOn: '{date} 另有 {count} 个事件', chooseStartProperty: '请在视图选项中选择开始日期属性。',
	},
	ja: {
		previousMonth: '前の月', nextMonth: '次の月', today: '今日', refreshCalendar: 'カレンダーを更新',
		calendarYear: 'カレンダーの年', calendarMonth: 'カレンダーの月', createEventOn: '{date} にイベントを作成',
		dailyNoteExists: 'デイリーノートがあります', refreshFailed: 'カレンダー索引を更新できませんでした。',
		openDailyNote: 'デイリーノートを開く', createDailyNote: 'デイリーノートを作成', createEvent: 'イベントを作成',
		eventsOnDate: 'この日のイベント', noEvents: 'イベントなし', openNote: 'ノートを開く', openInNewTab: '新しいタブで開く',
		copyObsidianLink: 'Obsidian リンクをコピー', copiedObsidianLink: 'Obsidian リンクをコピーしました。', more: '他 {count} 件',
		moreEventsOn: '{date} に他 {count} 件のイベント', chooseStartProperty: 'ビューオプションで開始日プロパティを選択してください。',
	},
	ko: {
		previousMonth: '이전 달', nextMonth: '다음 달', today: '오늘', refreshCalendar: '달력 새로고침',
		calendarYear: '달력 연도', calendarMonth: '달력 월', createEventOn: '{date}에 이벤트 만들기',
		dailyNoteExists: '데일리 노트가 있습니다', refreshFailed: '달력 색인을 새로고칠 수 없습니다.',
		openDailyNote: '데일리 노트 열기', createDailyNote: '데일리 노트 만들기', createEvent: '이벤트 만들기',
		eventsOnDate: '이 날짜의 이벤트', noEvents: '이벤트 없음', openNote: '노트 열기', openInNewTab: '새 탭에서 열기',
		copyObsidianLink: 'Obsidian 링크 복사', copiedObsidianLink: 'Obsidian 링크를 복사했습니다.', more: '{count}개 더 보기',
		moreEventsOn: '{date}에 이벤트 {count}개 더 있음', chooseStartProperty: '보기 옵션에서 시작 날짜 속성을 선택하세요.',
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
