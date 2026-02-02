const path = require('path');
const Dotenv = require('dotenv-webpack');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'node', // VS Code extensions run in a Node.js-context
  mode: 'none', // We will set this in package.json scripts
  
  entry: './src/extension.ts', // The entry point
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]'
  },
  
  externals: {
    'vscode': 'commonjs vscode' // Ignored because it's provided by the VS Code host
  },
  
  resolve: {
    extensions: ['.ts', '.js']
  },
  
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  
  plugins: [
    new Dotenv() // This will load .env and replace process.env.VARS in code
  ],
  
  devtool: 'source-map', // Best practice for production
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
