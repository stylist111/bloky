/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-env node */

import path from "path";
import url from "url";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default (env = {}) => ({
  entry: {
    api: {
      import: "./sdk/api/index.js",
      library: {name: "EWE", type: "umd"}
    },
    content: "./sdk/content/index.js"
  },
  output: {
    filename: "ewe-[name].js",
    path: path.resolve(dirname, "dist")
  },
  mode: env.release ? "production" : "development",
  optimization: {
    minimize: !!env.release
  },
  devtool: env.release ? "source-map" : "inline-source-map",
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
});
