/*global require: false, module: false, __dirname: false */
'use strict';
var HtmlWebpackPlugin = require('html-webpack-plugin');
var webpack = require('webpack');
var path = require('path');

var htmlPlugin = process.argv.indexOf('--disable-html-plugin') === -1 ?
	[new HtmlWebpackPlugin({
		title: "UCSC Xena",
		filename: "index.html",
		template: "page.template"
	})] : [];

module.exports = {
	historyApiFallback: true,
	entry: "./js/bogorouter",
	output: {
		path: __dirname + "/build",
		publicPath: "../",
		filename: "[name].js"
	},
	devServer: {
		host: "localhost",
		publicPath: '/',
		proxy: {
			'/api/**': {
				changeOrigin: true,
				target: 'https://xenabrowser.net/api',
				// For local django dev, use this instead & remove changeOrigin.
				//target: 'http://localhost:8000/',
				pathRewrite: {'^/api': ''}
			}
		}
	},
	module: {
		loaders: [
			{ test: /loadXenaQueries.js$/, loader: "val" },
			{ test: /\.xq$/, loader: "raw" },
			{ test: /pdfkit|png-js/, loader: "transform?brfs" },
			{
				test: /\.js$/,
				include: [
					path.join(__dirname, 'js'),
					path.join(__dirname, 'test'),
					path.join(__dirname, 'doc')
				],
				loaders: ['babel-loader'],
				type: 'js'},
			{ test: /\.css$/, loader: "style!css" },
			{ test: /\.json$/, loader: "json" },
			{ test: /\.(jpe?g|png|gif|svg|eot|woff2?|ttf)$/i, loaders: ['url?limit=10000'] }
		]
	},
	plugins: htmlPlugin.concat([
		new webpack.OldWatchingPlugin()
	]),
	resolve: {
		fallback: path.join(__dirname, "node_modules"),
		alias: {
			'redboxOptions': path.join(__dirname, 'redboxOptions.json'),
			'redux-devtools': path.join(__dirname, 'js/redux-devtool-shim')
		},
		extensions: ['', '.js', '.json', '.coffee']
	}
};
