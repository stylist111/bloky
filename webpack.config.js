/* eslint-env node */

import path from "path";
import url from "url";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default {
  entry: {
    api: {
      import: "./sdk/api/index.js",
      library: {name: "ABP", type: "umd"}
    },
    content: "./sdk/content/index.js"
  },
  output: {
    filename: "abp-[name].js",
    path: path.resolve(dirname, "dist")
  },
  mode: "production",
  optimization: {
    // We no not want to minimize our code.
    minimize: false
  },
  performance: {
    hints: false
  },
  resolve: {
    alias: {
      io$: path.resolve(dirname, "./sdk/api/io.js"),
      prefs$: path.resolve(dirname, "./sdk/api/prefs.js"),
      info$: path.resolve(dirname, "./sdk/api/info.js")
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
  },
  externals: {
    perf_hooks: "self"
  }
};
