import path from 'path';
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
	entry: path.resolve('lib', 'index.js'),
	output: {
		path: path.resolve('dist'),
		library: pkg.name,
		libraryTarget: 'umd',
		filename: `${pkg.name}.js`
	},
	resolve: {
		alias: {
			'package.json': path.resolve('./dist/package.json')
		}
	},
	module: {
		loaders: [{
			test: /\.js$/,
			use: 'babel-loader',
			exclude: /node_modules/
		}, {
			test: /\.json$/,
			use: 'json-loader'
		}]
	},
	plugins: [
		new DefinePlugin({
			'process.browser': true,
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
		}),
		new ProvidePlugin({ Promise: 'wee-promise' }),
		new NormalModuleReplacementPlugin(/package\.json/i, (resource) => {
			resource.request = '../dist/package.json';
		}),
		new optimize.UglifyJsPlugin({
			comments: false,
			compress: { warnings: false }
		}),
		new BannerPlugin({ banner, entryOnly: true })
	]
};
