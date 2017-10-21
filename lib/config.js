import { parse as parseCookie } from 'cookie';

import { signToken } from './auth';
import { base64Encode, base64Decode, cloneDeepJSON, get, once } from './helpers';
import { debug } from './logger';
import { validateRange } from './validators';
import { assign } from './builtins/object';

export const getExternalToken = once(() => {
	const token = process.browser
		? get(parseCookie(global.document.cookie), ['BITCLOCK_TOKEN'])
		: get(process, ['env', 'BITCLOCK_TOKEN']);
	if (!token) {
		getExternalToken.reset();
	}
	return token ? { token } : {};
});

export const ranges = {
	maxChunkSize: [10, 1000],
	reportingInterval: [500, 30000]
};

export const store = Object.create({
	env: get(process, ['env', 'NODE_ENV']),
	enable: true,
	debug: false,
	silent: false,
	bucket: null,
	maxChunkSize: 200,
	reportingInterval: process.browser ? 500 : 5000,
	reportingEndpoint: 'https://hub.bitclock.io',
	reportingAPIVersion: 'v0',
	...JSON.parse(get(process, ['env', '__SECRET_BITCLOCK_CONFIG_JSON']) || '{}'),
	...deserialize(get(global, ['BITCLOCK_SERIALIZED_CONFIG'])),
	...getExternalToken()
});

const internalRead = once(() => (
	cloneDeepJSON({ ...store.__proto__, ...store })
));

function internalUpdate(opts) {
	// ensure these options are applied first
	['debug', 'silent'].forEach((key) => {
		if (key in opts) {
			store[key] = opts[key];
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
		store[key] = opts[key];
	});

	internalRead.reset();

	debug(() => `set config = ${JSON.stringify(internalRead(), null, 2)}`);

	return internalRead();
}

export function reset() {
	Object.keys(store).forEach((key) => {
		delete store[key];
	});
	internalRead.reset();
	getExternalToken.reset();
}

export function serialize(full = false) {
	return base64Encode(JSON.stringify(
		full
			? internalRead()
			: { ...store, token: signToken(store.token) }
	));
}

export function deserialize(input) {
	return input ? JSON.parse(base64Decode(input)) : {};
}

export default function Config(opts) {
	return opts
		? internalUpdate({ ...opts, ...getExternalToken() })
		: internalRead();
}

assign(Config, { reset, serialize, deserialize });
