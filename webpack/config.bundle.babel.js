import { optimize, ProvidePlugin } from 'webpack';

import extendBaseConfig from './config.base.babel';

export default extendBaseConfig({
	entry: {
		'bitclock.min': require.resolve('../lib')
	},
	output: {
		libraryTarget: 'umd'
	},
	plugins: [
		new ProvidePlugin({ Promise: 'es6-promise' }),
		new optimize.UglifyJsPlugin({
			comments: false,
			compress: { warnings: false }
		})
	],
	module: {
		loaders: [{
			test: /\.js$/,
			use: 'babel-loader',
			exclude: {
				test: /node_modules/,
				not: [/whatwg-fetch/]
			}
		}]
	}
});
