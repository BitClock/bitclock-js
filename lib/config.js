import { get } from './helpers';

export const MIN_INTERVAL = 500;

export const CHUNK_SIZE_RANGE = [1, 1000];

export default {
	env: get(global, ['process', 'env', 'NODE_ENV']),
	enable: true,
	debug: false,
	token: null,
	bucket: null,
	maxChunkSize: 200,
	reportingInterval: 5000,
	reportingEndpoint: 'https://hub.bitclock.io',
	reportingAPIVersion: 'v0'
};
