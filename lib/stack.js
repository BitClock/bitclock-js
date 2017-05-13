import CONFIG from './config';
import { debug } from './logger';

export default function Stack() {
	const queue = [];
	let index = 0;
	let size = 0;
	let inprog = false;

	function put(element) {
		queue[size] = element;
		size++;
	}

	function next() {
		const element = queue[index];
		index++;
		if (index >= size) {
			queue.length = index = size = 0;
		}
		return element;
	}

	function flush(chunkSize = CONFIG.maxChunkSize) {
		const aggregator = [];
		if (!inprog) {
			inprog = true;
			let element;
			try {
				let i = 0;
				while ((element = next()) !== undefined) { // eslint-disable-line no-cond-assign
					const result = (typeof element === 'function') ? element() : element;
					const value = Array.isArray(result) ? result : [result];
					aggregator.push(...value);
					i += value.length;
					if (chunkSize && i >= chunkSize) {
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
		get size() {
			return size;
		},
		get inprog() {
			return inprog;
		}
	};
}
