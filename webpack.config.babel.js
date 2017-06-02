import { resolve as resolvePath } from 'path';
import {
	optimize,
	BannerPlugin,
	DefinePlugin,
	NormalModuleReplacementPlugin,
	ProvidePlugin
} from 'webpack';

import pkg from './package.json';

const banner = `${pkg.name} - ${pkg.version} - ${new Date().toISOString()}`;

export default {
	context: __dirname,
	entry: resolvePath('lib', 'index.js'),
	output: {
		path: resolvePath('build'),
		library: pkg.name,
		libraryTarget: 'umd',
		filename: `${pkg.name}.js`
	},
	resolve: {
		alias: {
			'package.json': resolvePath('./build/package.json')
		}
	},
	module: {
		loaders: [{
			test: /\.js$/,
			loader: 'babel-loader',
			exclude: /node_modules/
		}, {
			test: /\.json$/,
			loader: 'json-loader'
		}]
	},
	plugins: [
		new DefinePlugin({ process: { browser: true } }),
		new ProvidePlugin({ Promise: 'wee-promise' }),
		new NormalModuleReplacementPlugin(/package\.json/i, (resource) => {
			resource.request = '../build/package.json';
		}),
		new optimize.UglifyJsPlugin({
			comments: false,
			compress: { warnings: false }
		}),
		new BannerPlugin({ banner, entryOnly: true })
	]
};
