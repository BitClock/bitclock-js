import _ from 'lodash';
import sinon from 'sinon';
import fetch from 'isomorphic-fetch';
import Bluebird from 'bluebird';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import intercept from 'intercept-stdout';
import stripAnsi from 'strip-ansi';

import { start, stop } from './server';
import { config, report, tic, toc } from '../lib/index';
import Stack from '../lib/stack';

chai.use(sinonChai);

const BUCKET_ID = 'cc6e1624-5b2c-524d-81ef-d11e61fc14d5';

let unhook = _.noop;

before(() => {
	unhook = intercept((txt) => {
		if (/(^|\W)(error|warning):(\W|$)/i.test(stripAnsi(txt))) {
			throw new Error(txt);
		}
	});
});

after(() => unhook());

describe('bitclock', () => {
	describe('config', () => {
		it('should set config values', () => {
			expect(config().bucket).to.equal(null);
			config({ bucket: BUCKET_ID });
			expect(config().bucket).to.equal(BUCKET_ID);
		});

		it('should throw an error given an invalid reportingInterval', () => {
			expect(() => config({ reportingInterval: null })).to.throw(Error);
			expect(() => config({ reportingInterval: 1 })).to.throw(Error);
			expect(() => config({ reportingInterval: 300.5 })).to.throw(Error);
		});
	});

	describe('tic', () => {
		it('log a warning if label is falsy', () => {
			expect(() => tic()).to.throw(/warning/i);
			expect(() => tic('')).to.throw(/warning/i);
			expect(() => tic(0)).to.throw(/warning/i);
			expect(() => tic(null)).to.throw(/warning/i);
			expect(() => tic(false)).to.throw(/warning/i);
		});

		it('log a warning if label is not a string', () => {
			expect(() => tic(1)).to.throw(/warning/i);
			expect(() => tic({})).to.throw(/warning/i);
			expect(() => tic(true)).to.throw(/warning/i);
		});
	});

	describe('toc', () => {
		const tmp = config();
		const reportingInterval = 200;
		const reportingEndpoint = 'http://localhost:3000';

		before(() => {
			config({ reportingInterval, reportingEndpoint });
			return start();
		});

		after(() => {
			config(tmp);
			return stop();
		});

		it('should log a warning if the label does not exist', () => {
			expect(() => toc('invalid')).to.throw(/warning/i);
		});

		it('should enqueue an event created with tic', () => {
			const tests = _.map([1, 2, 3], (n) => {
				return Bluebird
					.resolve(tic(`test${n}`))
					.delay(_.random(1, reportingInterval))
					.then(() => toc(`test${n}`));
			});

			return Bluebird
				.all(tests)
				.delay(reportingInterval + 50)
				.then(() => fetch(`${reportingEndpoint}/events`))
				.then(res => res.json())
				.then((events) => {
					expect(events).to.have.length.gte(tests.length);
					events.forEach((event) => {
						expect(event.elapsed).to.be.within(1, reportingInterval + 50);
					});
				});
		});
	});

	describe('report', () => {
		const tmp = config();
		const reportingInterval = 200;
		const reportingEndpoint = 'http://localhost:3000';

		before(() => {
			config({ reportingInterval, reportingEndpoint });
			return start();
		});

		after(() => {
			config(tmp);
			return stop();
		});

		it('should not block promise chains when the server fails to respond', () => {
			const tStart = Date.now();
			return Bluebird
				.resolve(report({ message: 'timeout' }))
				.then(() => expect(Date.now() - tStart).to.be.at.most(100))
				.delay(1000);
		});

		it('should enqueue and send events in series', () => {
			const event1 = { message: 'event1' };
			const event2 = { message: 'event2' };
			return Bluebird
				.resolve(report(event1))
				.delay(reportingInterval + 50)
				.then(() => fetch(`${reportingEndpoint}/events`))
				.then(res => res.json())
				.then(([event]) => expect(event).to.eql(event1))
				.then(() => report(event2))
				.delay(reportingInterval + 50)
				.then(() => fetch(`${reportingEndpoint}/events`))
				.then(res => res.json())
				.then(([event]) => expect(event).to.eql(event2));
		});
	});
});

describe('Stack', () => {
	it('should wait for promises to resolve when flushing', () => {
		const count = 5;
		const interval = 100;
		const start = Date.now();
		const spy = sinon.spy();
		const stack = Stack();

		for (let i = 0; i < 5; i++) {
			stack.put(() => {
				return Bluebird
					.delay(interval)
					.tap(spy)
					.then(() => {
						expect(Date.now() - start).to.be.at.least((i + 1) * interval);
					});
			});
		}

		return stack
			.flush()
			.then(() => expect(spy).to.have.callCount(count));
	});
});
