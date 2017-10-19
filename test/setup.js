import { randomBytes } from 'crypto';

if (!('BITCLOCK_TOKEN' in process.env)) {
	process.env.BITCLOCK_TOKEN = randomBytes(40).toString('hex');
}
