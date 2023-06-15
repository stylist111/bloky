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

import http from "http";
import https from "https";
import fs from "fs";

export async function exists(filename) {
  try {
    await fs.promises.access(filename);
    return true;
  }
  catch (error) {
    return false;
  }
}

export async function download(url, toFile) {
  console.info(`Downloading ${url} to ${toFile} ...`);
  const proto = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(toFile);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers["content-type"],
        size: parseInt(response.headers["content-length"], 10)
      };

      response.pipe(file);
    });

    file.on("finish", () => resolve(fileInfo));

    request.on("error", err => {
      fs.promises.unlink(toFile)
        .finally(() => reject(err));
    });

    file.on("error", err => {
      fs.promises.unlink(toFile)
        .finally(() => reject(err));
    });

    request.end();
  });
}

/**
 * Check if the script was invoked directly from the CLI.
 *
 * There are some scripts that can be imported and used in other files but can
 * also be called from the CLI by the developer to run immediately. This
 * function takes the url of the file where it was called from and compares it
 * with the process running.
 *  @param {string} url - The URL of the containing document, as provided by
 * `import.meta.url`
 * @returns {boolean} True if the script was invoked directly from the CLI,
 * false otherwise.
 * @example
 * if (isMain(import.meta.url)) {
 *   main();
 * }
 *
 */
export function isMain(url) {
  let executableName = process.argv[1];
  if (fs.statSync(executableName).isSymbolicLink) {
    executableName = fs.realpathSync(executableName);
  }

  return url === `file://${executableName}`;
}
