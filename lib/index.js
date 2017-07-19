import Transaction from './transaction';
import Waterfall from './waterfall';
import { debug } from './logger';
import { cloneDeepJSON } from './helpers';
import { validateRange } from './validators';
import CONFIG, { ranges } from './config';

export * as helpers from './helpers';

export { Transaction, Waterfall };

export function config(opts = {}) {
	const prevConfig = cloneDeepJSON(CONFIG);
	const nextConfig = Object.assign(prevConfig, opts);

	// ensure these options are applied first
	['debug', 'silent'].forEach((key) => {
		if (key in opts) {
			CONFIG[key] = opts[key];
		}
	});

	Object.keys(opts).forEach((key) => {
		switch (true) {
			case (key in ranges):
				if (!validateRange(key, nextConfig[key])) {
					throw new Error(`${key} must be a finite integer > 0`);
				}
				break;
		}
	});

	const updatedConfig = cloneDeepJSON(Object.assign(CONFIG, nextConfig));

	debug(() => `set config = ${JSON.stringify(updatedConfig, null, 2)}`);

	return updatedConfig;
}

export default { config, Transaction, Waterfall };
