const EXTENDED_COLORS = [
	['var(--color-red)', 'Red'],
	['var(--color-orange)', 'Orange'],
	['var(--color-yellow)', 'Yellow'],
	['var(--color-green)', 'Green'],
	['var(--color-cyan)', 'Cyan'],
	['var(--color-blue)', 'Blue'],
	['var(--color-purple)', 'Purple'],
	['var(--color-pink)', 'Pink'],
] as const;

export const OBSIDIAN_BACKGROUND_COLOR_OPTIONS: Record<string, string> = Object.fromEntries([
	['var(--background-primary)', 'Primary background'],
	['var(--background-primary-alt)', 'Primary alternate background'],
	['var(--background-secondary)', 'Secondary background'],
	['var(--background-secondary-alt)', 'Secondary alternate background'],
	['var(--background-modifier-hover)', 'Hover background'],
	['var(--interactive-accent)', 'Interactive accent'],
	['var(--interactive-accent-hover)', 'Interactive accent hover'],
	...EXTENDED_COLORS,
]);

export const OBSIDIAN_TEXT_COLOR_OPTIONS: Record<string, string> = Object.fromEntries([
	['var(--text-normal)', 'Normal text'],
	['var(--text-muted)', 'Muted text'],
	['var(--text-faint)', 'Faint text'],
	['var(--text-accent)', 'Accent text'],
	['var(--text-accent-hover)', 'Accent hover text'],
	['var(--text-on-accent)', 'Text on accent'],
	...EXTENDED_COLORS,
]);

export function normalizeObsidianColor(value: unknown, options: Record<string, string>): string | undefined {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(options, value) ? value : undefined;
}
