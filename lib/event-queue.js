import Stack from './stack';
import { post } from './http';
import { debug, warn } from './logger';
import { once, hrtime } from './helpers';
import { store, ranges } from './config';

import { version } from '../package.json';

const logEnvWarning = once(() => warn(() => 'Missing value for config.env'));

export const stack = Stack();

let lastSent;
let checkInProgress;

export default function enqueue(substack) {
	if (store.enable) {
		stack.put(() => substack.flush());
		debug(() => (
			`enqueue / stack.size = ${stack.size} / substack = ${JSON.stringify(substack, null, 2)}`
		));
		// wrap this in a timeout so libs like bluebird
		// don't complain about orphaned promises
		if (!checkInProgress) {
			checkInProgress = true;
			setTimeout(checkTime);
		}
	}
}

function checkTime() {
	debug(() => `enqueue / checkTime / lastSent = ${lastSent}`);
	const time = hrtime();
	if (!lastSent || time - store.reportingInterval >= lastSent) {
		lastSent = time;
		debug(() => `enqueue / flush stack / stack.size = ${stack.size}`);
		while (stack.size > 0) {
			send(stack.flush());
		}
	}
	if (stack.size) {
		setTimeout(
			checkTime,
			Math.min(
				Math.ceil(store.reportingInterval / 2),
				ranges.reportingInterval[0]
			)
		);
	} else {
		checkInProgress = false;
	}
}

function send(events) {
	if (!store.env) {
		logEnvWarning();
	}

	debug(() => `events = ${JSON.stringify(events, null, 2)}`);

	if (events.length < 1) {
		return Promise.resolve();
	}

	const { env } = store;
	const source = (process.browser ? 'client' : 'server');
	const body = { version, env, source, events };

	return post('/event', { body })
		.catch(err => warn(err.stack));
}
