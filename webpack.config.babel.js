import path from 'path';
import {
	optimize,
	BannerPlugin,
	DefinePlugin,
	NormalModuleReplacementPlugin
} from 'webpack';

import pkg from './package.json';

const banner = `${pkg.name} - ${pkg.version} - ${new Date().toISOString()}`;

export default {
	context: __dirname,
	entry: {
		bitclock: path.resolve('./lib'),
		'bitclock.min': path.resolve('./lib')
	},
	output: {
		path: path.resolve('dist'),
		library: pkg.name,
		libraryTarget: 'umd',
		filename: '[name].js'
	},
	resolve: {
		alias: {
			'package.json': path.resolve('./dist/package.json')
		}
	},
	plugins: [
		new DefinePlugin({
			'process.browser': true,
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
		}),
		new NormalModuleReplacementPlugin(/package\.json/i, (resource) => {
			resource.request = '../dist/package.json';
		}),
		new optimize.UglifyJsPlugin({
			include: /\.min\.js$/,
			comments: false,
			compress: { warnings: false }
		}),
		new BannerPlugin({ banner, entryOnly: true })
	],
	module: {
		loaders: [{
			test: /\.js$/,
			use: 'babel-loader',
			exclude: {
				test: /node_modules/,
				not: [/whatwg-fetch/]
			}
		}, {
			test: /\.json$/,
			use: 'json-loader'
		}]
	}
};
