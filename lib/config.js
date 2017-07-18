import { get } from './helpers';

export const ranges = {
	maxChunkSize: [10, 1000],
	reportingInterval: [500, 30000]
};

export default {
	env: get(global, ['process', 'env', 'NODE_ENV']),
	enable: true,
	debug: false,
	token: null,
	bucket: null,
	maxChunkSize: 200,
	reportingInterval: 5000,
	reportingEndpoint: 'https://hub.bitclock.io',
	reportingAPIVersion: 'v0',
	...JSON.parse(get(global, ['process', 'env', '__SECRET_BITCLOCK_CONFIG_JSON'], '{}'))
};
