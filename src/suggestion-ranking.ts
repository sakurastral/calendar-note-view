export function rankSuggestions(query: string, values: Iterable<string>, limit = 50): string[] {
	const normalizedQuery = query.trim().toLowerCase();
	return [...new Set(values)]
		.map((value) => ({ value, score: fuzzyScore(normalizedQuery, value.toLowerCase()) }))
		.filter((candidate) => candidate.score >= 0)
		.sort((left, right) => left.score - right.score || left.value.localeCompare(right.value))
		.slice(0, limit)
		.map((candidate) => candidate.value);
}

function fuzzyScore(query: string, candidate: string): number {
	if (!query) return 0;
	if (candidate === query) return 0;
	if (candidate.startsWith(query)) return 10 + candidate.length - query.length;
	const containedAt = candidate.indexOf(query);
	if (containedAt >= 0) return 100 + containedAt;
	let queryIndex = 0;
	let gaps = 0;
	let previousMatch = -1;
	for (let index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
		if (candidate[index] !== query[queryIndex]) continue;
		if (previousMatch >= 0) gaps += index - previousMatch - 1;
		previousMatch = index;
		queryIndex += 1;
	}
	return queryIndex === query.length ? 200 + gaps : -1;
}
