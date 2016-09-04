const _ = require('lodash');
const assert = require('assert');
const Bluebird = require('bluebird');
const fetch = require('isomorphic-fetch');

module.exports = function BitClock(config) {
	assert.ok(_.isObject(config), 'config must be an object');

	const verbose = config.verbose
		|| (_.get(global, 'process.env.NODE_ENV') !== 'production');

	const validateIdentifier = _.memoize((identifier) => {
		assert.ok(identifier, 'Test identifier is required');
		assert.ok(_.isString(identifier), 'Test identifier must be a string');
	});

	return {
		tic(identifier) {
			validateIdentifier(identifier);
			console.time(identifier);
		},
		toc(identifier) {
			validateIdentifier(identifier);
			console.timeEnd(identifier);
		}
	};
};
