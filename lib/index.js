import Transaction from './transaction';
import Waterfall from './waterfall';
import { post } from './http';
import { debug, warn } from './logger';
import { getToken } from './auth';
import { cloneDeepJSON } from './helpers';
import { validateRange } from './validators';
import CONFIG, { ranges } from './config';

export * as helpers from './helpers';

export { Transaction, Waterfall };

export function ensureIndex(name, keys = [name]) {
	debug(() => `ensureIndex(${name}, [${keys.join(', ')}])`);
	return post('/index', { body: { name, keys } })
		.then(res => res.json())
		.catch(err => warn(err.stack));
}

export function config(opts = {}) {
	// reset getToken helper if opts.token exists
	if ('token' in opts) {
		getToken.reset();
	}

	// ensure these options are applied first
	['debug', 'silent'].forEach((key) => {
		if (key in opts) {
			CONFIG[key] = opts[key];
		}
	});

	Object.keys(opts).forEach((key) => {
		switch (true) {
			case (key in ranges):
				if (!validateRange(key, opts[key])) {
					throw new Error(`${key} must be a finite integer > 0`);
				}
				break;
		}
	});

	Object.assign(CONFIG, opts);

	const nextConfig = cloneDeepJSON({ ...CONFIG.__proto__, ...CONFIG });

	debug(() => `set config = ${JSON.stringify(nextConfig, null, 2)}`);

	return nextConfig;
}

export default { config, ensureIndex, Transaction, Waterfall };
