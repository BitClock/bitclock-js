import path from 'path';
import { BannerPlugin, DefinePlugin, NormalModuleReplacementPlugin } from 'webpack';

import pkg from '../package.json';

const banner = `${pkg.name} - ${pkg.version} - ${new Date().toISOString()}`;

export default ({ output = {}, plugins = [], module: { loaders = [] }, ...other }) => ({
	context: path.resolve(__dirname, '..'),
	output: {
		path: path.resolve(__dirname, '../dist'),
		library: pkg.name,
		filename: '[name].js',
		...output
	},
	resolve: {
		alias: {
			'package.json': path.resolve(__dirname, '../dist/package.json')
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
		...plugins,
		new BannerPlugin({ banner, entryOnly: true })
	],
	module: {
		loaders: [...loaders, {
			test: /\.json$/,
			use: 'json-loader'
		}]
	},
	...other
});
