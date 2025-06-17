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

import HtmlWebpackPlugin from "html-webpack-plugin";
import GenerateJsonPlugin from "generate-json-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import Dotenv from "dotenv-webpack";
import {createRequire} from "module";
import {default as events} from "./events.js";

const require = createRequire(import.meta.url);

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const extensionFunctionalPath = path.join(dirname, "test", "extension-functional");
const extensionPerformancePath = path.join(dirname, "test", "extension-performance");
const template = path.join(extensionFunctionalPath, "template.html");
const eweConfigName = "engine";
const eweCustomConfigName = "engine-subs";
const eweSlowPerformanceConfigName = "engine-slow";
const eweDistPath = path.join(dirname, "dist");
const eweCustomOutputPath = path.join(eweDistPath, "ewe-subs");
const eweSlowPerformanceOutputPath = path.join(eweDistPath, "ewe-slow");
const scriptsOutputPath = path.join(dirname, "scriptsOutput");
const scriptsOutputMV3Path = path.join(dirname, "scriptsOutput", "test-mv3");
const customMV2SubscriptionsPath = path.join(scriptsOutputPath, "custom-mv2-subscriptions.json");
const scriptsOutputPerformancePath = path.join(dirname, "scriptsOutput", "performance-mv3");
const rulesetsMV3Path = path.join(scriptsOutputMV3Path, "rulesets", "rulesets.json");
const rulesetsPerformancePath = path.join(scriptsOutputPerformancePath, "rulesets", "rulesets.json");
const packageJsonPath = path.join(dirname, "package.json");
const pollingPath = path.join(dirname, "test", "polling.js");

// Strangely, snippets module only exports index.mjs if you import it using ESM
// imports, but require.resolve is getting the CJS module path. Snippets does
// export package.json to all module systems. If we update to Node v20.6.0 or
// newer, we can replace this with import.meta.resolve.
const snippetsPath = path.join(
  require.resolve("@eyeo/snippets/package.json"),
  "..",
  "index.mjs"
);
const mochaCssPath = require.resolve("mocha/mocha.css");

// Canonical Manifest V2
const mv2 = {
  eweConfigName: eweCustomConfigName,
  ewePath: eweCustomOutputPath,
  manifestVersion: 2,
  background: {scripts: ["ewe-api.js", "background.js"]},
  permissions: ["webRequestBlocking", "<all_urls>"],
  misc: {
    /* nothing */
  },
  options: {
    open_in_tab: true,
    page: "options.html"
  },
  outputPath: "test-mv2"
};

const performanceMV2 = {
  ...mv2,
  eweConfigName,
  ewePath: eweDistPath,
  background: {scripts: ["ewe-api.js", "background.js", "snippets.js",
                         "polling.js"]},
  options: null,
  outputPath: "performance-mv2",
  performance: true
};

// Canonical Manifest V3
const mv3 = {
  eweConfigName,
  ewePath: eweDistPath,
  manifestVersion: 3,
  background: {service_worker: "background.js"},
  permissions: [
    "declarativeNetRequest"
  ],
  misc: {
    host_permissions: ["<all_urls>"],
    minimum_chrome_version: "124",
    ...fs.existsSync(rulesetsMV3Path) ?
      {
        declarative_net_request: JSON.parse(
          fs.readFileSync(rulesetsMV3Path, "utf8"))
      } :
      {}
  },
  options: {
    open_in_tab: true,
    page: "options.html"
  },
  outputPath: "test-mv3"
};

const performanceMV3 = {
  ...mv3,
  misc: {
    host_permissions: ["<all_urls>"],
    minimum_chrome_version: "124",
    ...fs.existsSync(rulesetsPerformancePath) ?
      {
        declarative_net_request: JSON.parse(
          fs.readFileSync(rulesetsPerformancePath, "utf8"))
      } :
      {}
  },
  outputPath: "performance-mv3",
  options: null,
  performance: true
};

const slowPerformanceMV3 = {
  ...performanceMV3,
  eweConfigName: eweSlowPerformanceConfigName,
  ewePath: eweSlowPerformanceOutputPath,
  outputPath: "slow-performance-mv3",
  slow: true
};

function commonPlugins() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  process.env.VERSION = packageJson.version;

  return [
    // This replaces the webpackDotenvPlugin object in our code with values
    // from your environment variables at build time.
    new Dotenv({
      systemvars: true,
      prefix: "webpackDotenvPlugin."
    })
  ];
}

function eweBuild(env, configName, subscriptionFile, silent, outputPath,
                  dependencies) {
  const content = configName === "engine-slow" ?
    "./src/content/slow-performance-index.js" : "./src/content/index.js";

  let build = {
    name: configName,
    dependencies,
    entry: {
      "api": {
        import: [
          "./src/background/browser-polyfill.js",
          "./src/background/index.js"
        ],
        library: {name: "EWE", type: "umd"}
      },
      content,
      "ui": {
        import: "./src/ui/index.js",
        library: {name: "EWE", type: "umd"}
      },
      "content-api": {
        import: "./src/content/api/index.js",
        library: {name: "EWE", type: "umd"}
      }
    },
    output: {
      filename: "ewe-[name].js",
      path: outputPath,
      clean: true
    },
    optimization: {
      minimize: false
    },
    // This has to be inline-source-map for debugging the content script to
    // work, since the .js.map file isn't web accessible.
    devtool: "inline-source-map",
    performance: {
      hints: false
    },
    resolve: {
      alias: {
        io$: path.resolve(dirname, "./src/background/io.js"),
        prefs$: path.resolve(dirname, "./src/background/prefs.js"),
        info$: path.resolve(dirname, "./src/background/info.js")
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
      new GenerateJsonPlugin("package.json", {type: "commonjs"}, null, 2),
      new GenerateJsonPlugin("events.json", events, null, 2),
      ...commonPlugins()
    ]
  };

  if (env.release) {
    // "testing.js" API should not be exposed publicly
    let testingJsPath = path.resolve(dirname, "./src/background/testing.js");
    let testingJsStubPath = path.resolve(dirname, "./src/background/testing-stub.js");
    build.module.rules[0].exclude = [testingJsPath];
    build.resolve.alias["./testing.js"] = testingJsStubPath;
  }

  if (subscriptionFile) {
    let customSubsFile = path.resolve(dirname, subscriptionFile);
    if (fs.existsSync(customSubsFile)) {
      if (!silent) {
        console.warn(`Using custom subscriptions file (${customSubsFile})`);
      }
      build.resolve.alias["../data/subscriptions.json"] = customSubsFile;
    }
  }

  return build;
}

export default (env = {}) => {
  let builds = [
    eweBuild(env, eweConfigName, null, false, eweDistPath),
    eweBuild(env, eweCustomConfigName, customMV2SubscriptionsPath, true,
             eweCustomOutputPath, [eweConfigName]),
    eweBuild(env, eweSlowPerformanceConfigName, null, false,
             eweSlowPerformanceOutputPath, [eweConfigName])
  ];

  for (let buildVariant of [
    mv2, mv3, performanceMV2, performanceMV3, slowPerformanceMV3
  ]) {
    let description = `Manifest version: ${buildVariant.manifestVersion}`;

    const contentScripts = [
      {
        all_frames: true,
        js: ["ewe-content.js"],
        match_about_blank: true,
        matches: ["http://*/*", "https://*/*"],
        run_at: "document_start"
      }
    ];

    if (buildVariant.performance) {
      description = `${description} - performance`;
    }
    else {
      contentScripts.push({
        all_frames: true,
        js: ["ewe-content-api-test.js"],
        matches: ["http://*/experiments-content-api.html", "https://*/experiments-content-api.html"],
        run_at: "document_start"
      });
    }

    let manifest = {
      name: "eyeo's WebExtension Ad-Filtering Solution Test Extension",
      short_name: "EWE Test",
      version: "0.0.1",
      description,
      manifest_version: buildVariant.manifestVersion,
      background: buildVariant.background,
      options_ui: buildVariant.options,
      content_scripts: contentScripts,
      permissions: [
        "webNavigation", "webRequest", "scripting", "storage",
        "unlimitedStorage", "tabs",
        ...buildVariant.permissions
      ],
      ...buildVariant.misc
    };

    let plugins = [
      new HtmlWebpackPlugin({
        title: "Functional tests",
        filename: "functional.html",
        inject: "body",
        chunks: ["functional"],
        template
      }),
      new HtmlWebpackPlugin({
        title: "Reload tests",
        filename: "reload.html",
        inject: "body",
        chunks: ["reload"],
        template
      }),
      new HtmlWebpackPlugin({
        title: "Update tests",
        filename: "update.html",
        inject: "body",
        chunks: ["update"],
        template
      }),
      new HtmlWebpackPlugin({
        title: "MV2 MV3 migrate tests",
        filename: "mv2-mv3-migrate.html",
        inject: "body",
        chunks: ["migrate"],
        template
      }),
      new GenerateJsonPlugin("manifest.json", manifest, null, 2),
      new CopyPlugin({
        patterns: [
          {from: "ewe-*", context: buildVariant.ewePath},
          {from: path.join(extensionFunctionalPath, "background.js")},
          {from: path.join(extensionFunctionalPath, "index.html")},
          {from: path.join(extensionFunctionalPath, "options.html")},
          {from: path.join(extensionFunctionalPath, "index-options.js")},
          {from: path.join(extensionFunctionalPath, "sentry-test.html")},
          {from: path.join(extensionFunctionalPath, "sentry-test.js")},
          {from: path.join(extensionFunctionalPath, "experiments-test.html")},
          {from: path.join(extensionFunctionalPath, "experiments-test.js")},
          {from: path.join(extensionFunctionalPath, "telemetry-test.html")},
          {from: path.join(extensionFunctionalPath, "telemetry-test.js")},
          ...buildVariant.manifestVersion >= 3 &&
          fs.existsSync(scriptsOutputMV3Path) ?
            [{from: scriptsOutputMV3Path}] : [],
          {from: mochaCssPath}
        ]
      }),
      ...commonPlugins()
    ];

    if (buildVariant.performance) {
      plugins = [
        new GenerateJsonPlugin("manifest.json", manifest, null, 2),
        new CopyPlugin({
          patterns: [
            {from: "ewe-*", context: buildVariant.ewePath},
            {from: path.join(extensionPerformancePath, "background.js")},
            {from: path.join(extensionPerformancePath, "status.html")},
            {from: path.join(extensionPerformancePath, "status.js")},
            ...buildVariant.manifestVersion >= 3 &&
            fs.existsSync(scriptsOutputPerformancePath) ?
              [{from: scriptsOutputPerformancePath}] : []
          ]
        })];
    }

    builds.push({
      name: buildVariant.outputPath,
      dependencies: [buildVariant.eweConfigName],
      mode: "development",
      entry: buildVariant.performance ? {
        snippets: {
          import: snippetsPath,
          library: {name: "snippets", type: "umd"}
        },
        polling: {
          import: pollingPath,
          library: {name: "polling", type: "umd"}
        }
      } : {
        "functional": path.join(extensionFunctionalPath, "functional.js"),
        "reload": path.join(extensionFunctionalPath, "reload-wrap.js"),
        "update": path.join(extensionFunctionalPath, "update-wrap.js"),
        "migrate": path.join(extensionFunctionalPath, "migrate-wrap.js"),
        "ewe-content-api-test": path.join(extensionFunctionalPath, "ewe-content-api-test.js")
      },
      output: {
        path: path.resolve(dirname, "dist", buildVariant.outputPath),
        clean: true
      },
      optimization: {
        minimize: false
      },
      devtool: "inline-source-map",
      plugins,
      watchOptions: {
        ignored: ["**/dist", "**/node_modules"]
      }
    });
  }

  return builds;
};
