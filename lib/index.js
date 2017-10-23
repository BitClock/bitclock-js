import Config from './config';
import Transaction from './transaction';
import Waterfall from './waterfall';
import { post } from './http';
import { debug, warn } from './logger';

export * as helpers from './helpers';

export { Config, Transaction, Waterfall };

export function ensureIndex(name, keys = [name]) {
	debug(() => `ensureIndex(${name}, [${keys.join(', ')}])`);
	return post('/index', { body: { name, keys } })
		.then(res => res.json())
		.catch(err => warn(err.stack));
}

export default { ensureIndex, Config, Transaction, Waterfall };
