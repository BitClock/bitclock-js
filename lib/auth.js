import { warn } from './logger';
import { base64Encode, base64Decode, is } from './helpers';
import crypto from './builtins/crypto';

export const preamble = ('signed')
	.split('')
	.map(c => c.charCodeAt().toString(36))
	.join('');

export function getProof(secret, salt, timestamp) {
	const content = [secret, salt, timestamp].join(':');
	return crypto.createHash('sha256').update(content).digest('hex');
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
	const salt = crypto.randomBytes(8).toString('hex');
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
