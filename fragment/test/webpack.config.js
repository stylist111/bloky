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

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const srcPath = path.resolve(dirname, "extension");
const outPath = path.resolve(dirname, "dist", "fragments-extension");

const baseManifest = {
  name: "Fragments Test Extension",
  version: "1.0.0",
  description: "Extension for testing fragments",
  permissions: [
    "alarms",
    "contextMenus",
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
      matches: ["https://*/*", "http://*/*"],
      js: ["examplePreload.js"],
      run_at: "document_end",
      all_frames: false,
    },
    {
      matches: ["*://*.youtube.com/*"],
      js: ["ytWallDetectionPreload.js"],
      run_at: "document_start",
    },
  ],
  options_ui: {
    page: "options.html",
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
      ? [...baseManifest.permissions, "declarativeNetRequestWithHostAccess"]
      : [...baseManifest.permissions, "webRequestBlocking", "<all_urls>"],
    optional_permissions: isManifestV3 ? ["management"] : undefined,
    ...(isManifestV3
      ? {
          action: {
            default_popup: "popup.html",
          },
        }
      : {
          browser_action: {
            default_popup: "popup.html",
          },
        }),
  };

  return {
    mode: "development",
    entry: {
      background: path.resolve(srcPath, "background.js"),
      examplePreload: "@eyeo-fragments/example/content",
      ytWallDetectionPreload: "@eyeo-fragments/yt-wall-detection/content",
      options: path.resolve(srcPath, "options.js"),
    },
    output: {
      path: path.resolve(outPath, isManifestV3 ? "mv3" : "mv2"),
      filename: "[name].js",
      clean: true,
      chunkFormat: "module",
    },
    devtool: "inline-source-map",
    plugins: [
      new GenerateJsonPlugin("manifest.json", manifest, null, 2),
      new CopyWebpackPlugin({
        patterns: [
          { from: path.resolve(srcPath, "options.html"), to: "options.html" },
          { from: path.resolve(srcPath, "options.js"), to: "options.js" },
          { from: path.resolve(srcPath, "popup.html"), to: "popup.html" },
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
