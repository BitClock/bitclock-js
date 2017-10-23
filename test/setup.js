import { randomBytes } from 'crypto';

if (!('BITCLOCK_TOKEN' in process.env)) {
	process.env.BITCLOCK_TOKEN = JSON.stringify({
		private: randomBytes(40).toString('hex'),
		public: randomBytes(40).toString('hex')
	});
}
