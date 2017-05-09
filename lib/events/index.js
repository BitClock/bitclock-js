import hash from '../hash';
import { objectValues, warn } from '../helpers';

export TimingEvent from './timing';

export function getEventKey(dimensions) {
	return (dimensions && typeof dimensions === 'object')
		? hash(dimensions)
		: dimensions;
}

export function validateDimensions(dimensions) {
	let valid = true;
	if (dimensions && typeof dimensions === 'object' && !Array.isArray(dimensions)) {
		let i = 0;
		const values = objectValues(dimensions);
		while (i < values.length) {
			if (values[i] && typeof values[i] === 'object') {
				warn('Dimensions may not contain nested objects');
				valid = false;
				break;
			}
			i++;
		}
	} else if (!dimensions || typeof dimensions !== 'string') {
		warn('Dimensions must be a non-empty string or plain object');
		valid = false;
	}
	return valid;
}
