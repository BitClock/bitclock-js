import v4 from 'uuid/v4';

import Stack from './stack';
import { warn } from './helpers';

export default function Transaction(enqueue, commonData = {}) {
	const events = {};
	const stack = Stack();
	const transactionId = v4();
	let common = { transactionId, ...commonData };

	function tic(label, data) {
		if (events[label]) {
			warn(`Duplicate label '${label}' for Transaction.tic()`);
		} else {
			events[label] = openTimingEvent(label, data);
		}
	}

	function toc(label, data) {
		if (!events[label]) {
			warn(`No such label '${label}' for Transaction.toc()`);
		} else {
			const event = closeTimingEvent(events[label], data);
			delete events[label];
			report({ ...event, label });
		}
	}

	function all(data) {
		if (data) {
			common = Object.assign(common, data);
		}
	}

	function report(data) {
		if (data) {
			stack.put({ ...data, ...common, timestamp: new Date().toISOString() });
			enqueue(stack);
		}
	}

	return { tic, toc, all, report };
}

function openTimingEvent(label, data = {}) {
	if (!label) {
		return warn('Label is required');
	} else if (typeof label !== 'string') {
		return warn('Label must be a string');
	}
	return { ...data, label, type: 'timing', start: Date.now() };
}

function closeTimingEvent(event, data = {}) {
	const end = Date.now();
	const elapsed = end - event.start;
	return { ...data, ...event, end, elapsed };
}
