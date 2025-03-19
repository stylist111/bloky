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

import { startTestPagesServer, stopTestPagesServer } from "./test-pages-server.js";
import { startLicenseServer, stopLicenseServer } from "./test-license-server.js";
import { startIpmServer, stopIpmServer } from "./ipm-server/test-ipm-server.js";

const hostname = "localhost";

export function runTestServer() {
  startTestPagesServer(hostname);
  startLicenseServer(hostname);
  startIpmServer(hostname);
}

export async function killTestServer() {
  stopTestPagesServer();
  stopLicenseServer();
  stopIpmServer();

  // Sleep to allow stop server messages to be logged
  await new Promise((r) => setTimeout(r, 2000));
}
