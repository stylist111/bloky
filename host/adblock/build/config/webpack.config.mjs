/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import path from "path";

const tmplLoaderPath = path.resolve("build", "utils", "wp-template-loader.cjs");

export default {
  optimization: {
    minimize: false,
  },
  output: {
    path: path.resolve(""),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        resolve: {
          fullySpecified: false,
        },
        enforce: "pre",
        use: ["source-map-loader"],
      },
      {
        test: /\.css$/,
        resourceQuery: "",
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              url: false,
            },
          },
          "postcss-loader",
        ],
      },
      {
        test: /\.(css|html)$/,
        resourceQuery: /text/,
        type: "asset/source",
      },
      {
        test: /\.(svg|woff2|woff)$/,
        resourceQuery: /uri/,
        type: "asset/inline",
      },
    ],
  },
  node: {
    global: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(""),
      "~": path.resolve("", "./adblock-betafish/"),
      events$: "events.js",
      punycode$: "punycode.js",
      url$: "url.js",
      prefs$: path.resolve("", "./adblock-betafish/alias/prefs.js"),
      "./prefs.js": path.resolve("", "./adblock-betafish/alias/prefs.js"),
      "../../../adblockpluschrome/lib/prefs": path.resolve("", "./adblock-betafish/alias/prefs.js"),
      "./options": "../../adblock-betafish/alias/options.js",
      "../../lib/pages/options.js": "../../../adblock-betafish/alias/options.js",
      "./icon": "../../adblock-betafish/alias/icon.js",
      subscriptionInit: "../../adblock-betafish/alias/subscriptionInit.js",
      uninstall: "../../adblock-betafish/alias/uninstall.js",
    },
    modules: ["adblockplusui/adblockpluschrome/lib", "build/templates", "node_modules"],
  },
  resolveLoader: {
    alias: {
      "wp-template-loader": tmplLoaderPath,
    },
  },
};
