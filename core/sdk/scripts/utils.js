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
import url from "url";
import path from "path";
import {exec} from "child_process";

export async function exists(filename) {
  try {
    await fs.promises.access(filename);
    return true;
  }
  catch (error) {
    return false;
  }
}

export async function readFile(filePath) {
  let contents = await fs.promises.readFile(filePath, {encoding: "utf-8"});
  return contents.trim();
}

export async function download(downloadUrl, toFile, retries = 5) {
  const proto = downloadUrl.startsWith("https") ? https : http;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.info(`Downloading ${downloadUrl} to ${toFile}${attempt > 1 ? ` (attempt ${attempt}/${retries})` : ""}`);

      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(toFile);
        let fileInfo = null;

        const request = proto.get(downloadUrl, {timeout: 60000}, response => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to get '${downloadUrl}' (${response.statusCode})`));
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

      return;
    }
    catch (err) {
      if ((err.code === "ETIMEDOUT" || err.code === "ECONNRESET") &&
          attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Check if the script was invoked directly from the CLI.
 *
 * There are some scripts that can be imported and used in other files but can
 * also be called from the CLI by the developer to run immediately. This
 * function takes the url of the file where it was called from and compares it
 * with the process running.
 *  @param {string} metaUrl - The URL of the containing document, as provided by
 * `import.meta.url`
 * @returns {boolean} True if the script was invoked directly from the CLI,
 * false otherwise.
 * @example
 * if (isMain(import.meta.url)) {
 *   main();
 * }
 *
 */
export function isMain(metaUrl) {
  let executableName = process.argv[1];
  if (fs.statSync(executableName).isSymbolicLink) {
    executableName = fs.realpathSync(executableName);
  }

  const binUrl = generateBinUrl(executableName);

  return metaUrl === binUrl;
}

function generateBinUrl(executableName) {
  let binUrl = `file://${executableName}`;
  if (process.platform.includes("win32")) {
    binUrl = `file:///${executableName.replaceAll("\\", "/")}`;
  }

  return binUrl;
}

export function projectRootPath() {
  let scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
  let projectRoot = path.join(scriptDir, "..");
  return path.normalize(projectRoot);
}

export function runCommand(command) {
  console.log(`> ${command}`);
  return new Promise((resolve, reject) => {
    let process = exec(command, error => {
      if (error) {
        reject(error);
      }
      else {
        resolve();
      }
    });
    process.stdout.on("data", data => {
      console.log(data);
    });
    process.stderr.on("data", data => {
      console.error(data);
    });
  });
}
