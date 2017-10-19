import v4 from 'uuid/v4';

import Stack from './stack';
import DeferredEvent from './deferred-event';
import Waterfall from './waterfall';
import enqueue from './event-queue';
import { validateDimensions, validateMetrics } from './validators';
import { get, cloneDeepJSON } from './helpers';
import { store } from './config';

const userAgent = get(global, ['navigator', 'userAgent']);

export default function Transaction(initialData = {}) {
	const { transactionId = v4(), dimensions: initialDims = {}, ...otherData } = initialData;
	const transactionData = cloneDeepJSON({ userAgent, ...otherData });
	const transactionDims = cloneDeepJSON(initialDims);
	const stack = Stack();

	function tic(dims = {}) {
		return DeferredEvent(dims, (...args) => (
			dispatch('timing', ...args)
		));
	}

	function count(dims, n = 1) {
		return dispatch('count', n, dims);
	}

	function dimensions(...objects) {
		Object.assign(transactionDims, ...objects);
		return transaction;
	}

	function metrics(object, dims) {
		if (validateMetrics(object)) {
			Object.keys(object).forEach(key => {
				dispatch('metric', object[key], { ...dims, metric: key });
			});
		}
		return transaction;
	}

	function data(...objects) {
		Object.assign(transactionData, ...objects);
		return transaction;
	}

	function dispatch(type, value, dims) {
		const combinedDims = { ...transactionDims, ...dims };
		/* istanbul ignore else */
		if (store.enable && validateDimensions(combinedDims)) {
			stack.put({
				type,
				value,
				transactionId,
				data: transactionData,
				dimensions: combinedDims,
				timestamp: new Date().toISOString()
			});
			enqueue(stack);
		}
		return transaction;
	}

	const transaction = {
		tic,
		count,
		dimensions,
		dims: dimensions,
		metrics,
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
