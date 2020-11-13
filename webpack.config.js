"use strict";

const path = require("path");

module.exports = {
  entry: {
    api: {
      import: "./sdk/api.js",
      library: {name: "ABP", type: "umd"}
    },
    content: "./sdk/content.js"
  },
  output: {
    filename: "abp-[name].js",
    path: path.resolve(__dirname, "dist")
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
