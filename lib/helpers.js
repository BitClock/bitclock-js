import { parse as parseCookie } from 'cookie';

import CONFIG from './config';
import MaybeWeakSet from './weak-set';

const { process, window, document, console } = global;

function padLeft(input, length = 0, chars = ' ') {
	let result = String(input);
	const diff = Math.max(length - result.length, 0);
	for (let i = 0; i < diff; i++) {
		result = `${chars}${result}`;
	}
	return result;
}

function consoleLabel(ansiColor, plainLabel) {
	const date = new Date();
	const hours = padLeft(date.getUTCHours(), 2, '0');
	const minutes = padLeft(date.getUTCMinutes(), 2, '0');
	const seconds = padLeft(date.getUTCSeconds(), 2, '0');
	const timestamp = `${hours}:${minutes}:${seconds}`;
	const label = isBrowser() ? plainLabel : `\x1B[${ansiColor}${plainLabel}\x1B[0m`;
	return `[${timestamp}] - ${label}: [bitclock]`;
}

/**
 * debug accepts a function to prevent unnecessary work
 * when debug logging is not enabled
 */
export function debug(fn) {
	/* eslint-disable no-console */
	if (CONFIG.debug && typeof fn === 'function' && console && console.log) {
		const value = fn();
		const args = Array.isArray(value) ? value : [value];
		console.log(`${consoleLabel('34m', 'debug')}`, ...args);
	}
	/* eslint-enable no-console */
}

export function warn(...args) {
	/* eslint-disable no-console */
	if (console && console.warn) {
		console.warn(`${consoleLabel('33m', 'warning')}`, ...args);
	}
	/* eslint-enable no-console */
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

export function cloneDeep(obj) {
	return JSON.parse(safeStringify(obj));
}

export function getToken() {
	let { token } = CONFIG;
	if (!token) {
		token = get(process, ['env', 'BITCLOCK_TOKEN']);
		if (!token && document) {
			({ BITCLOCK_TOKEN: token } = parseCookie(document.cookie || ''));
		}
	}
	return token;
}

export function isBrowser() {
	return Boolean(window && document && ('onscroll' in global));
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
