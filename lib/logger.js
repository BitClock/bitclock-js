import CONFIG from './config';
import { isBrowser } from './helpers';

const { console } = global;

/**
 * debug accepts a function to prevent unnecessary work when debug logging is not enabled
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

/**
 * warn accepts a function to prevent unnecessary work when running in production
 */
export function warn(fn) {
	/* eslint-disable no-console */
	if (CONFIG.env !== 'production' && typeof fn === 'function' && console && console.warn) {
		const value = fn();
		const args = Array.isArray(value) ? value : [value];
		console.warn(`${consoleLabel('33m', 'warning')}`, ...args);
	}
	/* eslint-enable no-console */
}

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
