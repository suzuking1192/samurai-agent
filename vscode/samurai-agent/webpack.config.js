//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [
          /node_modules/,
          /\.test\.ts$/,
          /\.spec\.ts$/,
          /__tests__/,
          /src\/__tests__/,
          /src\/.*\/__tests__/
        ],
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.POSTHOG_API_KEY': JSON.stringify('phc_SI6Y1k394rhcmxMWUxWNxKrkksMLmTPKIGNPirJnICn'),
      'process.env.POSTHOG_HOST': JSON.stringify('https://us.i.posthog.com')
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'agent', 'prompts', '**', '*.md'),
          to: path.resolve(__dirname, 'dist', 'prompts', '[path][name][ext]'),
          context: path.resolve(__dirname, 'src', 'agent', 'prompts'),
          noErrorOnMissing: true
        },
        {
          from: path.resolve(__dirname, 'src', 'webview', '*.{js,css,html}'),
          to: path.resolve(__dirname, 'dist', 'webview', '[name][ext]'),
          noErrorOnMissing: true
        },
        {
          from: path.resolve(__dirname, 'src', 'webview', '*.{js,css,html}'),
          to: path.resolve(__dirname, 'out', 'webview', '[name][ext]'),
          noErrorOnMissing: true
        }
      ]
    }),
    new HtmlWebpackPlugin({
      filename: 'dist/chat.html',
      template: path.resolve(__dirname, 'src', 'webview', 'chat.html'),
      chunks: ['chat']
    }),
    new HtmlWebpackPlugin({
      filename: 'out/webview/chat.html',
      template: path.resolve(__dirname, 'src', 'webview', 'chat.html'),
      chunks: ['chat']
    })
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
module.exports = [ extensionConfig ];