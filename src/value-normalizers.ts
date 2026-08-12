export function firstNonEmptyValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.find((entry) => normalizeScalar(entry) !== null);
	}
	return normalizeScalar(value) === null ? undefined : value;
}

export function normalizeWikiLinkTarget(value: unknown): string | null {
	const scalar = firstNonEmptyValue(value);
	if (scalar === undefined) return null;
	let text = normalizeScalar(scalar);
	if (text === null) return null;
	text = text.trim();
	if (text.startsWith('[[') && text.endsWith(']]')) text = text.slice(2, -2);
	text = text.split('|', 1)[0]?.trim() ?? '';
	text = text.replace(/\.md$/i, '').replace(/\s+/g, ' ').trim();
	return text || null;
}

export function normalizeDisplayValue(value: unknown): string | null {
	const scalar = firstNonEmptyValue(value);
	if (scalar === undefined) return null;
	let text = normalizeScalar(scalar);
	if (text === null) return null;
	text = text.trim();
	if (text.startsWith('[[') && text.endsWith(']]')) {
		text = text.slice(2, -2);
		const separator = text.indexOf('|');
		if (separator >= 0) text = text.slice(separator + 1);
	}
	text = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
	return text || null;
}

export function isSafeCssColor(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const color = value.trim();
	if (!color || /[;{}]|url\s*\(|expression\s*\(|javascript\s*:/i.test(color)) return false;
	if (color.toLowerCase() === 'transparent') return true;
	if (/^#[\da-f]{3,4}$/i.test(color) || /^#[\da-f]{6}([\da-f]{2})?$/i.test(color)) return true;
	if (/^rgba?\(\s*[\d.%+-]+(?:\s*[, ]\s*[\d.%+-]+){2}(?:\s*[,/]\s*[\d.%+-]+)?\s*\)$/i.test(color)) return true;
	if (/^hsla?\(\s*[\d.+-]+(?:deg|rad|grad|turn)?\s*[, ]\s*[\d.+-]+%\s*[, ]\s*[\d.+-]+%(?:\s*[,/]\s*[\d.%+-]+)?\s*\)$/i.test(color)) return true;
	return /^var\(\s*--[a-z0-9_-]+\s*(?:,\s*[^;{}]+)?\)$/i.test(color);
}

function normalizeScalar(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'object' && !Array.isArray(value)) {
		for (const key of ['path', 'link', 'target', 'value', 'text']) {
			const candidate = (value as Record<string, unknown>)[key];
			const normalized = stringifyScalar(candidate)?.trim();
			if (normalized) return normalized;
		}
		return null;
	}
	const text = stringifyScalar(value)?.trim() ?? '';
	return text ? text : null;
}

export function stringifyScalar(value: unknown): string | null {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
	return null;
}
