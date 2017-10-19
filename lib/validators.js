import { ranges } from './config';
import { is } from './helpers';
import { warn } from './logger';

function isWithin(value, range) {
	return value >= range[0] && value <= range[1];
}

function isFiniteInteger(value) {
	return (
		is(value, 'number')
			&& Math.round(value) === value
			&& Number.isFinite(value)
	);
}

export function validateRange(key, value) {
	const valid = isFiniteInteger(value) && value > 0;
	const optimal = isWithin(value, ranges[key]);
	if (valid && !optimal) {
		warn(() => (
			`The specified value for ${key} (${value}) falls outside the optimal ` +
			`range (${ranges[key].join(' - ')}). This may result in degraded performance.`
		));
	}
	return valid;
}

export function validateMetrics(value) {
	const valid = Boolean(
		value
			&& is(value, 'object')
			&& Object.values(value).reduce((prev, next) => (
				prev && is(next, 'number') && Number.isFinite(next)
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
		const values = Object.values(dimensions);
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
