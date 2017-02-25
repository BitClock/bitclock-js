import cookie from 'js-cookie';

import CONFIG from './config';

function padLeft(input, length = 0, chars = ' ') {
	let result = String(input);
	const diff = Math.max(length - result.length, 0);
	for (let i = 0; i < diff; i++) {
		result = `${chars}${result}`;
	}
	return result;
}

function consoleLabel(ansiColor, rawLabel) {
	const date = new Date();
	const hours = padLeft(date.getUTCHours(), 2, '0');
	const minutes = padLeft(date.getUTCMinutes(), 2, '0');
	const seconds = padLeft(date.getUTCSeconds(), 2, '0');
	const timestamp = `${hours}:${minutes}:${seconds}`;
	const label = isBrowser() ? rawLabel : `\x1B[${ansiColor}${rawLabel}\x1B[0m`;
	return `[${timestamp}] - ${label}: [bitclock]`;
}

export function debug(...args) {
	/* eslint-disable no-console */
	if (CONFIG.debug && global.console && console.log) {
		console.log(`${consoleLabel('34m', 'debug')}`, ...args);
	}
	/* eslint-enable no-console */
}

export function warn(...args) {
	/* eslint-disable no-console */
	if (global.console && console.warn) {
		console.warn(`${consoleLabel('33m', 'warning')}`, ...args);
	}
	/* eslint-enable no-console */
}

export function cloneDeep(obj) {
	return JSON.parse(JSON.stringify(obj));
}

export function getToken() {
	let { token } = CONFIG;
	if (!token) {
		if (global.process && process.env) {
			token = process.env.BITCLOCK_TOKEN;
		} else if (global.window) {
			token = cookie.get('BITCLOCK_TOKEN');
		}
	}
	return token;
}

export function isBrowser() {
	return Boolean(global.window && global.document);
}
