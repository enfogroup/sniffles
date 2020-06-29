const path = require('path'),
  { ESBuildPlugin } = require('esbuild-loader')

module.exports = {
  devtool: false,
  entry: {
    index: './src/index.ts',
  },
  mode: 'production',
  resolve: {
    symlinks: false,
    extensions: [ '.js', '.json', '.ts' ],
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
  },
  target: 'node',
  plugins: [ new ESBuildPlugin() ],
  module: {
    rules: [
      {
        test: /\.[jt]s$/,
        loader: 'esbuild-loader',
        options: {
          target: 'es2018',
          sourceMap: false,
        },
      },
    ],
  },
}
