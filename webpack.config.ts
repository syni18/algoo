import path from 'path';
import { fileURLToPath } from 'url';
import { Configuration } from 'webpack';
import nodeExternals from 'webpack-node-externals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: Configuration = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'node',
  entry: './src/server.ts',
  output: {
    filename: 'server.cjs',
    path: path.resolve(__dirname, 'bundle'),
    clean: true,
    library: {
      type: 'commonjs2', // optional but safer for Node ESM + require interop
    },
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
  externalsPresets: { node: true }, // ignore built-ins like fs, path, crypto
  externals: [nodeExternals()], // ignore all node_modules (dotenv, pg, express, etc.)
  devtool: process.env.NODE_ENV === 'production' ? false : 'inline-source-map',
  optimization: {
    minimize: false,
  },
};

export default config;
