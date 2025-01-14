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

import { expect } from "chai";

import { isFirefox, getFromStorage } from "../helpers.js";

export default () => {
  // 10 seconds is a safe number to assume telemetry is not enabled
  const timeout = 10000;

  // Eyeometry tests require eyeometry credentials filled in .env
  before(function () {
    if (!process.env.EYEOMETRY_BEARER) {
      // CI run
      if (process.env.CI === "true") {
        throw new Error("EYEOMETRY_BEARER environment variable is missing");
      }

      // Local run
      console.warn(
        "Eyeometry tests are skipped because EYEOMETRY_BEARER is missing"
      );
      this.skip();
    }
  });

  it("sends the request in Chrome and Edge", async function () {
    if (isFirefox()) this.skip();

    const data = await browser.waitUntil(
      async () => getFromStorage("local", "ewe:telemetry"),
      { timeout, timeoutMsg: `No storage data found after ${timeout}ms` }
    );

    expect(Object.keys(data)).to.have.members([
      "firstPing",
      "lastPing",
      "lastPingTag",
      "ucid"
    ]);
  });

  it("does not send the request in Firefox", async function () {
    if (!isFirefox()) this.skip();

    let data;
    try {
      data = await browser.waitUntil(
        async () => getFromStorage("local", "ewe:telemetry"),
        { timeout }
      );
    } catch (err) {
      if (err.name === "TimeoutError") {
        // Timeout exceeded, no telemetry data saved, all good
        return;
      }

      throw err;
    }

    // In case getFromStorage doesn't timeout, at least data should be null
    expect(data).to.be(null);
  });
};
