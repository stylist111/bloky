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
import fs from "fs";

import TerserPlugin from "terser-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import GenerateJsonPlugin from "generate-json-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));
let templateDir = path.join(dirname, "test", "template.html");
const eweRegularConfigName = "sdk";
const eweCustomConfigName = "sdk-subs";
const eweDistPath = path.join(dirname, "dist");
const eweRegularOutputPath = eweDistPath;
const eweCustomOutputPath = path.join(eweDistPath, "ewe-subs");
const eweRegularSubscriptionsFile = "custom-subscriptions.json";
const eweTestSubscriptionsFile = "test/custom-subscriptions.json";
const subscriptionsDir = path.join(dirname, "subscriptions");
const fragmentFile = path.join(subscriptionsDir, "rules.json.tpl");

const base = {
  eweConfigName: eweRegularConfigName,
  ewePath: eweRegularOutputPath
};

// Canonical Manifest V2
const mv2 = {
  ...base,
  manifestVersion: 2,
  background: {scripts: ["ewe-api.js", "background.js"]},
  permissions: ["webRequestBlocking", "<all_urls>"],
  misc: {
    /* nothing */
  },
  outputPath: "test-mv2"
};

// Canonical Manifest V3
const mv3 = {
  ...base,
  manifestVersion: 3,
  background: {service_worker: "background.js"},
  permissions: ["scripting", "declarativeNetRequest"],
  misc: {
    host_permissions: ["<all_urls>"],
    ...fs.existsSync(fragmentFile) ?
      {declarative_net_request: JSON.parse(
        fs.readFileSync(fragmentFile, "utf8"))} :
      {}
  },
  outputPath: "test-mv3"
};

// Manifest V2 + customs subscriptions list file
const mv2Custom = {
  ...mv2,
  eweConfigName: eweCustomConfigName,
  ewePath: eweCustomOutputPath,
  outputPath: "test-mv2-custom"
};

function eweBuild(env, configName, subscriptionFile, silent, outputPath) {
  let build = {
    name: configName,
    entry: {
      api: {
        import: "./sdk/api/index.js",
        library: {name: "EWE", type: "umd"}
      },
      content: "./sdk/content/index.js"
    },
    output: {
      filename: "ewe-[name].js",
      path: outputPath,
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
  };

  let customSubsFile = path.resolve(dirname, subscriptionFile);
  if (fs.existsSync(customSubsFile)) {
    if (!silent)
      console.warn(`Using custom subscriptions file (${customSubsFile})`);
    build.resolve.alias["../data/subscriptions.json"] = customSubsFile;
  }

  return build;
}

export default (env = {}) => {
  if (fs.existsSync(eweDistPath))
    fs.rmSync(eweDistPath, {recursive: true});

  let builds = [
    eweBuild(env, eweRegularConfigName, eweRegularSubscriptionsFile,
             false, eweRegularOutputPath),
    eweBuild(env, eweCustomConfigName, eweTestSubscriptionsFile,
             true, eweCustomOutputPath)
  ];

  for (let buildVariant of [mv2, mv3, mv2Custom]) {
    let description = `Manifest version: ${buildVariant.manifestVersion}`;
    if (buildVariant.eweConfigName == eweCustomConfigName)
      description = `${description} - custom subscriptions`;

    let manifest = {
      name: "eyeo's Web Extension Ad Blocking Toolkit Test Extension",
      version: "0.0.1",
      description,
      manifest_version: buildVariant.manifestVersion,
      background: buildVariant.background,
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
        ...buildVariant.permissions
      ],
      ...buildVariant.misc
    };

    builds.push({
      dependencies: [buildVariant.eweConfigName],
      mode: "development",
      entry: {
        functional: path.join(dirname, "test", "functional.js"),
        reload: path.join(dirname, "test", "reload-wrap.js")
      },
      output: {
        path: path.resolve(dirname, "dist", buildVariant.outputPath),
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
          title: "Functional tests",
          filename: "functional.html",
          inject: "body",
          chunks: ["functional"],
          template: templateDir
        }),
        new HtmlWebpackPlugin({
          title: "Reload tests",
          filename: "reload.html",
          inject: "body",
          chunks: ["reload"],
          template: templateDir
        }),
        new MiniCssExtractPlugin(),
        new GenerateJsonPlugin("manifest.json", manifest, null, 2),
        new CopyPlugin({
          patterns: [
            {from: "ewe-*", context: buildVariant.ewePath},
            {from: path.join(dirname, "test", "background.js")},
            {from: path.join(dirname, "test", "index.html")},
            {from: path.join(dirname, "test", "index-options.js")},
            ...buildVariant.manifestVersion >= 3 &&
               fs.existsSync(subscriptionsDir) &&
               fs.readdirSync(subscriptionsDir)
                .filter(file => file.endsWith(".json"))
                .length > 0 ?
                  [{from: path.join(subscriptionsDir, "*.json")}] :
                  []
          ]
        })
      ],
      watchOptions: {
        ignored: ["**/dist", "**/node_modules"]
      }
    });
  }

  return builds;
};
