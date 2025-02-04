/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

import { expect } from "expect";

import {
  getEyeometryDataChromium,
  getEyeometryDataFirefox
} from "@eyeo/test-utils/extension";

export default () => {
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
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    const data = await getEyeometryDataChromium();

    expect(data).toEqual(
      expect.objectContaining({
        firstPing: expect.any(String),
        lastPing: expect.any(String),
        lastPingTag: expect.any(String),
        ucid: expect.any(String)
      })
    );
  });

  it("does not send the request in Firefox", async function () {
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    const data = await getEyeometryDataFirefox();
    expect(data).toEqual(null);
  });
};
