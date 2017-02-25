import cookie from 'js-cookie';

import CONFIG from './config';

function consoleLabel(ansiColor, label) {
	return isBrowser() ? label : `\x1B[${ansiColor}${label}\x1B[0m`;
}

export function debug(...args) {
	/* eslint-disable no-console */
	if (CONFIG.debug && global.console && console.log) {
		console.log(`[bitclock] ${consoleLabel('36m', 'debug')}:`, ...args);
	}
	/* eslint-enable no-console */
}

export function warn(...args) {
	/* eslint-disable no-console */
	if (global.console && console.warn) {
		console.warn(`[bitclock] ${consoleLabel('33m', 'warning')}:`, ...args);
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
