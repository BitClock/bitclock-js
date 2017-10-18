import { ProvidePlugin } from 'webpack';
import nodeExternals from 'webpack-node-externals';

import extendBaseConfig from './config.base.babel';

export default extendBaseConfig({
	node: {
		process: false
	},
	entry: {
		bitclock: require.resolve('../lib')
	},
	output: {
		libraryTarget: 'commonjs2'
	},
	externals: [
		'process',
		nodeExternals({
			whitelist: [
				'isomorphic-fetch',
				'whatwg-fetch'
			]
		})
	],
	plugins: [
		new ProvidePlugin({ process: 'process' })
	]
});
