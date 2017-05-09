import v4 from 'uuid/v4';

import CONFIG from './config';
import Stack from './stack';
import { getEventKey, TimingEvent } from './events';
import { warn, get, isBrowser } from './helpers';

export default function Transaction(enqueue, commonData = {}) {
	const common = {
		env: CONFIG.env,
		transactionId: v4(),
		userAgent: get(global, ['navigator', 'userAgent']),
		source: isBrowser() ? 'client' : 'server',
		...commonData
	};
	const stack = Stack();
	const events = {};

	function tic(dimensions, data) {
		const key = getEventKey(dimensions);
		if (events[key]) {
			warn(`Duplicate event key '${key}' for Transaction.tic()`);
			return void 0;
		}
		events[key] = TimingEvent(dimensions, data);
	}

	function toc(dimensions, data) {
		const key = getEventKey(dimensions);
		const event = events[key];
		if (!event) {
			warn(`No such event key '${key}' for Transaction.toc()`);
			return void 0;
		}
		delete events[key];
		event.close(data);
		report(event.data);
	}

	function all(data = {}) {
		Object.assign(common, data);
	}

	function report(data = {}) {
		stack.put({ ...data, ...common, timestamp: new Date().toISOString() });
		enqueue(stack);
	}

	return {
		tic,
		toc,
		all,
		report,
		get id() {
			return common.transactionId;
		}
	};
}
