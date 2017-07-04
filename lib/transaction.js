import v4 from 'uuid/v4';

import Stack from './stack';
import DeferredEvent from './deferred-event';
import Waterfall from './waterfall';
import enqueue from './fetch-queue';
import { validateDimensions, validateMetrics } from './validators';
import { cloneDeepJSON } from './helpers';
import CONFIG from './config';

export default function Transaction(initialData = {}) {
	const { transactionId = v4(), dimensions: initialDims = {}, ...otherData } = initialData;
	const transactionData = cloneDeepJSON(otherData);
	const transactionDims = cloneDeepJSON(initialDims);
	const stack = Stack();

	function tic(dims = {}) {
		return DeferredEvent(dims, (...args) => (
			dispatch('timing', ...args)
		));
	}

	function count(dims) {
		return dispatch('count', 1, dims);
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
		if (CONFIG.enable && validateDimensions(combinedDims)) {
			stack.put({
				...transactionData,
				type,
				value,
				transactionId,
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
