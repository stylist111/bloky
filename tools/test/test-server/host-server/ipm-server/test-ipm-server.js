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
import { getResponseData, getResponseDataForCommand } from "./response-data.js";

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

let ipmResponseData = {
  statusCode: 200,
  body: "<html><body>Default IPM response</body></html>",
};

export const port = 3007;

const server = createServer((req, res) => {
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", async () => {
    try {
      if (req.url === "/setIPMResponse" && req.method === "POST") {
        ipmResponseData = await getResponseDataForCommand(data);

        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ message: "IPM response set successfully!" }));
      } else if (req.url === "/ipm") {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = ipmResponseData.statusCode;
        res.end(ipmResponseData.body);
      } else {
        // Handle other requests (e.g., serving index.html)
        if (req.url === "/") {
          try {
            const responseData = getResponseData(singleObjectMode);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = responseData.statusCode;
            res.end(responseData.body);
          } catch (error) {
            console.log("error", error);
          }
        } else {
          res.statusCode = 404;
          res.end("Not Found");
        }
      }
    } catch (error) {
      console.error("Error processing request:", error);
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON or request processing error" }));
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
    console.log(`Host IPM server listening at http://${hostname}:${port}`);
  });
}

export function startHostIpmServer(hostname) {
  start(hostname);
}

export function stopHostIpmServer() {
  server.close(function (err) {
    if (err) {
      throw err;
    }
    console.log("Host IPM server closed");
  });
}
