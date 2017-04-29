import path from 'path';
import { BannerPlugin, optimize } from 'webpack';

import pkg from './package.json';

const banner = `${pkg.name} - ${pkg.version} - ${new Date().toISOString()}`;

export default {
	context: __dirname,
	entry: path.resolve('lib', 'index.js'),
	output: {
		path: path.resolve('build'),
		library: pkg.name,
		libraryTarget: 'umd',
		filename: `${pkg.name}.js`
	},
	module: {
		loaders: [{
			test: /package.json$/,
			exclude: /node_modules/,
			loader: 'null-loader'
		}, {
			test: /\.js$/,
			loader: 'babel-loader',
			exclude: /node_modules/
		}, {
			test: /\.json$/,
			loader: 'json-loader'
		}]
	},
	plugins: [
		new BannerPlugin({ banner, entryOnly: true }),
		new optimize.UglifyJsPlugin({
			compress: { warnings: false }
		})
	]
};
