import { get } from './helpers';

export default {
	env: get(global, ['process', 'env', 'NODE_ENV']),
	debug: false,
	token: null,
	bucket: null,
	reportingInterval: 5000,
	reportingEndpoint: 'https://hub.bitclock.io'
};

export const MIN_INTERVAL = 500;
