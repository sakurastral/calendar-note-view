import { describe, expect, it } from 'vitest';
import { collectEventTypeValues } from '../src/event-types';

describe('event type values', () => {
	it('collects dropdown and intellisense values from rules, profiles, indexed items, and the current value', () => {
		const values = collectEventTypeValues({
			sourceProfiles: [{ defaultType: 'Meeting' } as never, { defaultType: ' Holiday ' } as never],
			typeStyleRules: [{ typeValue: 'Holiday' } as never, { typeValue: 'Travel' } as never],
		}, [{ type: 'Birthday' }, { type: 'Meeting' }], ['Custom']);
		expect(values).toEqual(['Birthday', 'Custom', 'Holiday', 'Meeting', 'Travel']);
	});
});
