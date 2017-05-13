import v4 from 'uuid/v4';

import Stack from './stack';
import { is, once, objectValues, cloneDeep } from './helpers';
import { warn } from './logger';

export default function Transaction(enqueue, initialData = {}) {
	const { transactionId = v4(), ...otherData } = initialData;
	const transactionData = cloneDeep(otherData);
	const stack = Stack();

	function tic(ticDimensions = {}) {
		const type = 'timing';
		const start = Date.now();
		return once((tocDimensions = {}) => {
			const elapsed = Date.now() - start;
			const dimensions = (is(ticDimensions, 'object') && is(ticDimensions, 'object'))
				? { ...ticDimensions, ...tocDimensions }
				: null;
			dispatch(type, elapsed, dimensions);
			return transaction;
		});
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
		}
	};

	return transaction;
}

export function validateDimensions(dimensions) {
	let valid = Boolean(
		dimensions
		&& is(dimensions, 'object')
		&& !Array.isArray(dimensions)
		&& Object.keys(dimensions).length > 0
	);
	if (valid) {
		let i = 0;
		const values = objectValues(dimensions);
		while (i < values.length) {
			if (values[i] && is(values[i], 'object')) {
				warn(() => 'Dimensions may not contain nested objects');
				valid = false;
				break;
			}
			i++;
		}
	} else {
		warn(() => 'Dimensions must be a plain object with size > 0');
	}
	return valid;
}
