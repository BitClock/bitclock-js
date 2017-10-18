import { get, getToken } from './helpers';

export const ranges = {
	maxChunkSize: [10, 1000],
	reportingInterval: [500, 30000]
};

export default Object.create({
	env: get(process, ['env', 'NODE_ENV']),
	token: getToken(),
	enable: true,
	debug: false,
	silent: false,
	bucket: null,
	maxChunkSize: 200,
	reportingInterval: process.browser ? 500 : 5000,
	reportingEndpoint: 'https://hub.bitclock.io',
	reportingAPIVersion: 'v0',
	...JSON.parse(get(process, ['env', '__SECRET_BITCLOCK_CONFIG_JSON'], '{}'))
});
