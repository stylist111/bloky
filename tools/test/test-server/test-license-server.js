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

import http from "http";

export const port = 3006;

const VALID_USER_ID = "valid_user_id";
const EXPIRED_USER_ID = "expired_user_id";
const SERVER_ERROR_302 = "server_error_302";
const SERVER_ERROR_418 = "server_error_418";
const SERVER_ERROR_500 = "server_error_500";
const NON_JSON_RESPONSE = "non_json_response";
const WRONG_LICENSE_STATUS = "wrong_license_status";
const WRONG_LICENSE_VERSION = "wrong_license_version";

const server = http.createServer((req, res) => {
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", () => {
    try {
      const jsonData = JSON.parse(data);
      console.log("request received", jsonData);
      const { cmd, u, v } = jsonData;

      res.setHeader("Content-Type", "application/json");

      if (cmd !== "license_check" || v !== "1") {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            message: "server error",
          }),
        );
      }
      if (u === VALID_USER_ID) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            lv: 1,
            status: "active",
            code: "license_code",
          }),
        );
      } else if (u === EXPIRED_USER_ID) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            lv: 1,
            status: "expired",
            code: "",
          }),
        );
      } else if (u === SERVER_ERROR_302) {
        res.statusCode = 302;
        res.end(
          JSON.stringify({
            message: "server error 302",
          }),
        );
      } else if (u === SERVER_ERROR_418) {
        res.statusCode = 418;
        res.end(
          JSON.stringify({
            message: "server error 418",
          }),
        );
      } else if (u === SERVER_ERROR_500) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            message: "server error 500",
          }),
        );
      } else if (u === NON_JSON_RESPONSE) {
        res.statusCode = 200;
        res.end(NON_JSON_RESPONSE);
      } else if (u === WRONG_LICENSE_VERSION) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            lv: 2,
            status: "active",
            code: "license_code",
          }),
        );
      } else if (u === WRONG_LICENSE_STATUS) {
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            lv: 1,
            status: "wrong_status",
            code: "license_code",
          }),
        );
      } else {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            message: "invalid user",
          }),
        );
      }
    } catch (error) {
      // Unexpected end of JSON input
      console.log("License server error", error);
    }
  });
});

export function startLicenseServer(hostname) {
  server.listen(port, hostname, () => {
    console.log(`License server listening at http://${hostname}:${port}`);
  });
}

export function stopLicenseServer() {
  server.close(function (err) {
    if (err) {
      throw err;
    }
    console.log("License server closed");
  });
}
