export type CommitInputValue = (value: string) => void | Promise<void>;

export interface SuggestionReplacement {
	value: string;
	cursor: number;
}

export interface FloatingSuggestionLayout {
	left: number;
	width: number;
	maxHeight: number;
	top?: number;
	bottom?: number;
}

/**
 * Apply a suggestion to the actual input and persist the same value directly.
 * The settings callback is the reliable persistence boundary; do not depend on
 * AbstractInputSuggest#setValue or a synthetic DOM event to reach it.
 */
export function commitInputSuggestion(
	input: HTMLInputElement | HTMLTextAreaElement,
	value: string,
	commit: CommitInputValue,
	cursor = value.length,
): void {
	input.value = value;
	if (typeof input.setSelectionRange === 'function') input.setSelectionRange(cursor, cursor);
	void commit(value);
}

export function getDelimitedQuery(inputValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf(',', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf(',', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return inputValue.slice(start, end).trim();
}

export function replaceDelimitedInputValue(inputValue: string, selectedValue: string, cursor: number): string {
	return replaceDelimitedInputSelection(inputValue, selectedValue, cursor).value;
}

export function replaceDelimitedInputSelection(
	inputValue: string,
	selectedValue: string,
	cursor: number,
): SuggestionReplacement {
	const start = inputValue.lastIndexOf(',', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf(',', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	const before = inputValue.slice(0, start).trimEnd();
	const after = inputValue.slice(end).trimStart();
	const prefix = `${before}${before ? ' ' : ''}`;
	return {
		value: `${prefix}${selectedValue}${after ? `, ${after.replace(/^,\s*/, '')}` : ''}`,
		cursor: prefix.length + selectedValue.length,
	};
}

export function getLineQuery(inputValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf('\n', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return inputValue.slice(start, end).trim();
}

export function replaceLineInputSelection(
	inputValue: string,
	selectedValue: string,
	cursor: number,
): SuggestionReplacement {
	const start = inputValue.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf('\n', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return {
		value: `${inputValue.slice(0, start)}${selectedValue}${inputValue.slice(end)}`,
		cursor: start + selectedValue.length,
	};
}

export function getFloatingSuggestionLayout(
	bounds: Pick<DOMRect, 'left' | 'top' | 'bottom' | 'width'>,
	viewportWidth: number,
	viewportHeight: number,
): FloatingSuggestionLayout {
	const gap = 4;
	const width = Math.min(Math.max(bounds.width, 240), Math.max(0, viewportWidth - gap * 2));
	const left = Math.min(Math.max(gap, bounds.left), Math.max(gap, viewportWidth - width - gap));
	const below = viewportHeight - bounds.bottom - gap;
	const above = bounds.top - gap;
	const openAbove = below < 120 && above > below;
	const maxHeight = Math.min(192, Math.max(48, openAbove ? above : below));
	return openAbove
		? { left, width, maxHeight, bottom: viewportHeight - bounds.top + gap }
		: { left, width, maxHeight, top: bounds.bottom + gap };
}
