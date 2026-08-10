import { ConfirmationModal, type App, moment, Notice, type TFile } from 'obsidian';
import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote,
} from 'obsidian-daily-notes-interface';
import { isCanonicalDate } from './date';

export class DailyNoteService {
	constructor(private readonly app: App, private readonly confirmBeforeCreate: () => boolean) {}

	getAll(): Record<string, TFile> {
		try {
			return getAllDailyNotes();
		} catch {
			return {};
		}
	}

	find(date: string, dailyNotes = this.getAll()): TFile | undefined {
		const value = this.toMoment(date);
		return getDailyNote(value, dailyNotes);
	}

	async open(date: string): Promise<TFile | undefined> {
		if (!appHasDailyNotesPluginLoaded()) {
			new Notice('Enable the daily notes core plugin to use this action.');
			return undefined;
		}
		const existing = this.find(date);
		if (existing) {
			await this.app.workspace.getLeaf(false).openFile(existing);
			return existing;
		}
		if (this.confirmBeforeCreate() && !await this.confirm(date)) return undefined;
		const created = await createDailyNote(this.toMoment(date));
		if (created) await this.app.workspace.getLeaf(false).openFile(created);
		return created;
	}

	private toMoment(date: string): moment.Moment {
		if (!isCanonicalDate(date)) throw new TypeError('Expected a canonical calendar date.');
		const parsed: unknown = moment(date, 'YYYY-MM-DD', true);
		if (!moment.isMoment(parsed)) throw new TypeError('Failed to parse the daily note date.');
		return parsed;
	}

	private confirm(date: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmationModal(this.app)
				.setTitle('Create daily note?')
				.setContent(`No daily note exists for ${date}.`)
				.addButton((button) => button
					.setButtonText('Create')
					.setCta()
					.setInitialFocus()
					.onClick(() => resolve(true)))
				.addCancelButton();
			modal.onClose = () => resolve(false);
			modal.open();
		});
	}
}
