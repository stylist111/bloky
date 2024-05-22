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

import path from "path";
import url from "url";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));

export function getConfig(filename) {
  let inputFilepath = path.join("../../../sdk/api", filename);
  let mockedFilename = filename.replace(".js", ".mocked.js");
  let outputFilepath = path.join("../test/unit/dist", mockedFilename);

  let webpackConfig = {
    mode: "production", // preserves the names for easier debugging
    entry: path.resolve(dirname, inputFilepath),
    output: {
      filename: outputFilepath,
      library: {type: "module"}
    },
    experiments: {
      outputModule: true
    },
    resolve: {
      alias: {
        "adblockpluscore": path.resolve(dirname, "./adblockpluscore"),
        "./initializer.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./core.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./types.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./filters.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./io.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./dnr-filters.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./prefs.js": path.resolve(dirname, "./prefs.mock.js"),
        "./sitekey.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "./cdp.js": path.resolve(dirname, "./webext-sdk.mock.js"),
        "io$": path.resolve(dirname, "../../../sdk/api/io.js"),
        "info$": path.resolve(dirname, "../../../sdk/api/info.js"),
        "prefs$": path.resolve(dirname, "./prefs.mock.js")
      }
    },
    optimization: {
      minimize: false
    },
    externals: {
      perf_hooks: path.resolve(dirname, "./perf_hooks.mock.js")
    }
  };
  return {
    outputFilepath: "../dist/" + mockedFilename,
    webpackConfig
  };
}

export default (env = {}) => {
  if (!env.filename) {
    throw new Error("Pass `filename` argument to webpack, eg.:\n" +
      "npx webpack --config ./test/unit/mock/webpack.config.js --env filename=\"subscriptions.js\"");
  }
  return getConfig(env.filename).webpackConfig;
};
