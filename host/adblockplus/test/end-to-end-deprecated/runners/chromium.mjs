/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import { isHeadlessArg } from "./helpers.mjs";

const options = {
  args: [
    "--no-sandbox",
    "--window-size=1400,1000",
    "--disable-search-engine-choice-screen",
    // EXT-497: we need to bind "testpages.eyeo.com" to "localhost"
    // to be able to test with locally hosted page.
    "--ignore-certificate-errors",
    "--host-resolver-rules=MAP testpages.eyeo.com 127.0.0.1"
  ]
};

// If the browser should run in headless mode, add the headless flag
if (isHeadlessArg()) {
  options.args.push("--headless=new");
}

/**
 * The Chromium capabilities object for the browser.
 * @type {object}
 */
export const capabilities = {
  browserName: "chromium",
  "goog:chromeOptions": options,
  acceptInsecureCerts: true,
  exclude: ["./tests/legacy-unit.js"]
};

/**
 * The Edge capabilities object for the browser.
 * @type {object}
 */
export const edgeCapabilities = {
  browserName: "MicrosoftEdge",
  "ms:edgeOptions": options,
  acceptInsecureCerts: true,
  exclude: ["./tests/test-issue-reporter.js", "./tests/legacy-unit.js"]
};

// On Docker, sometimes `Error: End of central directory not found` appears
// when WDIO runs the edgedriver script. Setting the edgedriver binary path
// as a workaround. `EDGDEDRIVER_PATH` is set in `Dockerfile`.
if (process.env.EDGDEDRIVER_PATH) {
  edgeCapabilities["wdio:edgedriverOptions"] = {
    binary: process.env.EDGDEDRIVER_PATH
  };
}
