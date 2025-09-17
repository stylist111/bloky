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

import ipmScenarios from "./ipm-scenarios.js";

export const port = 3008;

let responseData = null;

const server = createServer((req, res) => {
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", async () => {
    try {
      if (req.method === "POST" && req.url === "/setIpmScenario") {
        responseData = ipmScenarios[data] || null;

        res.statusCode = 200;
        res.end();
        return;
      }

      if (req.url === "/remote-config") {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            schemaId: "1",
            experiments: [],
            ipmCommands: responseData || [],
          }),
        );
        return;
      }

      res.statusCode = 404;
      res.end("Not Found");
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
  server.listen(port, hostname, () => {
    console.log(`Host remote config server listening at http://${hostname}:${port}`);
  });
}

export function startHostRemoteConfigServer(hostname) {
  start(hostname);
}

export function stopHostRemoteConfigServer() {
  server.close(function (err) {
    if (err) {
      throw err;
    }
    console.log("Host remote config server closed");
  });
}
