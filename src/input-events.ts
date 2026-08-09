export type CommitInputValue = (value: string) => void | Promise<void>;

/**
 * Apply a suggestion to the actual input and persist the same value directly.
 * The settings callback is the reliable persistence boundary; do not depend on
 * AbstractInputSuggest#setValue or a synthetic DOM event to reach it.
 */
export function commitInputSuggestion(
	input: HTMLInputElement,
	value: string,
	commit: CommitInputValue,
): void {
	input.value = value;
	void commit(value);
}

export function getDelimitedQuery(inputValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf(',', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf(',', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	return inputValue.slice(start, end).trim();
}

export function replaceDelimitedInputValue(inputValue: string, selectedValue: string, cursor: number): string {
	const start = inputValue.lastIndexOf(',', Math.max(0, cursor - 1)) + 1;
	const endIndex = inputValue.indexOf(',', cursor);
	const end = endIndex < 0 ? inputValue.length : endIndex;
	const before = inputValue.slice(0, start).trimEnd();
	const after = inputValue.slice(end).trimStart();
	return `${before}${before ? ' ' : ''}${selectedValue}${after ? `, ${after.replace(/^,\s*/, '')}` : ''}`;
}
