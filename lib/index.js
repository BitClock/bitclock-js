import fetch from 'isomorphic-fetch';

import pkg from '../package.json';
import Stack from './stack';
import createTransaction from './transaction';
import { debug, warn } from './logger';
import { get, isBrowser, once, getToken, cloneDeep, safeStringify } from './helpers';
import CONFIG, {
	MIN_INTERVAL,
	CHUNK_SIZE_RANGE,
	validateChunkSize,
	validateReportingInterval
} from './config';

const logEnvWarning = once(() => warn(() => 'Missing value for config.env'));
const stack = Stack();

const enqueue = (() => {
	let lastSent;
	let checkInProgress;

	function checkTime() {
		debug(() => `enqueue / checkTime / lastSent = ${lastSent}`);
		const time = Date.now();
		if (!lastSent || time - CONFIG.reportingInterval >= lastSent) {
			lastSent = time;
			debug(() => `enqueue / flush stack / stack.size = ${stack.size}`);
			while (stack.size > 0) {
				send(stack.flush());
			}
		}
		if (stack.size) {
			setTimeout(checkTime, MIN_INTERVAL);
		} else {
			checkInProgress = false;
		}
	}

	return (substack) => {
		stack.put(() => substack.flush());
		debug(() => {
			return `enqueue / stack.size = ${stack.size} / substack = ${JSON.stringify(substack, null, 2)}`;
		});
		// wrap this in a timeout so libs like bluebird
		// don't complain about orphaned promises
		if (!checkInProgress) {
			checkInProgress = true;
			setTimeout(checkTime);
		}
	};
})();

function send(events) {
	if (!CONFIG.env) {
		logEnvWarning();
	}

	debug(() => `events = ${JSON.stringify(events, null, 2)}`);

	if (events.length < 1) {
		return Promise.resolve();
	}

	const { bucket, reportingEndpoint } = CONFIG;
	const uri = `${reportingEndpoint}/v0/bucket/${bucket}/event`;

	const { env } = CONFIG;
	const { version } = pkg;
	const userAgent = get(global, ['navigator', 'userAgent']);
	const source = isBrowser() ? 'client' : 'server';
	const body = { version, env, userAgent, source, events };

	return fetch(uri, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			authorization: `Bearer ${getToken()}`,
			'content-type': 'application/json',
		},
		body: safeStringify(body)
	});
}

export const Transaction = createTransaction.bind(null, enqueue);

export function config(opts = {}) {
	const prevConfig = cloneDeep(CONFIG);
	const nextConfig = Object.assign(prevConfig, opts);
	const { reportingInterval, maxChunkSize } = nextConfig;

	if (!validateChunkSize(maxChunkSize)) {
		throw new Error(`maxChunkSize must be an integer between ${CHUNK_SIZE_RANGE.join(' - ')}`);
	}

	if (!validateReportingInterval(reportingInterval)) {
		throw new Error(`reportingInterval must be an integer of at least ${MIN_INTERVAL}`);
	}

	const updatedConfig = cloneDeep(Object.assign(CONFIG, nextConfig));

	debug(() => `set config = ${JSON.stringify(updatedConfig, null, 2)}`);

	return updatedConfig;
}

export default { config, Transaction };
