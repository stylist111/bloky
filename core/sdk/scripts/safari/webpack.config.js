import path from "path";
import url from "url";

import CopyPlugin from "copy-webpack-plugin";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const extensionPath = path.join(dirname, "..", "..", "test", "extension-safari");
const eweDistPath = path.join(dirname, "..", "..", "dist");
const distPath = path.join(eweDistPath, "test-safari");

export default (env = {}) => {
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
      new CopyPlugin({
        patterns: [
          {from: path.join(extensionPath, "manifest.json")},
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
