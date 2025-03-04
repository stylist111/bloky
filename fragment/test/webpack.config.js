/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from "path";
import url from "url";
import GenerateJsonPlugin from "generate-json-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const mochaCssPath = require.resolve("mocha/mocha.css");

const baseManifest = {
  name: "Fragments Test Extension",
  version: "1.0.0",
  description: "Extension for testing fragments",
  permissions: [
    "alarms",
    "contextMenus",
    "declarativeNetRequestWithHostAccess",
    "idle",
    "notifications",
    "scripting",
    "storage",
    "tabs",
    "unlimitedStorage",
    "webNavigation",
    "webRequest",
  ],
  content_scripts: [
    {
      matches: ["https://*/*"],
      js: ["examplePreload.js"],
      run_at: "document_end",
      all_frames: false,
    },
  ],
  options_ui: {
    page: "index.html",
    open_in_tab: true,
  },
};

export default (env = {}) => {
  const isManifestV3 = env.manifest === "v3";

  const manifest = {
    ...baseManifest,
    manifest_version: isManifestV3 ? 3 : 2,
    background: isManifestV3
      ? { service_worker: "background.js", type: "module" }
      : { scripts: ["background.js"] },
    host_permissions: isManifestV3 ? ["<all_urls>"] : undefined,
    permissions: isManifestV3
      ? baseManifest.permissions
      : [...baseManifest.permissions, "<all_urls>"],
  };

  return {
    mode: "development",
    entry: {
      background: "./test-extension/src/background.js",
      examplePreload: "@eyeo-fragments/example/content",
      suites: ["./suites.js"],
    },
    output: {
      path: path.resolve(
        dirname,
        "test-extension",
        "dist",
        isManifestV3 ? "mv3" : "mv2",
      ),
      filename: "[name].js",
      clean: true,
      chunkFormat: "module",
    },
    devtool: "inline-source-map",
    plugins: [
      new GenerateJsonPlugin("manifest.json", manifest, null, 2),
      new CopyWebpackPlugin({
        patterns: [
          { from: "test-extension/src/index.html", to: "index.html" },
          { from: "test-extension/src/start-tests.js", to: "start-tests.js" },
          { from: mochaCssPath },
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: "pre",
          use: ["source-map-loader"],
        },
      ],
    },
    watchOptions: {
      ignored: ["**/dist", "**/node_modules"],
    },
  };
};
