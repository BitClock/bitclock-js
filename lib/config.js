import { get } from './helpers';

export const MIN_INTERVAL = 500;

export const CHUNK_SIZE_RANGE = [1, 1000];

export default {
	env: get(global, ['process', 'env', 'NODE_ENV']),
	debug: false,
	token: null,
	bucket: null,
	maxChunkSize: 200,
	reportingInterval: 5000,
	reportingEndpoint: 'https://hub.bitclock.io'
};

export function validateChunkSize(value) {
	return Boolean(
		value >= CHUNK_SIZE_RANGE[0]
			&& value <= CHUNK_SIZE_RANGE[1]
			&& Math.round(value) === value
	);
}

export function validateReportingInterval(value) {
	return Boolean(
		value
			&& value >= MIN_INTERVAL
			&& value === Math.round(value)
	);
}
