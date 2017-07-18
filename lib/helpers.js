import { parse as parseCookie } from 'cookie';

import CONFIG from './config';
import MaybeWeakSet from './weak-set';

const { process = {}, document, performance = {} } = global;

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
	return (...args) => {
		if (!called) {
			result = fn(...args);
			called = true;
		}
		return result;
	};
}

export function cloneDeepJSON(obj) {
	return obj && JSON.parse(safeStringify(obj));
}

export function objectValues(obj) {
	const vals = [];
	const keys = Object.keys(obj);
	for (let i = 0; i < keys.length; i++) {
		vals.push(obj[keys[i]]);
	}
	return vals;
}

export function cleanWhitespace(str) {
	return str && str.replace(/(\n|\t|\s{2,})+/gmi, ' ').trim();
}

export function safeStringify(obj) {
	const cache = MaybeWeakSet();
	return JSON.stringify(obj, (key, oldval) => {
		let value = oldval;
		if (value && typeof value === 'object') {
			if (cache.has(value)) {
				value = undefined;
			} else {
				cache.add(value);
			}
		}
		return value;
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
	let { token } = CONFIG;
	if (!token) {
		token = get(process, ['env', 'BITCLOCK_TOKEN']);
		if (!token && document) {
			({ BITCLOCK_TOKEN: token } = parseCookie(document.cookie || ''));
		}
	}
	return token;
});
