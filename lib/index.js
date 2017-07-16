import CONFIG from './config';

let exportMain;

if (!process.browser && CONFIG.__resolvedModule) {
	try {
		require.resolve(CONFIG.__resolvedModule);
		exportMain = CONFIG.__resolvedModule;
	} catch (err) {/* noop */}
}

module.exports = require(
	(process.browser || !exportMain) ? './main' : exportMain
);
