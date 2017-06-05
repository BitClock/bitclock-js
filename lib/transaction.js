import v4 from 'uuid/v4';

import Stack from './stack';
import DeferredEvent from './deferred-event';
import Waterfall from './waterfall';
import enqueue from './fetch-queue';
import { validateDimensions } from './validators';
import { cloneDeepJSON } from './helpers';

export default function Transaction(initialData = {}) {
	const { transactionId = v4(), ...otherData } = initialData;
	const transactionData = cloneDeepJSON(otherData);
	const stack = Stack();

	function tic(...args) {
		return DeferredEvent(...args, (elapsed, dimensions) => (
			dispatch('timing', elapsed, dimensions)
		));
	}

	function count(dimensions) {
		dispatch('count', 1, dimensions);
		return transaction;
	}

	function data(...objects) {
		Object.assign(transactionData, ...objects);
		return transaction;
	}

	function dispatch(type, value, dimensions) {
		if (validateDimensions(dimensions)) {
			stack.put({
				transactionId,
				type,
				value,
				dimensions,
				data: transactionData,
				timestamp: new Date().toISOString()
			});
			enqueue(stack);
		}
		return transaction;
	}

	const transaction = {
		tic,
		count,
		data,
		dispatch,
		get transactionId() {
			return transactionId;
		},
		Waterfall: (...args) => (
			Waterfall(...args, transaction)
		)
	};

	return transaction;
}
