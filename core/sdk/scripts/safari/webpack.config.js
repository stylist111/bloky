import path from "path";
import url from "url";
import fs from "fs/promises";

import CopyPlugin from "copy-webpack-plugin";
import webpack from "webpack";

const {BannerPlugin} = webpack;

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const extensionPath = path.join(dirname, "..", "..", "test", "extension-safari");
const sdkSrcPath = path.join(dirname, "..", "..", "src", "background");
const eweDistPath = path.join(dirname, "..", "..", "dist");
const distPath = path.join(eweDistPath, "test-safari");

// Path to the early polyfill code to inject at the very start of the bundle
const earlyPolyfillPath = path.join(sdkSrcPath, "safari-polyfill-early.cjs");

export default async(env = {}) => {
  const earlyPolyfillCode = await fs.readFile(earlyPolyfillPath, "utf8");

  return {
    mode: "production",
    output: {
      filename: "background.js",
      path: distPath
    },
    optimization: {
      minimize: false
    },
    devtool: "inline-source-map",
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
      // CRITICAL: Inject Safari polyfills at the VERY START of the bundle
      // This must run before webextension-polyfill (bundled in SDK) caches
      // chrome.* APIs
      new BannerPlugin({
        banner: earlyPolyfillCode,
        raw: true, // Don't wrap in comment
        entryOnly: true
      }),
      new CopyPlugin({
        patterns: [
          {from: path.join(extensionPath, "manifest.json")},
          {from: path.join(extensionPath, "popup", "popup.html")},
          {from: path.join(extensionPath, "popup", "popup.js")},
          {from: path.join(extensionPath, "images"), to: path.join(distPath, "images")},
          {from: path.join(extensionPath, "rulesets"), to: path.join(distPath, "rulesets")},
          {from: path.join(extensionPath, "_locales"), to: path.join(distPath, "_locales")},
          {from: path.join(extensionPath, "subscriptions"), to: path.join(distPath, "subscriptions")},
          {from: path.join(eweDistPath, "ewe-content.js")}
        ]
      })
    ],
    // Avoids size warning
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000
    }
  };
};
