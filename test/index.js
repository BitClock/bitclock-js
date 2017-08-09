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

import { config, Transaction, Waterfall } from '../lib/index';
import { stack as requestStack } from '../lib/fetch-queue';
import { MockWeakSet } from '../lib/weak-set';
import * as helpers from '../lib/helpers';
import Stack from '../lib/stack';

if (!('BITCLOCK_TOKEN' in process.env)) {
	process.env.BITCLOCK_TOKEN = Math.random().toString(16);
}

const testConfig = Object.freeze({
	...config(),
	bucket: uuid.v4(),
	reportingInterval: 1,
	reportingEndpoint: 'http://localhost:3000',
	token: process.env.BITCLOCK_TOKEN
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
	const {
		reportingEndpoint,
		reportingAPIVersion,
		bucket,
		token
	} = testConfig;
	const events = [];
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
			const { authorization: [authorization] } = this.req.headers;
			if (authorization.indexOf(token) === -1) {
				failWith(new Error('Missing token'));
			} else {
				events.push(...chunk);
				cb(null, [200, { chunk, total: events.length }]);
			}
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

describe('bitclock', () => {
	describe('config', () => {
		it('should read config from __SECRET_BITCLOCK_CONFIG_JSON', () => {
			const secretConfigJSON = JSON.parse(process.env.__SECRET_BITCLOCK_CONFIG_JSON);
			expect(Object.keys(secretConfigJSON)).to.have.length.above(0);
			expect(config()).to.include(secretConfigJSON);
		});

		it('should not throw an error when __SECRET_BITCLOCK_CONFIG_JSON is undefined', () => {
			const { __SECRET_BITCLOCK_CONFIG_JSON } = process.env;
			const cachedConfigModule = require.cache[require.resolve('../lib/config')];

			delete process.env.__SECRET_BITCLOCK_CONFIG_JSON;
			delete require.cache[require.resolve('../lib/config')];
			expect(require('../lib/config').default.fromJSON).to.equal(undefined);

			Object.assign(process.env, { __SECRET_BITCLOCK_CONFIG_JSON });
			require.cache[require.resolve('../lib/config')] = cachedConfigModule;
		});

		it('should set config values', () => {
			expect(config().bucket).to.equal(null);
			config({ bucket: testConfig.bucket });
			expect(config().bucket).to.equal(testConfig.bucket);
		});

		it('should throw an error given an invalid reportingInterval', () => {
			expect(() => config({ reportingInterval: null })).to.throw(Error);
			expect(() => config({ reportingInterval: -1 })).to.throw(Error);
			expect(() => config({ reportingInterval: 300.5 })).to.throw(Error);
			expect(() => config({ reportingInterval: Infinity })).to.throw(Error);
		});

		it('should log a warning given a non-optimal reportingInterval', () => {
			expect(interceptError(() => config({ reportingInterval: 30 }))).to.throw(/warning/i);
			expect(interceptError(() => config({ reportingInterval: 60000 }))).to.throw(/warning/i);
		});

		it('should throw an error given an invalid maxChunkSize', () => {
			expect(() => config({ maxChunkSize: null })).to.throw(Error);
			expect(() => config({ maxChunkSize: 0 })).to.throw(Error);
			expect(() => config({ maxChunkSize: -1 })).to.throw(Error);
			expect(() => config({ maxChunkSize: 10.5 })).to.throw(Error);
			expect(() => config({ maxChunkSize: Infinity })).to.throw(Error);
		});

		it('should log a warning given a non-optimal maxChunkSize', () => {
			expect(interceptError(() => config({ maxChunkSize: 1 }))).to.throw(/warning/i);
			expect(interceptError(() => config({ maxChunkSize: 3000 }))).to.throw(/warning/i);
		});

		it('should suppress all logger output when silent is true', () => {
			expect(interceptError(() => {
				config({
					maxChunkSize: 1,
					debug: true,
					silent: true
				});
			}))
			.to.not.throw(/warning/i);
			config({ debug: false, silent: false });
		});
	});

	describe('Transaction', () => {
		let transaction;

		before(() => {
			createMockServer();
			try {
				// config will complain about non-optimal reportingInterval
				interceptError(() => config(testConfig))();
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

				return getPendingEvents().then(([{ transactionId, timestamp, ...other }]) => {
					expect(other.bool).to.equal(false);
					expect(other.proxy).to.deep.equal({});
					expect(other).to.include(_.omit(circular, 'circular'));
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
				config({ bucket: 'timeout' });
				const tStart = Date.now();
				return Bluebird
					.resolve(transaction.dispatch('timeout', null, { test: true }))
					.then(() => expect(Date.now() - tStart).to.be.at.most(100))
					.then(() => getPendingEvents())
					.finally(() => config({ bucket: testConfig.bucket }));
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
					.then(([event]) => {
						expect(event).to.include(common);
						expect(event).to.not.include(extra);
					})
					.then(() => transaction.data(extra))
					.then(() => transaction.dispatch(...args2))
					.then(() => getPendingEvents())
					.then(([event]) => expect(event).to.include({ ...common, ...extra }));
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
				interceptError(() => config(testConfig))();
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

	describe('getToken', () => {
		let document;
		let configToken;
		let envToken;
		let cookieString;
		let testToken;
		let testCookieString;

		// getToken is memoized so we need a fresh require for each test
		let getToken;

		before(() => {
			({ document } = _.defaults(global, { document: {} }));
			configToken = config().token;
			envToken = process.env.BITCLOCK_TOKEN;
			cookieString = document.cookie;
		});

		beforeEach(() => {
			delete require.cache[require.resolve('../lib/helpers')];
			({ getToken } = require('../lib/helpers'));
			testToken = uuid.v4();
			testCookieString = `_test1=2.1494212681.1494212681; BITCLOCK_TOKEN=${testToken}; _test2=2.1494212681.1494212681;`;
			process.env.BITCLOCK_TOKEN = undefined;
			config({ token: undefined });
		});

		afterEach(() => {
			config({ token: configToken });
			process.env.BITCLOCK_TOKEN = envToken;
			document.cookie = cookieString;
		});

		after(() => {
			delete global.document;
		});

		it('should not cache falsy values', () => {
			expect(getToken()).to.equal(undefined);
			process.env.BITCLOCK_TOKEN = testToken;
			expect(getToken()).to.equal(testToken);
		});

		it('should get the token from config', () => {
			config({ token: testToken });
			expect(getToken()).to.equal(testToken);
		});

		it('should get the token from process.env', () => {
			process.env.BITCLOCK_TOKEN = testToken;
			expect(getToken()).to.equal(testToken);
		});

		it('should get the token from document.cookie', () => {
			document.cookie = testCookieString;
			expect(getToken()).to.equal(testToken);
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
