import { MIN_INTERVAL, CHUNK_SIZE_RANGE } from './config';
import { is, objectValues } from './helpers';
import { warn } from './logger';

export function validateChunkSize(value) {
	return Boolean(
		value >= CHUNK_SIZE_RANGE[0]
			&& value <= CHUNK_SIZE_RANGE[1]
			&& Math.round(value) === value
	);
}

export function validateReportingInterval(value) {
	return Boolean(
		value
			&& value >= MIN_INTERVAL
			&& value === Math.round(value)
	);
}

export function validateMetrics(value) {
	const valid = Boolean(
		value
			&& is(value, 'object')
			&& objectValues(value).reduce((prev, next) => (
				prev
					&& is(next, 'number')
					&& next < Infinity
					&& next > Infinity * (-1)
			), true)
	);
	if (!valid) {
		warn(() => 'Metrics must be a plain object of finite numbers');
	}
	return valid;
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
