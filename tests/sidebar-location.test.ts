import { describe, expect, it, vi } from 'vitest';
import type { Workspace } from 'obsidian';
import { openCalendarSidebar } from '../src/sidebar-location';
import { loadCalendarSettings } from '../src/settings-data';
import { calendarText } from '../src/calendar-locale';

const viewType = 'calendar-note-sidebar';

function fixture() {
	const left = {};
	const right = {};
	const leaf = (root: object) => ({
		getRoot: () => root,
		getViewState: () => ({ type: viewType, state: { selectedDate: '2026-10-13' } }),
		setViewState: vi.fn(async (_state: unknown) => {}),
		detach: vi.fn(),
	});
	const leftLeaf = leaf(left);
	const rightLeaf = leaf(right);
	const leaves: ReturnType<typeof leaf>[] = [];
	const workspace = {
		leftSplit: left, rightSplit: right,
		getLeavesOfType: vi.fn(() => leaves),
		getLeftLeaf: vi.fn(() => leftLeaf),
		getRightLeaf: vi.fn(() => rightLeaf),
		revealLeaf: vi.fn(async (_leaf: unknown) => {}),
	};
	return { workspace, leftLeaf, rightLeaf, leaves };
}

describe('Sidebar opening location', () => {
	it.each(['left', 'right'] as const)('opens a new Calendar in the %s sidedock', async (side) => {
		const f = fixture();
		const result = await openCalendarSidebar(f.workspace as unknown as Workspace, side, viewType);
		const target = side === 'left' ? f.leftLeaf : f.rightLeaf;
		expect(result).toBe(target);
		expect(target.setViewState).toHaveBeenCalledWith({ type: viewType, active: true });
		expect(f.workspace.revealLeaf).toHaveBeenCalledWith(target);
		expect(side === 'left' ? f.workspace.getRightLeaf : f.workspace.getLeftLeaf).not.toHaveBeenCalled();
	});

	it.each(['left', 'right'] as const)('reuses an existing Calendar in the %s sidedock', async (side) => {
		const f = fixture();
		const target = side === 'left' ? f.leftLeaf : f.rightLeaf;
		f.leaves.push(target);
		expect(await openCalendarSidebar(f.workspace as unknown as Workspace, side, viewType)).toBe(target);
		expect(target.setViewState).not.toHaveBeenCalled();
		expect(target.detach).not.toHaveBeenCalled();
		expect(f.workspace.getLeftLeaf).not.toHaveBeenCalled();
		expect(f.workspace.getRightLeaf).not.toHaveBeenCalled();
	});

	it.each(['left', 'right'] as const)('moves an existing Calendar to the %s sidedock after opening succeeds', async (side) => {
		const f = fixture();
		const target = side === 'left' ? f.leftLeaf : f.rightLeaf;
		const previous = side === 'left' ? f.rightLeaf : f.leftLeaf;
		f.leaves.push(previous);
		expect(await openCalendarSidebar(f.workspace as unknown as Workspace, side, viewType)).toBe(target);
		expect(target.setViewState).toHaveBeenCalledWith({ ...previous.getViewState(), active: true });
		expect(previous.detach).toHaveBeenCalledOnce();
		expect(target.setViewState.mock.invocationCallOrder[0]).toBeLessThan(previous.detach.mock.invocationCallOrder[0]!);
		expect(f.workspace.revealLeaf).toHaveBeenCalledWith(target);
	});

	it('keeps the previous view if the destination cannot be obtained', async () => {
		const f = fixture();
		f.leaves.push(f.rightLeaf);
		f.workspace.getLeftLeaf.mockReturnValue(null as unknown as typeof f.leftLeaf);
		expect(await openCalendarSidebar(f.workspace as unknown as Workspace, 'left', viewType)).toBeNull();
		expect(f.rightLeaf.detach).not.toHaveBeenCalled();
		expect(f.workspace.revealLeaf).not.toHaveBeenCalled();
	});

	it('keeps the previous view if opening the destination fails', async () => {
		const f = fixture();
		f.leaves.push(f.rightLeaf);
		f.leftLeaf.setViewState.mockRejectedValue(new Error('Open failed'));
		await expect(openCalendarSidebar(f.workspace as unknown as Workspace, 'left', viewType)).rejects.toThrow('Open failed');
		expect(f.rightLeaf.detach).not.toHaveBeenCalled();
	});

	it('defaults old and invalid settings to right and preserves a saved left preference', () => {
		expect(loadCalendarSettings({ schemaVersion: 9 }).settings.sidebarSide).toBe('right');
		expect(loadCalendarSettings({ sidebarSide: 'invalid' }).settings.sidebarSide).toBe('right');
		const loaded = loadCalendarSettings({ sidebarSide: 'left' }).settings;
		expect(loadCalendarSettings(JSON.parse(JSON.stringify(loaded))).settings.sidebarSide).toBe('left');
	});

	it('localizes the location setting in Traditional Chinese', () => {
		expect(calendarText('zh-TW', 'sidebarSide')).toBe('側邊欄開啟位置');
		expect(calendarText('zh-TW', 'sidebarLeft')).toBe('左側邊欄');
		expect(calendarText('zh-TW', 'sidebarRight')).toBe('右側邊欄');
	});
});
