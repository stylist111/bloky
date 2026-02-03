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

class RemoveSourceMapPlugin {
  /**
   * @param {Object} options - Plugin options
   * @param {string|RegExp|Array<string|RegExp>} options.test - Pattern(s) to
   *   match asset names. Can be a string for exact match, a RegExp for pattern
   *   matching, or an array of strings and/or RegExps.
   */
  constructor(options = {}) {
    this.options = options;
    this.test = options.test || /\.js$/;
  }

  apply(compiler) {
    const pluginName = RemoveSourceMapPlugin.name;

    // webpack module instance can be accessed from the compiler object,
    // this ensures that correct version of the module is used
    // (do not require/import the webpack or any symbols from it directly).
    const {webpack} = compiler;
    const {Compilation, ModuleFilenameHelpers} = webpack;
    // RawSource is one of the "sources" classes that should be used
    // to represent asset sources in compilation.
    const {RawSource} = webpack.sources;

    compiler.hooks.compilation.tap(pluginName, compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: pluginName,
          // Run immediately after PROCESS_ASSETS_STAGE_DEV_TOOLING (500)
          // where webpack's devtool generates source maps. Using +1 ensures
          // the inline source map has been added before we strip it.
          stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING + 1
        },
        assets => {
          for (const assetName in assets) {
            if (!ModuleFilenameHelpers.matchPart(assetName, this.test)) {
              continue;
            }

            const asset = assets[assetName];

            // Convert Buffer to string if necessary
            const source = asset.source();
            const sourceStr = typeof source === "string" ?
              source : source.toString();

            // Remove the sourceMappingURL comment
            const newSource = sourceStr.replace(
              /\/\/# sourceMappingURL=.*/g,
              ""
            );

            // Only update if the content actually changed
            if (newSource !== sourceStr) {
              compilation.updateAsset(
                assetName,
                new RawSource(newSource)
              );
            }
          }
        }
      );
    });
  }
}

export default RemoveSourceMapPlugin;
