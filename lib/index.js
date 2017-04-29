import fetch from 'isomorphic-fetch';

import Stack from './stack';
import Transaction from './transaction';
import { debug, getToken, cloneDeep, safeStringify } from './helpers';
import CONFIG, { MIN_INTERVAL } from './config';

const stack = Stack();

const enqueue = (() => {
	let lastSent;
	function checkTime() {
		debug(() => `enqueue / checkTime / lastSent = ${lastSent}`);
		const time = Date.now();
		if (!lastSent || time - CONFIG.reportingInterval >= lastSent) {
			lastSent = time;
			debug(() => `enqueue / flush stack / stack.length = ${stack.length}`);
			send(stack.flush());
		}
		if (stack.length) {
			setTimeout(checkTime, MIN_INTERVAL);
		}
	}
	return (substack) => {
		stack.put(() => substack.flush());
		debug(() => {
			return `enqueue / stack.length = ${stack.length} / substack = ${JSON.stringify(substack, null, 2)}`;
		});
		// wrap this in a timeout so libs like bluebird
		// don't complain about orphaned promises
		setTimeout(checkTime);
	};
})();

function send(body) {
	debug(() => `body = ${JSON.stringify(body, null, 2)}`);
	if (body.length < 1) {
		return Promise.resolve();
	}
	const { bucket, reportingEndpoint } = CONFIG;
	const uri = `${reportingEndpoint}/v0/bucket/${bucket}/event`;
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

function config(opts = {}) {
	const prevConfig = cloneDeep(CONFIG);
	const nextConfig = Object.assign(prevConfig, opts);
	const { reportingInterval } = nextConfig;
	if (
		!reportingInterval
		|| reportingInterval < MIN_INTERVAL
		|| reportingInterval !== Math.round(reportingInterval)
	){
		throw new Error(`reportingInterval must be an integer of at least ${MIN_INTERVAL}`);
	}
	const updatedConfig = cloneDeep(Object.assign(CONFIG, nextConfig));
	debug(() => `set config = ${JSON.stringify(updatedConfig, null, 2)}`);
	return updatedConfig;
}

module.exports = { config, Transaction: (data) => Transaction(enqueue, data) };
