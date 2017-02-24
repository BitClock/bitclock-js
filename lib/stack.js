export default function Stack() {
	const queue = [];
	let index = 0;
	let length = 0;

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

	function flush() {
		const fn = next();
		return Promise
			.resolve((() => {
				try {
					return fn && fn();
				} catch (err) {
					return Promise.reject(err);
				}
			})())
			.then(() => fn && flush());
	}

	return {
		put,
		next,
		flush,
		get length() {
			return length;
		}
	};
}
