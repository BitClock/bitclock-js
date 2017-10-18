import { parse as parseCookie } from 'cookie';

import CONFIG from './config';

const { document, performance = {} } = global;

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

export function cloneDeepJSON(obj) {
	return obj && JSON.parse(safeStringify(obj));
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

export const getToken = once(() => {
	let token = get(process, ['env', 'BITCLOCK_TOKEN']);
	if (!token && CONFIG) {
		({ token } = CONFIG);
	}
	if (!token && document) {
		({ BITCLOCK_TOKEN: token } = parseCookie(document.cookie || ''));
	}
	if (!token) {
		getToken.reset();
	}
	return token;
});

export const getBucketURL = once(() => {
	const { bucket, reportingEndpoint, reportingAPIVersion } = CONFIG;
	return `${reportingEndpoint}/${reportingAPIVersion}/bucket/${encodeURIComponent(bucket)}`;
});
