import { optimize } from 'webpack';

import extendBaseConfig from './config.base.babel';

export default extendBaseConfig({
	entry: {
		'bitclock.min': require.resolve('../lib')
	},
	output: {
		libraryTarget: 'umd'
	},
	plugins: [
		new optimize.UglifyJsPlugin({
			comments: false,
			compress: { warnings: false }
		})
	]
});
