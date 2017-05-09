import v4 from 'uuid/v4';

import Stack from './stack';
import { TimingEvent } from './events';
import { warn, get } from './helpers';
import CONFIG from './config';

export default function Transaction(enqueue, commonData = {}) {
	const common = {
		env: CONFIG.env,
		transactionId: v4(),
		userAgent: get(global, ['navigator', 'userAgent']),
		...commonData
	};
	const stack = Stack();
	const events = {};

	function tic(label, data) {
		if (events[label]) {
			warn(`Duplicate label '${label}' for Transaction.tic()`);
		} else {
			events[label] = TimingEvent(label, data);
		}
	}

	function toc(label, data) {
		const event = events[label];
		if (!event) {
			warn(`No such label '${label}' for Transaction.toc()`);
		} else {
			delete events[label];
			event.close(data);
			report(event.data);
		}
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
		get transactionId() {
			return common.transactionId;
		}
	};
}
