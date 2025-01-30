import path from "path";
import url from "url";
import GenerateJsonPlugin from "generate-json-webpack-plugin";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default (env = {}) => {
  const isManifestV3 = env.manifest === "v3";

  const manifest = isManifestV3
    ? {
        name: "Fragments Test Extension",
        version: "1.0.0",
        description: "Extension for testing fragments",
        manifest_version: 3,
        background: {
          service_worker: "background.js",
        },
        permissions: ["storage", "scripting"],
        host_permissions: ["<all_urls>"],
        content_scripts: [
          {
            matches: ["https://*/*"],
            js: ["examplePreload.js"],
            run_at: "document_end",
            all_frames: false,
          },
        ],
      }
    : {
        name: "Fragments Test Extension",
        version: "1.0.0",
        description: "Extension for testing fragments",
        manifest_version: 2,
        background: {
          scripts: ["background.js"],
        },
        permissions: ["storage", "<all_urls>"],
        content_scripts: [
          {
            matches: ["https://*/*"],
            js: ["examplePreload.js"],
            run_at: "document_end",
            all_frames: false,
          },
        ],
      };

  return {
    mode: env.production ? "production" : "development",
    entry: {
      background: "./src/background.js",
      examplePreload: "@eyeo-fragments/example/content"
    },
    output: {
      path: path.resolve(dirname, "dist", isManifestV3 ? "mv3" : "mv2"),
      filename: "[name].js",
      clean: true,
    },
    devtool: env.production ? "source-map" : "inline-source-map",
    plugins: [
      new GenerateJsonPlugin("manifest.json", manifest, null, 2),
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
