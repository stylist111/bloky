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

import { startSDKPagesServer, stopSDKPagesServer } from "./sdk-server/test-pages-server.js";
import { startSDKAdminServer, stopSDKAdminServer } from "./sdk-server/admin-api.js";
import { startSDKWebSocketServer, stopSDKWebSocketServer } from "./sdk-server/web-socket-server.js";

import { startHostPagesServer, stopHostPagesServer } from "./host-server/test-pages-server.js";
import {
  startHostLicenseServer,
  stopHostLicenseServer,
} from "./host-server/test-license-server.js";
import {
  startHostRemoteConfigServer,
  stopHostRemoteConfigServer,
} from "./host-server/test-remote-config-server.js";

const hostname = "localhost";

export function runHostTestServer(host = hostname) {
  startHostPagesServer(host);
  startHostLicenseServer(host);
  startHostRemoteConfigServer(host);
}

export function runSDKTestServer(host = hostname, verbose = false) {
  startSDKPagesServer(host, verbose);
  startSDKAdminServer(host, verbose);
  startSDKWebSocketServer(host);
}

export async function killHostTestServer() {
  stopHostPagesServer();
  stopHostLicenseServer();
  stopHostRemoteConfigServer();

  // Sleep to allow stop server messages to be logged
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function killSDKTestServer() {
  stopSDKPagesServer();
  stopSDKAdminServer();
  stopSDKWebSocketServer();

  // Sleep to allow stop server messages to be logged
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
