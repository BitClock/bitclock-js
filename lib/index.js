import fetch from 'isomorphic-fetch';

import Stack from './stack';
import { getToken, cloneDeep } from './helpers';

const CONFIG = {
	token: null,
	bucket: null,
	reportingInterval: 5000,
	reportingEndpoint: 'https://hub.bitclock.io'
};

const MIN_INTERVAL = 200;

const timing = {};

const stack = Stack();

const enqueue = (() => {
	let lastSent;
	const events = [];
	function checkTime() {
		const time = Date.now();
		if (lastSent) {
			if (time - lastSent >= CONFIG.reportingInterval) {
				const eventsSnapshot = events.slice();
				events.length = 0;
				lastSent = time;
				stack.put(() => send(eventsSnapshot));
				stack.flush();
			} else if (events.length) {
				setTimeout(checkTime, MIN_INTERVAL);
			}
		} else {
			lastSent = time;
		}
	}
	return (event) => {
		events.push(event);
		checkTime();
	};
})();

function send(body) {
	if (!body || Object.keys(body).length < 1) {
		return Promise.resolve();
	}
	const { bucket, reportingEndpoint } = CONFIG;
	const uri = `${reportingEndpoint}/v0/${bucket}/event`;
	const token = getToken(CONFIG);
	return fetch(uri, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify(body)
	});
}

export function config(opts = {}) {
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
	return cloneDeep(Object.assign(CONFIG, nextConfig));
}

export function report(data) {
	enqueue(data);
}

export function tic(label, extras = {}) {
	if (!label) {
		throw new ReferenceError('Label is required');
	} else if (typeof label !== 'string') {
		throw new TypeError('Label must be a string');
	}
	timing[label] = { ...extras, type: 'timing', start: Date.now() };
}

export function toc(label, extras = {}) {
	const data = timing[label];
	if (data) {
		delete timing[label];
		const end = Date.now();
		const elapsed = end - data.start;
		enqueue({ ...extras, ...data, end, elapsed });
	}
}

export default { config, report, tic, toc };
