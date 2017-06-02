import Transaction from './transaction';
import Waterfall from './waterfall';
import { debug } from './logger';
import { cloneDeep } from './helpers';
import { validateChunkSize, validateReportingInterval } from './validators';
import CONFIG, { MIN_INTERVAL, CHUNK_SIZE_RANGE } from './config';

export * as helpers from './helpers';

export { Transaction, Waterfall };

export function config(opts = {}) {
	const prevConfig = cloneDeep(CONFIG);
	const nextConfig = Object.assign(prevConfig, opts);
	const { reportingInterval, maxChunkSize } = nextConfig;

	if (!validateChunkSize(maxChunkSize)) {
		throw new Error(`maxChunkSize must be an integer between ${CHUNK_SIZE_RANGE.join(' - ')}`);
	}

	if (!validateReportingInterval(reportingInterval)) {
		throw new Error(`reportingInterval must be an integer of at least ${MIN_INTERVAL}`);
	}

	const updatedConfig = cloneDeep(Object.assign(CONFIG, nextConfig));

	debug(() => `set config = ${JSON.stringify(updatedConfig, null, 2)}`);

	return updatedConfig;
}

export default { config, Transaction, Waterfall };
