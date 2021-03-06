import _ from 'lodash';
import uuid from 'uuid';
import fetch from 'isomorphic-fetch';
import Bluebird from 'bluebird';
import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';
import intercept from 'intercept-stdout';
import stripAnsi from 'strip-ansi';
import { isUUID, isISO8601 } from 'validator';
import { randomBytes } from 'crypto';

import { ensureIndex, Config, Transaction, Waterfall } from '../lib/index';
import { stack as requestStack } from '../lib/event-queue';
import { getExternalToken } from '../lib/config';
import { MockWeakSet } from '../lib/builtins/weak-set';
import * as helpers from '../lib/helpers';
import Stack from '../lib/stack';

const initialConfig = Object.freeze(Config());
const testConfig = Object.freeze({
	...initialConfig,
	bucket: uuid.v4(),
	reportingInterval: 1,
	reportingEndpoint: 'http://localhost:3000'
});

function getPendingEvents() {
	return Bluebird.try(function checkStackSize() {
		return requestStack.size === 0 || Bluebird
			.delay(testConfig.reportingInterval)
			.then(() => checkStackSize());
	})
	.then(() => fetch(`${testConfig.reportingEndpoint}/events`))
	.then(res => res.json());
}

function createMockServer() {
	const { bucket, reportingEndpoint, reportingAPIVersion } = testConfig;
	const token = Config.getToken('private');
	const events = [];

	function checkToken(req) {
		const { authorization: [authorization] } = req.headers;
		return authorization.indexOf(token) === -1
			? new Error('Missing token')
			: null;
	}

	return nock(reportingEndpoint)
		.persist()
		.post(`/${reportingAPIVersion}/bucket/null/event`)
		.reply(404)
		.post(`/${reportingAPIVersion}/bucket/timeout/event`)
		.reply((uri, body, cb) => {
			// send a timeout response after 200 ms
			setTimeout(() => cb(null, [503, 'Service Unavailable']), 200);
		})
		.post(`/${reportingAPIVersion}/bucket/${bucket}/event`)
		.reply(function(uri, { events: chunk }, cb) {
			const err = checkToken(this.req);
			if (!err) {
				events.push(...chunk);
			}
			cb(err, [200, { chunk, total: events.length }]);
		})
		.post(`/${reportingAPIVersion}/bucket/${bucket}/index`)
		.reply(function(uri, body, cb) {
			cb(checkToken(this.req), [200, body]);
		})
		.post(`/${reportingAPIVersion}/bucket/${bucket}/token/sign`)
		.reply(function(uri, body, cb) {
			cb(checkToken(this.req), [200, { token: helpers.base64Encode(JSON.stringify(body)) }]);
		})
		.get('/events')
		.reply((uri, body, cb) => {
			const slice = events.slice(0);
			events.length = 0;
			cb(null, [200, slice]);
		});
}

let unhook = _.noop;
let interceptedErr;

function failWith(err) {
	interceptedErr = err;
}

function interceptError(fn) {
	return (...args) => {
		const result = fn(...args);
		const err = interceptedErr;
		interceptedErr = undefined;
		if (err) {
			throw err;
		}
		return result;
	};
}

afterEach(() => {
	if (interceptedErr) {
		unhook();
		throw interceptedErr;
	}
});

before(() => {
	unhook = intercept((txt) => {
		if (/(^|\W)(error|warning):(\W|$)/i.test(stripAnsi(txt))) {
			failWith(new Error(txt));
			return '';
		}
	});
});

after(() => unhook());

describe('Config', () => {
	it('should read config from __SECRET_BITCLOCK_CONFIG_JSON', () => {
		const secretConfigJSON = JSON.parse(process.env.__SECRET_BITCLOCK_CONFIG_JSON);
		expect(Object.keys(secretConfigJSON)).to.have.length.above(0);
		expect(Config()).to.include(secretConfigJSON);
	});

	it('should not throw an error when __SECRET_BITCLOCK_CONFIG_JSON is undefined', () => {
		const { __SECRET_BITCLOCK_CONFIG_JSON } = process.env;
		const cachedConfigModule = require.cache[require.resolve('../lib/config')];

		delete process.env.__SECRET_BITCLOCK_CONFIG_JSON;
		delete require.cache[require.resolve('../lib/config')];
		expect(require('../lib/config').default().fromENV).to.equal(undefined);

		Object.assign(process.env, { __SECRET_BITCLOCK_CONFIG_JSON });
		require.cache[require.resolve('../lib/config')] = cachedConfigModule;
	});

	it('should read config from BITCLOCK_SERIALIZED_CONFIG', () => {
		const cachedConfigModule = require.cache[require.resolve('../lib/config')];
		delete require.cache[require.resolve('../lib/config')];
		global.BITCLOCK_SERIALIZED_CONFIG = helpers.base64Encode(
			JSON.stringify({ fromGlobal: true })
		);
		expect(require('../lib/config').default().fromGlobal).to.equal(true);
		delete global.BITCLOCK_SERIALIZED_CONFIG;
		require.cache[require.resolve('../lib/config')] = cachedConfigModule;
	});

	it('should set config values', () => {
		expect(Config().bucket).to.equal(null);
		Config({ bucket: testConfig.bucket });
		expect(Config().bucket).to.equal(testConfig.bucket);
	});

	it('should throw an error given an invalid reportingInterval', () => {
		expect(() => Config({ reportingInterval: null })).to.throw(Error);
		expect(() => Config({ reportingInterval: -1 })).to.throw(Error);
		expect(() => Config({ reportingInterval: 300.5 })).to.throw(Error);
		expect(() => Config({ reportingInterval: Infinity })).to.throw(Error);
	});

	it('should log a warning given a non-optimal reportingInterval', () => {
		expect(interceptError(() => Config({ reportingInterval: 30 }))).to.throw(/warning/i);
		expect(interceptError(() => Config({ reportingInterval: 60000 }))).to.throw(/warning/i);
	});

	it('should throw an error given an invalid maxChunkSize', () => {
		expect(() => Config({ maxChunkSize: null })).to.throw(Error);
		expect(() => Config({ maxChunkSize: 0 })).to.throw(Error);
		expect(() => Config({ maxChunkSize: -1 })).to.throw(Error);
		expect(() => Config({ maxChunkSize: 10.5 })).to.throw(Error);
		expect(() => Config({ maxChunkSize: Infinity })).to.throw(Error);
	});

	it('should log a warning given a non-optimal maxChunkSize', () => {
		expect(interceptError(() => Config({ maxChunkSize: 1 }))).to.throw(/warning/i);
		expect(interceptError(() => Config({ maxChunkSize: 3000 }))).to.throw(/warning/i);
	});

	it('should suppress all logger output when silent is true', () => {
		expect(interceptError(() => {
			Config({
				maxChunkSize: 1,
				debug: true,
				silent: true
			});
		}))
		.to.not.throw(/warning/i);
		Config({ debug: false, silent: false });
	});

	describe('getExternalToken', () => {
		let document;
		let configToken;
		let envToken;
		let cookieString;
		let testToken;
		let testCookieString;

		['single', 'multi'].forEach((variant) => {
			describe(variant, () => {
				function getExpectedTestToken() {
					return variant === 'single' ? testToken : JSON.parse(testToken);
				}

				before(() => {
					({ document } = _.defaults(global, { document: {} }));
					configToken = Config().token;
					envToken = process.env.BITCLOCK_TOKEN;
					cookieString = document.cookie;
				});

				beforeEach(() => {
					if (variant === 'single') {
						testToken = randomBytes(40).toString('hex');
					} else {
						testToken = JSON.stringify({
							private: randomBytes(40).toString('hex'),
							public: randomBytes(40).toString('hex')
						});
					}
					testCookieString = `_test1=2.1494212681.1494212681; BITCLOCK_TOKEN=${testToken}; _test2=2.1494212681.1494212681;`;
					process.env.BITCLOCK_TOKEN = undefined;
					getExternalToken.reset();
					Config.reset();
				});

				afterEach(() => {
					Config({ token: configToken });
					process.env.BITCLOCK_TOKEN = envToken;
					document.cookie = cookieString;
				});

				after(() => {
					delete global.document;
				});

				it('should get the token from process.env', () => {
					process.env.BITCLOCK_TOKEN = testToken;
					expect(getExternalToken().token).to.deep.equal(getExpectedTestToken());
				});

				it('should get the token from document.cookie', () => {
					process.browser = true;
					document.cookie = testCookieString;
					try {
						expect(getExternalToken().token).to.deep.equal(getExpectedTestToken());
					} catch (err) {
						throw err;
					} finally {
						delete process.browser;
					}
				});

				it('should not memoize falsy values', () => {
					expect(getExternalToken()).to.not.have.property('token');
					process.env.BITCLOCK_TOKEN = testToken;
					expect(getExternalToken().token).to.deep.equal(getExpectedTestToken());
				});
			});
		});
	});

	describe('getToken', () => {
		const { BITCLOCK_TOKEN } = process.env;

		before(() => {
			delete process.env.BITCLOCK_TOKEN;
			Config.reset();
		});

		after(() => {
			delete process.browser;
			Object.assign(process.env, { BITCLOCK_TOKEN });
		});

		it('should handle handle a string value', () => {
			const token = randomBytes(40).toString('hex');
			Config({ token });
			expect(Config.getToken()).to.equal(token);
		});

		it('should handle handle an object value based on process.browser', () => {
			const token = {
				public: randomBytes(40).toString('hex'),
				private: randomBytes(40).toString('hex')
			};
			Config({ token });
			expect(Config.getToken()).to.equal(token.private);
			process.browser = true;
			try {
				expect(Config.getToken()).to.equal(token.public);
			} catch (err) {
				throw err;
			} finally {
				delete process.browser;
			}
		});

		it('should accept a forceType argument', () => {
			const token = {
				public: randomBytes(40).toString('hex'),
				private: randomBytes(40).toString('hex')
			};
			Config({ token });
			expect(Config.getToken('public')).to.equal(token.public);
			expect(Config.getToken('private')).to.equal(token.private);
		});
	});

	describe('reset', () => {
		it('should reset the config store to its inital value', () => {
			Config({ foo: 'bar' });
			expect(Config()).to.not.deep.equal(initialConfig);
			Config.reset();
			expect(Config()).to.deep.equal(initialConfig);
		});
	});

	describe('serialize', () => {
		before(() => Config.reset());

		function mockDeserialize(input) {
			return JSON.parse(helpers.base64Decode(input));
		}

		it('should serialize changes to the event store as an encoded string', () => {
			// eslint-disable-next-line no-unused-vars
			const { token, ...other } = mockDeserialize(Config.serialize());
			expect(other).to.deep.equal({
				env: process.env.NODE_ENV
			});
		});

		it('should serialize only the public token by default', () => {
			const { token } = mockDeserialize(Config.serialize());
			expect(token).to.equal(Config.getToken('public'));
		});

		it('should omit certain fields from the serialized output', () => {
			const omitted = { extends: '/secrets/.bitclockrc', indices: { foo: ['bar'] } };
			Config(omitted);
			const result = mockDeserialize(Config.serialize());
			expect(result).to.not.include(omitted);
		});

		it('should optionally serialize the entire config store', () => {
			expect(mockDeserialize(Config.serialize(true))).to.deep.equal(Config());
		});
	});

	describe('deserialize', () => {
		it('should decode a serialized config string', () => {
			const encoded = Config.serialize(true);
			expect(Config.deserialize(encoded)).to.deep.equal(Config());
		});

		it('should return an empty object if input is falsy', () => {
			expect(Config.deserialize()).to.deep.equal({});
		});
	});
});

describe('ensureIndex', () => {
	before(() => {
		createMockServer();
		try {
			// config will complain about non-optimal reportingInterval
			interceptError(() => Config(testConfig))();
		} catch (err) {/* noop */}
	});

	after(() => nock.cleanAll());

	it('should ensure an index by name', () => (
		ensureIndex('test').then(({ name, keys }) => {
			expect(name).to.equal('test');
			expect(keys).to.deep.equal(['test']);
		})
	));

	it('should accept an array of keys', () => (
		ensureIndex('test', ['foo', 'bar']).then(({ name, keys }) => {
			expect(name).to.equal('test');
			expect(keys).to.deep.equal(['foo', 'bar']);
		})
	));
});

describe('Transaction', () => {
	let transaction;

	before(() => {
		createMockServer();
		try {
			// config will complain about non-optimal reportingInterval
			interceptError(() => Config(testConfig))();
		} catch (err) {/* noop */}
	});

	after(() => nock.cleanAll());

	beforeEach(() => {
		transaction = Transaction();
	});

	describe('constructor', () => {
		it('should allow shared dimensions to be passed in initialData', () => {
			const sharedDims = { foo: 'bar' };
			const otherDims = [{ bar: 'baz' }, { 'bing': 'bong' }, {}];
			const t = Transaction({ dimensions: sharedDims });
			const expectedSize = otherDims.map(obj => t.dispatch('test', null, obj)).length;
			return getPendingEvents().then((events) => {
				expect(events).to.have.length(expectedSize);
				events.forEach((event, i) => {
					expect(event.dimensions).to.deep.equal({ ...sharedDims, ...otherDims[i] });
				});
			});
		});
	});

	describe('tic', () => {
		it('should return a toc function', () => {
			expect(() => transaction.tic()).to.be.a.function;
		});
	});

	describe('toc', () => {
		it('should work when no dimensions are passed to tic', () => {
			expect(transaction.tic()({ dims: 'test' })).to.equal(transaction);
			return getPendingEvents();
		});

		it('should work when no dimensions are passed to toc', () => {
			expect(transaction.tic({ dims: 'test' })()).to.equal(transaction);
			return getPendingEvents();
		});

		it('should safely handle invalid json', () => {
			const malformed = {
				bool: true,
				fn: function() {},
				symbol: Symbol('symbol'),
				proxy: (typeof Proxy === 'function' ? new Proxy({}, {}) : {})
			};

			const circular = {
				bool: false,
				get circular() {
					return circular;
				}
			};

			expect(() => JSON.stringify(circular)).to.throw(/circular/i);

			transaction
				.data(malformed)
				.data(circular)
				.tic({ test: true })(null);

			return getPendingEvents().then(([{ transactionId, timestamp, data }]) => {
				expect(data.bool).to.equal(false);
				expect(data.proxy).to.deep.equal({});
				expect(data).to.include(_.omit(circular, 'circular'));
				expect(isISO8601(timestamp)).to.be.ok;
				expect(isUUID(transactionId)).to.be.ok;
			});
		});

		it('should enqueue an event created with tic', () => {
			const maxDelay = 50;
			const tests = _.map([1, 2, 3], (n) => {
				return Bluebird
					.resolve(transaction.tic({ test: n }))
					.delay(_.random(1, maxDelay))
					.then(toc => toc());
			});

			return Bluebird
				.all(tests)
				.then(() => getPendingEvents())
				.then((events) => {
					expect(events).to.have.length(tests.length);
					events.forEach((event) => {
						expect(event.value).to.be.within(1, maxDelay * 5);
					});
				});
		});
	});

	describe('count', () => {
		it('should count occurrences of an event', () => {
			const expectedSize = [1, 2, 3].map(n => transaction.count({ test: n })).length;
			return getPendingEvents().then((events) => {
				expect(events).to.have.length(expectedSize);
				events.forEach((event) => {
					expect(event.value).to.equal(1);
				});
			});
		});

		it('should accept an optional quantity argument', () => {
			const expectedSize = [1, 2, 3].map(n => transaction.count({ test: n }, n)).length;
			return getPendingEvents().then((events) => {
				expect(events).to.have.length(expectedSize);
				events.forEach((event, i) => {
					expect(event.value).to.equal(i + 1);
				});
			});
		});
	});

	describe('dimensions', () => {
		it('should add dimensions shared by all transaction events', () => {
			const sharedDims = { foo: 'bar' };
			const otherDims = [{ bar: 'baz' }, { 'bing': 'bong' }, {}];
			const t = Transaction().dims(sharedDims);
			const expectedSize = otherDims.map(obj => t.dispatch('test', null, obj)).length;
			return getPendingEvents().then((events) => {
				expect(events).to.have.length(expectedSize);
				events.forEach((event, i) => {
					expect(event.dimensions).to.deep.equal({ ...sharedDims, ...otherDims[i] });
				});
			});
		});
	});

	describe('metrics', () => {
		it('should throw an error given an invalid metrics value', () => {
			const dims = { test: true };
			expect(interceptError(() => transaction.metrics({ key: 'string' }, dims))).to.throw(/warning/i);
			expect(interceptError(() => transaction.metrics({ key: NaN }, dims))).to.throw(/warning/i);
			expect(interceptError(() => transaction.metrics({ key: Infinity }, dims))).to.throw(/warning/i);
			expect(interceptError(() => transaction.metrics({ key: Infinity * (-1) }, dims))).to.throw(/warning/i);
		});

		it('should track the value of metrics', () => {
			const metric = 'test';
			const values = [{ [metric]: 1 }, { [metric]: 2 }, { [metric]: 3 }];
			const dims = { test: true };
			const expectedSize = values.map(value => transaction.metrics(value, dims)).length;
			return getPendingEvents().then((events) => {
				expect(events).to.have.length(expectedSize);
				events.forEach((event, i) => {
					expect(event.value).to.equal(values[i][metric]);
					expect(event.dimensions).to.include({ metric });
				});
			});
		});
	});

	describe('dispatch', () => {
		it('should log a warning if dimensions is falsy', () => {
			const args = ['type', 'value'];
			expect(interceptError(() => transaction.dispatch(...args))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, ''))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, 0))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, null))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, false))).to.throw(/warning/i);
		});

		it('should log a warning if dimensions is not a plain object', () => {
			const args = ['type', 'value'];
			expect(interceptError(() => transaction.dispatch(...args, 1))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, true))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, []))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, {}))).to.throw(/warning/i);
			expect(interceptError(() => transaction.dispatch(...args, { nested: {} }))).to.throw(/warning/i);
			transaction.dispatch(...args, { test: true });
			// clear the valid event from the server queue
			return getPendingEvents();
		});

		it('should not block promise chains when the server fails to respond', () => {
			Config({ bucket: 'timeout' });
			const tStart = Date.now();
			return Bluebird
				.resolve(transaction.dispatch('timeout', null, { test: true }))
				.then(() => expect(Date.now() - tStart).to.be.at.most(100))
				.then(() => getPendingEvents())
				.finally(() => Config({ bucket: testConfig.bucket }));
		});

		it('should enqueue and send events in series', () => {
			const args1 = ['type1', 'value1', { test: true }];
			const args2 = ['type2', 'value2', { test: true }];
			return Bluebird
				.resolve(transaction.dispatch(...args1))
				.then(() => getPendingEvents())
				.then(([event]) => {
					expect(event).to.have.property('type', args1[0]);
					expect(event).to.have.property('value', args1[1]);
					expect(event.dimensions).to.deep.equal(args1[2]);
				})
				.then(() => transaction.dispatch(...args2))
				.then(() => getPendingEvents())
				.then(([event]) => {
					expect(event).to.have.property('type', args2[0]);
					expect(event).to.have.property('value', args2[1]);
					expect(event.dimensions).to.deep.equal(args2[2]);
				});
		});
	});

	describe('data', () => {
		it('should merge common data with all subsequent events in transaction', () => {
			const common = { isCommon: true };
			const extra = { isExtra: true };
			const args1 = ['type1', 'value1', { test: true }];
			const args2 = ['type2', 'value2', { test: true }];
			transaction.data(common);
			return Bluebird
				.resolve(transaction.dispatch(...args1))
				.then(() => getPendingEvents())
				.then(([{ data }]) => {
					expect(data).to.include(common);
					expect(data).to.not.include(extra);
				})
				.then(() => transaction.data(extra))
				.then(() => transaction.dispatch(...args2))
				.then(() => getPendingEvents())
				.then(([{ data }]) => expect(data).to.include({ ...common, ...extra }));
		});
	});
});

describe('Waterfall', () => {
	const delayRange = [10, 50];
	const elements = [
		{ name: 'element.js', type: 'script' },
		{ name: 'element.css', type: 'style' },
		{ name: 'element.png', type: 'image' },
		{ name: 'load' },
		{ name: 'element.json', type: 'xhr' },
	];
	let waterfall;

	before(() => {
		createMockServer();
		try {
			// config will complain about non-optimal reportingInterval
			interceptError(() => Config(testConfig))();
		} catch (err) {/* noop */}
	});

	after(() => nock.cleanAll());

	beforeEach(() => {
		waterfall = Waterfall({ url: '/some/page' });
	});

	describe('point', () => {
		it('should enqueue a non-deferred waterfall element', () => {
			const initDelay = _.random(5, 20);
			const pointElements = _.filter(elements, ({ type }) => !type);
			return Bluebird
				.delay(initDelay)
				.then(() => {
					pointElements.forEach(waterfall.point);
					waterfall.elements.forEach((element, i) => {
						expect(element).to.not.have.property('elapsed');
						expect(element.offset).to.be.within(initDelay, initDelay * 5);
						expect(element).to.include(pointElements[i]);
					});
				});
		});
	});

	describe('span', () => {
		it('should enqueue a deferred waterfall element', () => {
			const status = 200;
			const initDelayRange = [5, 20];
			const spanElements = _.reject(elements, ({ type }) => !type);
			let offsetSum = 0;
			return Bluebird
				.mapSeries(spanElements, (spanElement) => {
					const initDelay = _.random(...initDelayRange);
					return Bluebird
						.delay(initDelay)
						.then(() => waterfall.span(spanElement))
						.tap(() => {
							const element = _.last(waterfall.elements);
							expect(element).to.include(spanElement);
							expect(element.offset).to.be.within(initDelay, initDelay * 5 + offsetSum);
							offsetSum += element.offset;
						});
				})
				.map(fn => (
					Bluebird
						.delay(_.random(...delayRange))
						.then(() => fn({ status }))
				))
				.then(() => (
					waterfall.elements.forEach((element, i) => {
						expect(element).to.include({ ...spanElements[i], status });
						expect(element.elapsed).to.be.within(delayRange[0], delayRange[1] * 5);
					})
				));
		});
	});

	describe('commit', () => {
		it('should dispatch a waterfall event', () => {
			const status = 200;
			const initDelayRange = [5, 20];
			return Bluebird
				.mapSeries(elements, element => (
					Bluebird
						.delay(_.random(...initDelayRange))
						.then(() => (
							element.type
								? waterfall.span(element)
								: (waterfall.point(element) && _.noop)
						))
				))
				.map(fn => (
					Bluebird
						.delay(_.random(...delayRange))
						.then(() => fn({ status }))
				))
				.then(() => waterfall.commit())
				.then(() => getPendingEvents())
				.then(([event]) => {
					expect(event).to.have.property('type', 'waterfall');
					expect(event.value).to.have.length(elements.length);
					let lastOffset = 0;
					event.value.forEach((element, i) => {
						if (element.type) {
							expect(element).to.include({ ...elements[i], status });
						} else {
							expect(element).to.include(elements[i]);
						}
						expect(element.offset).to.be.at.least(lastOffset);
						lastOffset = element.offset;
					});
				});
		});
	});
});

describe('Helpers', () => {
	describe('once', () => {
		it('should create a function that is only called once', () => {
			const spy = sinon.spy(_.identity);
			const fn = helpers.once(spy);
			expect(fn(1)).to.equal(1);
			expect(fn(2)).to.equal(1);
			expect(spy.callCount).to.equal(1);
		});

		it('should allow function to be called again if function.reset is called', () => {
			const spy = sinon.spy(_.identity);
			const fn = helpers.once(spy);
			expect(fn(1)).to.equal(1);
			fn.reset();
			expect(fn(2)).to.equal(2);
			expect(spy.callCount).to.equal(2);
		});
	});
});

describe('MockWeakSet', () => {
	const iterable = [{ n: 1 }, { n: 2 }, { n: 3 }];
	const set = new MockWeakSet(iterable);

	it('should accept an iterable', () => {
		expect(set).to.include(...iterable);
	});

	it('should throw a TypeError given an invalid value', () => {
		[0, null, undefined, true, 'string'].forEach((value) => {
			expect(() => new MockWeakSet([value])).to.throw(TypeError);
			expect(() => new MockWeakSet().add(value)).to.throw(TypeError);
		});
	});

	it('should support WeakSet.has', () => {
		iterable.forEach((value, i) => {
			expect(set.has(iterable[i])).to.equal(true);
		});
	});

	it('should support WeakSet.add', () => {
		const value = { n: 4 };
		set.add(value);
		expect(set.has(value)).to.equal(true);
	});

	it('should support WeakSet.delete', () => {
		const value = { n: 5 };
		set.add(value);
		expect(set.has(value)).to.equal(true);
		set.delete();
		set.delete(value);
		expect(set.has(value)).to.equal(false);
	});
});

describe('Stack', () => {
	it('should handle objects, arrays, and functions that return either', () => {
		const object = { message: 'event1' };
		const array = [{ message: 'event2' }, { message: 'event3' }];
		const fnObject = () => ({ message: 'event4' });
		const fnArray = () => [{ message: 'event5' }, { message: 'event6' }];
		const expected = _.range(1, 7).map(n => ({ message: `event${n}` }));
		const stack = Stack();

		stack.put(object);
		stack.put(array);
		stack.put(fnObject);
		stack.put(fnArray);
		expect(stack.flush(null)).to.eql(expected);
		expect(stack.flush(null)).to.have.length(0);
	});

	it('should honor maxChunkSize', () => {
		const chunkSize = 10;
		const stack = Stack();
		const input = _.range(0, chunkSize * 2);

		input.forEach(n => stack.put(n));
		expect(stack.flush(null)).to.have.length(input.length);
		expect(stack.flush(null)).to.have.length(0);

		input.forEach(n => stack.put(n));
		expect(stack.flush(chunkSize)).to.have.length(chunkSize);
		expect(stack.flush(chunkSize)).to.have.length(input.length - chunkSize);
		expect(stack.flush(chunkSize)).to.have.length(0);
	});

	it('should account for length of result when limiting maxChunkSize', () => {
		const chunkSize = 10;
		const stack = Stack();
		const input = _.range(0, chunkSize).map(() => _.range(0, chunkSize));

		input.forEach(n => stack.put(n));

		for (let i = 0; i < chunkSize; i++) {
			expect(stack.flush(chunkSize)).to.have.length(chunkSize);
		}

		expect(stack.flush(chunkSize)).to.have.length(0);
	});
});
