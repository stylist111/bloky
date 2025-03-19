/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable no-console */

import { createServer } from "http";
import { createReadStream } from "fs";
import { getResponseData } from "./response-data.js";

/**
 * Script command-line argument that swtiches the server into legacy
 * single command object mode
 */
const singleObjectKey = "--single-object";
/**
 * Server response mode:
 * - if false (default), the response will be an array containing
 *   either a single or multiple commands
 * - if true (legacy), the response will be a single command object
 */
let singleObjectMode = false;

export const port = 3007;

const server = createServer((req, res) => {
  createReadStream("index.html").pipe(res);
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", () => {
    try {
      console.log("request received", JSON.parse(data));
      const { device } = JSON.parse(data);

      const responseData = getResponseData(device.device_id, singleObjectMode);

      res.setHeader("Content-Type", "application/json");
      res.statusCode = responseData.statusCode;
      res.end(responseData.body);
    } catch (error) {
      // Unexpected end of JSON input
      console.log("error", error);
    }
  });
});

/**
 * Initializes server module
 */
function start(hostname) {
  const { argv } = process;

  // checks if the reponse should be a legacy single command object
  if (argv.includes(singleObjectKey)) {
    singleObjectMode = true;
    console.log("Legacy command server response as a single object is activated");
  }

  server.listen(port, hostname, () => {
    console.log(`IPM server listening at http://${hostname}:${port}`);
  });
}

export function startIpmServer(hostname) {
  start(hostname);
}

export function stopIpmServer() {
  server.close(function (err) {
    if (err) {
      throw err;
    }
    console.log("IPM server closed");
  });
}
