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

import TerserPlugin from "terser-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import GenerateJsonPlugin from "generate-json-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));
let templateDir = path.join(dirname, "test", "template.html");

export default (env = {}) => {
  let builds = [{
    name: "sdk",
    entry: {
      api: {
        import: "./sdk/api/index.js",
        library: {name: "EWE", type: "umd"}
      },
      content: "./sdk/content/index.js"
    },
    output: {
      filename: "ewe-[name].js",
      path: path.resolve(dirname, "dist"),
      clean: true
    },
    mode: env.release ? "production" : "development",
    optimization: {
      minimize: !!env.release,
      minimizer: [new TerserPlugin({extractComments: false})]
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
    plugins: [
      new GenerateJsonPlugin("package.json", {type: "commonjs"}, null, 2)
    ],
    externals: {
      perf_hooks: "self"
    }
  }];

  for (let manifestVersion of [2, 3]) {
    let manifest = {
      name: "eyeo's Web Extension Ad Blocking Toolkit Test Extension",
      version: "0.0.1",
      description: `Manifest version: ${manifestVersion}`,
      manifest_version: manifestVersion,
      background: manifestVersion >= 3 ?
          {service_worker: "background.js"} :
          {scripts: ["ewe-api.js", "background.js"]},
      content_scripts: [
        {
          all_frames: true,
          js: ["ewe-content.js"],
          match_about_blank: true,
          matches: ["http://*/*", "https://*/*"],
          run_at: "document_start"
        }
      ],
      permissions: [
        "webNavigation", "webRequest", "storage", "unlimitedStorage", "tabs",
        ...manifestVersion >= 3 ? ["scripting", "declarativeNetRequest"] :
                                  ["webRequestBlocking", "<all_urls>"]
      ],
      ...manifestVersion >= 3 ? {host_permissions: ["<all_urls>"]} : {}
    };

    builds.push({
      dependencies: ["sdk"],
      mode: "development",
      entry: {
        unit: path.join(dirname, "test", "unit.js"),
        reload: path.join(dirname, "test", "reload-wrap.js")
      },
      output: {
        path: path.resolve(dirname, "dist", `test-mv${manifestVersion}`),
        clean: true
      },
      optimization: {
        minimize: false
      },
      devtool: "inline-source-map",
      module: {
        rules: [
          {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, "css-loader"]
          }
        ]
      },
      plugins: [
        new HtmlWebpackPlugin({
          title: "Unit tests",
          filename: "unit.html",
          inject: "body",
          chunks: ["unit"],
          template: templateDir
        }),
        new HtmlWebpackPlugin({
          title: "Reload test",
          filename: "reload.html",
          inject: "body",
          chunks: ["reload"],
          template: templateDir
        }),
        new MiniCssExtractPlugin(),
        new GenerateJsonPlugin("manifest.json", manifest, null, 2),
        new CopyPlugin({
          patterns: [
            {from: "ewe-*", context: path.join(dirname, "dist")},
            {from: path.join(dirname, "test", "background.js")},
            {from: path.join(dirname, "test", "index.html")},
            {from: path.join(dirname, "test", "index-options.js")}
          ]
        })
      ]
    });
  }

  return builds;
};
