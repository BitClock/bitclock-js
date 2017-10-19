import { store } from './config';
import { Buffer } from './node-builtins';

const { atob, btoa, performance = {} } = global;

export function base64Encode(string) {
	return process.browser
		? btoa(string)
		: Buffer.from(string, 'utf8').toString('base64');
}

export function base64Decode(string) {
	return process.browser
		? atob(string)
		: Buffer.from(string, 'base64').toString('utf8');
}

export function is(target, type) {
	return typeof target === type;
}

export function get(obj, path, otherwise) {
	let i = 0;
	let result = obj;
	while (result && typeof result === 'object' && i < path.length) {
		result = result[path[i]];
		i++;
	}
	return String(result) === 'undefined' ? otherwise : result;
}

export function once(fn) {
	let result;
	let called;
	return Object.assign(
		(...args) => {
			if (!called) {
				called = true;
				result = fn(...args);
			}
			return result;
		},
		{ reset: () => {
			called = false;
		} }
	);
}

export function safeStringify(obj) {
	const cache = new WeakSet();
	return JSON.stringify(obj, (key, value) => {
		let nextValue = value;
		if (nextValue && typeof nextValue === 'object') {
			if (cache.has(nextValue)) {
				nextValue = undefined;
			} else {
				cache.add(nextValue);
			}
		}
		return nextValue;
	});
}

export function cloneDeepJSON(obj) {
	return obj && JSON.parse(safeStringify(obj));
}

export const hrtime = (() => {
	const initTime = Date.now();
	const $impl = (() => {
		let fn = () => Date.now() - initTime;
		if (!performance.now && is(process.hrtime, 'function') && is(process.uptime, 'function')) {
			const nano = () => {
				const [s, ns] = process.hrtime();
				return s * 1e9 + ns;
			};
			const up = nano() - process.uptime() * 1e9;
			Object.assign(performance, { now: () => (nano() - up) / 1e6 });
		}
		if (is(performance.now, 'function')) {
			fn = ofs => performance.now() - ofs;
		}
		return fn;
	})();
	const offset = $impl(0);
	return () => initTime + $impl(offset);
})();

export const getBucketURL = once(() => {
	const { bucket, reportingEndpoint, reportingAPIVersion } = store;
	return `${reportingEndpoint}/${reportingAPIVersion}/bucket/${encodeURIComponent(bucket)}`;
});
