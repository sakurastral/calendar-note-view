import type { App, TFile } from 'obsidian';
import { formatCalendarDate, isCanonicalDate } from './date';
import type { CalendarIndexService } from './index-service';
import type { CalendarSettings, CalendarSourceProfile } from './models';
import {
	applyEventTemplate,
	getEventTemplatePreview,
	normalizeVaultPath,
	type EventTemplatePreview,
	type EventTemplateValues,
} from './event-template';
import { isSafeCssColor } from './value-normalizers';

export interface CreateEventInput {
	profileId: string;
	title: string;
	startDate: string;
	endDate?: string;
	type?: string;
	icon?: string;
	backgroundColor?: string;
	textColor?: string;
	collision?: 'append-number' | 'cancel';
}

export interface EventCreationResult {
	file?: TFile;
	status: 'created' | 'cancelled';
	path: string;
}

export class EventNoteCreationService {
	constructor(
		private readonly app: App,
		private readonly getSettings: () => CalendarSettings,
		private readonly index: CalendarIndexService,
	) {}

	preview(input: CreateEventInput): EventTemplatePreview {
		return getEventTemplatePreview(this.validate(input).values);
	}

	async create(input: CreateEventInput): Promise<EventCreationResult> {
		const validated = this.validate(input);
		const preview = getEventTemplatePreview(validated.values);
		const folder = preview.createFolder;
		await this.ensureFolder(folder);
		const desiredPath = folder ? `${folder}/${preview.fileName}` : preview.fileName;
		const path = this.resolveCollision(desiredPath, input.collision ?? 'append-number');
		if (!path) return { status: 'cancelled', path: desiredPath };

		const template = await this.loadTemplate(validated.profile.noteTemplatePath);
		const content = applyEventTemplate(template, validated.values);
		const file = await this.app.vault.create(path, content);
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			this.writeFrontmatter(frontmatter, validated.profile, validated, preview.generatedTitle);
		});
		await this.index.reindexFile(file, 'file-create');
		return { file, status: 'created', path };
	}

	private validate(input: CreateEventInput): ValidatedEventInput {
		const profile = this.getSettings().sourceProfiles.find((candidate) =>
			candidate.id === input.profileId && candidate.enabled && candidate.allowCreate);
		if (!profile) throw new Error('Choose a source profile that allows event creation.');
		const title = input.title.trim();
		if (!title) throw new Error('Event title is required.');
		if (!isCanonicalDate(input.startDate)) throw new Error('Start date must be a valid calendar date.');
		const endDate = input.endDate?.trim() || input.startDate;
		if (!isCanonicalDate(endDate)) throw new Error('End date must be a valid calendar date.');
		if (endDate < input.startDate) throw new Error('End date cannot be before the start date.');
		this.validateColor(input.backgroundColor, 'Background color');
		this.validateColor(input.textColor, 'Text color');
		return {
			profile,
			title,
			startDate: input.startDate,
			endDate,
			writeEndDate: Boolean(input.endDate?.trim()),
			values: { title, startDate: input.startDate, endDate, type: input.type, profile },
			input,
		};
	}

	private validateColor(value: string | undefined, label: string): void {
		if (value?.trim() && !isSafeCssColor(value)) throw new Error(`${label} is not a safe CSS color.`);
	}

	private async ensureFolder(path: string): Promise<void> {
		if (!path) return;
		const parts = path.split('/');
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
		}
	}

	private resolveCollision(path: string, mode: 'append-number' | 'cancel'): string | null {
		if (!this.app.vault.getAbstractFileByPath(path)) return path;
		if (mode === 'cancel') return null;
		const stem = path.replace(/\.md$/i, '');
		for (let number = 2; number < 10_000; number += 1) {
			const candidate = `${stem} ${number}.md`;
			if (!this.app.vault.getAbstractFileByPath(candidate)) return candidate;
		}
		throw new Error('Could not find an available event filename.');
	}

	private async loadTemplate(pathValue: string | undefined): Promise<string> {
		const path = normalizeVaultPath(pathValue ?? '');
		if (!path) return '';
		const normalized = path.toLowerCase().endsWith('.md') ? path : `${path}.md`;
		const file = this.app.vault.getFileByPath(normalized);
		if (!file) throw new Error(`Template not found: ${normalized}`);
		return this.app.vault.cachedRead(file);
	}

	private writeFrontmatter(
		frontmatter: Record<string, unknown>,
		profile: CalendarSourceProfile,
		validated: ValidatedEventInput,
		generatedTitle: string,
	): void {
		const storageFormat = this.getSettings().eventPropertyDateFormat;
		frontmatter[profile.startProperty] = formatCalendarDate(validated.startDate, storageFormat) ?? validated.startDate;
		if (profile.endProperty) {
			if (validated.writeEndDate) frontmatter[profile.endProperty] = formatCalendarDate(validated.endDate, storageFormat) ?? validated.endDate;
			else delete frontmatter[profile.endProperty];
		}
		this.writeOptional(frontmatter, profile.titleProperty, validated.title);
		this.writeOptional(frontmatter, profile.typeProperty, validated.input.type);
		this.writeOptional(frontmatter, profile.iconProperty, validated.input.icon);
		this.writeOptional(frontmatter, profile.colorProperty, validated.input.backgroundColor);
		this.writeOptional(frontmatter, profile.textColorProperty, validated.input.textColor);
		this.writeOptional(frontmatter, profile.generatedTitleProperty, generatedTitle);
	}

	private writeOptional(frontmatter: Record<string, unknown>, property: string | undefined, value: string | undefined): void {
		if (!property) return;
		const normalized = value?.trim();
		if (normalized) frontmatter[property] = normalized;
		else delete frontmatter[property];
	}
}

interface ValidatedEventInput {
	profile: CalendarSourceProfile;
	title: string;
	startDate: string;
	endDate: string;
	writeEndDate: boolean;
	values: EventTemplateValues;
	input: CreateEventInput;
}
