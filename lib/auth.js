import { parse as parseCookie } from 'cookie';

import { warn } from './logger';
import { base64Encode, base64Decode, get, is, once } from './helpers';
import { store } from './config';
import { createHash, randomBytes } from './node-builtins';

export const preamble = ('signed')
	.split('')
	.map(c => c.charCodeAt().toString(36))
	.join('');

export const getToken = once(() => {
	let token;
	if (store) {
		({ token } = store);
	}
	if (!token) {
		token = get(process, ['env', 'BITCLOCK_TOKEN']);
	}
	if (!token && process.browser) {
		({ BITCLOCK_TOKEN: token } = parseCookie(global.document.cookie || ''));
	}
	if (!token) {
		getToken.reset();
	}
	return token || undefined;
});

export function getProof(secret, salt, timestamp) {
	const content = [secret, salt, timestamp].join(':');
	return createHash('sha256').update(content).digest('hex');
}

export function parseToken(token) {
	return (token && token.match(/[a-f0-9]{40}/gi)) || [];
}

export function signToken(token) {
	if (!/^[a-f0-9]{80}$/i.test(token)) {
		warn(() => 'Invalid token format');
		return token;
	}
	const [fingerprint, secret] = parseToken(token);
	const salt = randomBytes(8).toString('hex');
	const timestamp = new Date().toISOString();
	const proof = getProof(secret, salt, timestamp);
	const payload = [fingerprint, salt, timestamp, proof].join('|');
	return `${preamble}.${base64Encode(payload)}`;
}

export function decodeToken(token) {
	if (!is(token, 'string') || token.indexOf(preamble) !== 0) {
		warn(() => 'Invalid token format');
		return token;
	}
	const [, encoded] = token.split('.');
	const payload = base64Decode(encoded);
	const [fingerprint, salt, timestamp, proof] = payload.split('|');
	return { fingerprint, salt, timestamp, proof };
}
