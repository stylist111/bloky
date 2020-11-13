"use strict";

const path = require("path");

module.exports = {
  entry: "./sdk/api.js",
  output: {
    filename: "sdk-background.js",
    path: path.resolve(__dirname, "dist"),
    library: "ABP",
    libraryTarget: "umd"
  },
  optimization: {
    // We no not want to minimize our code.
    minimize: false
  },
  performance: {
    hints: false
  },
  resolve: {
    alias: {
      io$: path.resolve(__dirname, "./sdk/io.js")
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: "pre",
        use: ["source-map-loader"]
      }
    ]
  }
};
