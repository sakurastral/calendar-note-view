import type { App, EventRef, TAbstractFile, TFile } from 'obsidian';
import { sortCalendarItems } from './calendar-sort';
import { isCanonicalDate } from './date';
import { createDiagnostic, CalendarDiagnosticsService } from './diagnostics';
import { hasSourceConditions, matchesSourceProfile } from './matcher';
import type {
	CalendarFileData,
	CalendarItem,
	CalendarMetadata,
	CalendarSettings,
	CalendarSourceProfile,
} from './models';
import { CalendarItemNormalizer } from './normalizer';

export type CalendarIndexChangeReason =
	| 'initialize'
	| 'rebuild'
	| 'file-create'
	| 'file-change'
	| 'file-delete'
	| 'file-rename'
	| 'settings-change';

export interface CalendarIndexChange {
	reason: CalendarIndexChangeReason;
	filePaths?: string[];
}

type CalendarIndexSubscriber = (change: CalendarIndexChange) => void;

interface PendingReindex {
	timer: number;
	file: TFile;
	reason: 'file-create' | 'file-change';
}

export class CalendarIndexService {
	private readonly itemsById = new Map<string, CalendarItem>();
	private readonly itemIdsByFile = new Map<string, Set<string>>();
	private readonly itemIdsByProfile = new Map<string, Set<string>>();
	private readonly subscribers = new Set<CalendarIndexSubscriber>();
	private readonly refs: Array<{ owner: 'vault' | 'metadata'; ref: EventRef }> = [];
	private readonly pending = new Map<string, PendingReindex>();
	private initialized = false;

	constructor(
		private readonly app: App,
		private readonly getSettings: () => CalendarSettings,
		readonly diagnostics: CalendarDiagnosticsService,
		private readonly normalizer = new CalendarItemNormalizer(),
		private readonly debounceMilliseconds = 180,
	) {}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		this.bindEvents();
		await this.rebuildInternal('initialize');
	}

	dispose(): void {
		for (const { owner, ref } of this.refs) {
			if (owner === 'vault') this.app.vault.offref(ref);
			else this.app.metadataCache.offref(ref);
		}
		this.refs.length = 0;
		for (const pending of this.pending.values()) window.clearTimeout(pending.timer);
		this.pending.clear();
		this.subscribers.clear();
		this.initialized = false;
	}

	async rebuild(): Promise<void> {
		await this.rebuildInternal('rebuild');
	}

	async refresh(): Promise<void> {
		await this.rebuildInternal('rebuild');
	}

	async reindexFile(
		file: TFile,
		reason: 'file-create' | 'file-change' | 'file-rename' = 'file-change',
		notify = true,
	): Promise<void> {
		this.removeFileData(file.path);
		const metadata = this.app.metadataCache.getFileCache(file) as CalendarMetadata | null;
		if (metadata) this.indexFile(toFileData(file), metadata, this.getSettings().sourceProfiles);
		if (notify) this.notify({ reason, filePaths: [file.path] });
	}

	removeFile(filePath: string, notify = true): void {
		this.cancelPending(filePath);
		this.removeFileData(filePath);
		if (notify) this.notify({ reason: 'file-delete', filePaths: [filePath] });
	}

	async renameFile(file: TFile, oldPath: string): Promise<void> {
		this.cancelPending(oldPath);
		this.cancelPending(file.path);
		this.removeFileData(oldPath);
		await this.reindexFile(file, 'file-rename', false);
		this.notify({ reason: 'file-rename', filePaths: [oldPath, file.path] });
	}

	async handleSettingsChanged(previous: CalendarSettings, next: CalendarSettings): Promise<void> {
		const indexChanged = JSON.stringify(previous.sourceProfiles) !== JSON.stringify(next.sourceProfiles) ||
			JSON.stringify(previous.typeStyleRules) !== JSON.stringify(next.typeStyleRules) ||
			previous.eventPropertyDateFormat !== next.eventPropertyDateFormat;
		if (indexChanged) await this.rebuildInternal('settings-change');
	}

	getAllItems(): CalendarItem[] {
		return this.sortItems(this.itemsById.values());
	}

	getItemsForDate(date: string): CalendarItem[] {
		return this.getItemsInRange(date, date);
	}

	getItemsInRange(startDate: string, endDate: string): CalendarItem[] {
		if (!isCanonicalDate(startDate) || !isCanonicalDate(endDate) || startDate > endDate) {
			throw new TypeError('Expected a valid canonical date range.');
		}
		return this.sortItems([...this.itemsById.values()].filter((item) =>
			item.startDate <= endDate && item.endDate >= startDate));
	}

	subscribe(subscriber: CalendarIndexSubscriber): () => void {
		this.subscribers.add(subscriber);
		return () => this.subscribers.delete(subscriber);
	}

	private async rebuildInternal(reason: 'initialize' | 'rebuild' | 'settings-change'): Promise<void> {
		for (const pending of this.pending.values()) window.clearTimeout(pending.timer);
		this.pending.clear();
		this.itemsById.clear();
		this.itemIdsByFile.clear();
		this.itemIdsByProfile.clear();
		this.diagnostics.clear();
		const settings = this.getSettings();
		for (const profile of settings.sourceProfiles) this.addProfileDiagnostic(profile);
		for (const file of this.app.vault.getMarkdownFiles()) {
			const metadata = this.app.metadataCache.getFileCache(file) as CalendarMetadata | null;
			if (metadata) this.indexFile(toFileData(file), metadata, settings.sourceProfiles);
		}
		this.notify({ reason });
		await Promise.resolve();
	}

	private indexFile(file: CalendarFileData, metadata: CalendarMetadata, profiles: CalendarSourceProfile[]): void {
		for (const profile of profiles) {
			if (!matchesSourceProfile(file, metadata, profile)) continue;
			const result = this.normalizer.normalize(file, metadata, profile, this.getSettings().eventPropertyDateFormat);
			this.diagnostics.replaceForFileAndProfile(file.path, profile.id, result.diagnostics);
			if (result.item) this.addItem(result.item);
		}
	}

	private addProfileDiagnostic(profile: CalendarSourceProfile): void {
		if (profile.enabled && !profile.startProperty.trim()) {
			this.diagnostics.replaceForFileAndProfile('', profile.id, [createDiagnostic({
				code: 'missing-start-property',
				severity: 'warning',
				message: 'Choose a start property before enabling this source profile.',
				filePath: '',
				sourceProfileId: profile.id,
			})]);
			return;
		}
		if (!profile.enabled || hasSourceConditions(profile) || profile.matchFilesWithStartPropertyOnly) return;
		this.diagnostics.replaceForFileAndProfile('', profile.id, [createDiagnostic({
			code: 'empty-source-profile',
			severity: 'warning',
			message: 'This source profile has no matching conditions and will not scan the vault.',
			filePath: '',
			sourceProfileId: profile.id,
		})]);
	}

	private addItem(item: CalendarItem): void {
		this.itemsById.set(item.id, item);
		getOrCreateSet(this.itemIdsByFile, item.filePath).add(item.id);
		if (item.sourceProfileId) getOrCreateSet(this.itemIdsByProfile, item.sourceProfileId).add(item.id);
	}

	private removeFileData(filePath: string): void {
		const ids = this.itemIdsByFile.get(filePath);
		for (const id of ids ?? []) {
			const item = this.itemsById.get(id);
			if (item?.sourceProfileId) {
				const profileIds = this.itemIdsByProfile.get(item.sourceProfileId);
				profileIds?.delete(id);
				if (profileIds?.size === 0) this.itemIdsByProfile.delete(item.sourceProfileId);
			}
			this.itemsById.delete(id);
		}
		this.itemIdsByFile.delete(filePath);
		this.diagnostics.removeForFile(filePath);
	}

	private bindEvents(): void {
		this.refs.push(
			{ owner: 'metadata', ref: this.app.metadataCache.on('changed', (file) => this.schedule(file, 'file-change')) },
			{ owner: 'vault', ref: this.app.vault.on('create', (file) => this.scheduleAbstract(file, 'file-create')) },
			{ owner: 'vault', ref: this.app.vault.on('delete', (file) => this.removeFile(file.path)) },
			{ owner: 'vault', ref: this.app.vault.on('rename', (file, oldPath) => this.renameAbstract(file, oldPath)) },
		);
	}

	private scheduleAbstract(file: TAbstractFile, reason: 'file-create' | 'file-change'): void {
		if (isMarkdownFile(file)) this.schedule(file, reason);
	}

	private renameAbstract(file: TAbstractFile, oldPath: string): void {
		if (isMarkdownFile(file)) void this.renameFile(file, oldPath);
		else this.removeFile(oldPath);
	}

	private schedule(file: TFile, reason: 'file-create' | 'file-change'): void {
		this.cancelPending(file.path);
		const timer = window.setTimeout(() => {
			this.pending.delete(file.path);
			void this.reindexFile(file, reason);
		}, this.debounceMilliseconds);
		this.pending.set(file.path, { timer, file, reason });
	}

	private cancelPending(filePath: string): void {
		const pending = this.pending.get(filePath);
		if (pending) window.clearTimeout(pending.timer);
		this.pending.delete(filePath);
	}

	private sortItems(values: Iterable<CalendarItem>): CalendarItem[] {
		return sortCalendarItems(values, this.getSettings().sourceProfiles.map((profile) => profile.id));
	}

	private notify(change: CalendarIndexChange): void {
		for (const subscriber of this.subscribers) subscriber(change);
	}
}

function getOrCreateSet(map: Map<string, Set<string>>, key: string): Set<string> {
	const existing = map.get(key);
	if (existing) return existing;
	const created = new Set<string>();
	map.set(key, created);
	return created;
}

function isMarkdownFile(file: TAbstractFile): file is TFile {
	const candidate = file as TAbstractFile & { extension?: unknown };
	return typeof candidate.extension === 'string' && candidate.extension.toLowerCase() === 'md';
}

function toFileData(file: TFile): CalendarFileData {
	return { path: file.path, basename: file.basename, extension: file.extension };
}
