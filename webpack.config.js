const path = require('path');

module.exports = {
  entry: './sdk/api.js',
  output: {
    filename: 'sdk-background.js',
    path: path.resolve(__dirname, 'dist'),
  },
  optimization: {
    // We no not want to minimize our code.
    minimize: false
  }
};