import type { Workspace, WorkspaceLeaf } from 'obsidian';
import type { CalendarSettings } from './models';

/** Reuse the chosen sidedock, or open there before closing the previous view. */
export async function openCalendarSidebar(
	workspace: Workspace,
	side: CalendarSettings['sidebarSide'],
	viewType: string,
): Promise<WorkspaceLeaf | null> {
	const leaves = workspace.getLeavesOfType(viewType);
	const root = side === 'left' ? workspace.leftSplit : workspace.rightSplit;
	let leaf = leaves.find((candidate) => candidate.getRoot() === root);
	if (!leaf) {
		const previous = leaves[0];
		const target = side === 'left' ? workspace.getLeftLeaf(false) : workspace.getRightLeaf(false);
		if (!target) return null;
		await target.setViewState({
			...(previous?.getViewState() ?? {}),
			type: viewType,
			active: true,
		});
		if (previous !== target) previous?.detach();
		leaf = target;
	}
	await workspace.revealLeaf(leaf);
	return leaf;
}
