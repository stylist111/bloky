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

const baseManifest = {
  name: "Fragments Test Extension",
  version: "1.0.0",
  description: "Extension for testing fragments",
  default_locale: "en_US",
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
      matches: ["https://*/*"],
      js: ["examplePreload.js"],
      run_at: "document_end",
      all_frames: false,
    },
    {
      matches: ["*://*.youtube.com/*"],
      js: ["ytWallDetectionPreload.js", "reverseTrialPreload.js"],
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
      : [...baseManifest.permissions, "<all_urls>"],
    optional_permissions: isManifestV3 ? ["management"] : undefined,
    web_accessible_resources: isManifestV3
      ? [{ resources: ["icons/*"], matches: ["<all_urls>"] }]
      : ["icons/*"],
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
      background: "./test-extension/src/background.js",
      examplePreload: "@eyeo-fragments/example/content",
      ytWallDetectionPreload: "@eyeo-fragments/yt-wall-detection/content",
      reverseTrialPreload: "@eyeo-fragments/reverse-trial/content",
      options: "./test-extension/src/options.js",
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
          { from: "test-extension/src/options.html", to: "options.html" },
          { from: "test-extension/src/options.js", to: "options.js" },
          { from: "test-extension/src/popup.html", to: "popup.html" },
          {
            from: "../reverse-trial/locales",
            to: "_locales",
          },
          {
            from: "../../host/adblock/icons/adblock-20.svg",
            to: "icons/adblock-20.svg",
          },
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
