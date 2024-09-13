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

import {getConfig} from "./webpack.config.js";
import webpack from "webpack";
import path from "path";
import url from "url";

let dirname = path.dirname(url.fileURLToPath(import.meta.url));

let counter = 0;

/**
 * Get the module with mocked dependencies
 * @param {string} filename Production file name inside the /sdk/background
 *   directory
 * @param {string} deleteAliases The list of files to delete resolve aliases
 * @param {string} addAliases The list of files to add resolve aliases
 * @returns {Promise<Module>} newly compiled module
 */
export async function mock(filename, deleteAliases = null, addAliases = null) {
  // generate the mocked module file
  let config = getConfig(filename);
  if (deleteAliases) {
    for (let alias of deleteAliases) {
      delete config.webpackConfig.resolve.alias[alias];
    }
  }
  if (addAliases) {
    for (let alias of addAliases) {
      config.webpackConfig.resolve.alias[alias] = path.resolve(dirname, alias);
    }
  }
  await new Promise((resolve, reject) => {
    webpack(config.webpackConfig, (err, res) => {
      if (err) {
        return reject(err);
      }
      let errors = res.compilation.errors;
      if (errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(errors);
        reject(errors.join("\n"));
        return;
      }
      resolve(res);
    });
  });

  // load the module file without caching.
  // the counter trick is to avoid lazy import
  // and module state leak between the tests
  return import(config.outputFilepath + "?counter=" + counter++);
}
