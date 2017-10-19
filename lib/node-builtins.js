if (!process.browser) {
	const { createHash, randomBytes } = require('crypto');

	exports.Buffer = Buffer;
	exports.createHash = createHash;
	exports.randomBytes = randomBytes;
}
