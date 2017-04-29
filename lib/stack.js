import { debug } from './helpers';

export default function Stack() {
	const queue = [];
	let index = 0;
	let length = 0;
	let inprog = false;

	function put(element) {
		queue[length] = element;
		length++;
	}

	function next() {
		const element = queue[index];
		index++;
		if (index >= length) {
			queue.length = index = length = 0;
		}
		return element;
	}

	function flush(maxChunkSize) {
		const aggregator = [];
		if (!inprog) {
			inprog = true;
			let element;
			try {
				let i = 0;
				while (element = next()) { // eslint-disable-line no-cond-assign
					const result = (typeof element === 'function') ? element() : element;
					const value = Array.isArray(result) ? result : [result];
					aggregator.push(...value);
					i++;
					if (maxChunkSize && i >= maxChunkSize) {
						break;
					}
				}
			} catch (err) {
				debug(() => err.stack);
			}
			inprog = false;
		}
		return aggregator;
	}

	return {
		put,
		next,
		flush,
		get length() {
			return length;
		},
		get inprog() {
			return inprog;
		}
	};
}
