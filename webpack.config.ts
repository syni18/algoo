// webpack.config.ts
import path from 'path';
import type { Configuration } from 'webpack';

const config: Configuration = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'node',
  entry: './src/server.ts',
  output: {
    filename: 'server.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Clean the output directory before emit
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'inline-source-map',
  optimization: {
    minimize: false, // Typically backend code is not minimized
  },
  externalsPresets: { node: true }, // Leave Node.js built-ins external
};

export default config;
