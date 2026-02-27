/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { expect } from "expect";

import { findUrl } from "@eyeo/test-utils/driver";
import { uninstallExtension } from "@eyeo/test-utils/extension";

import { initOptionsGeneralTab } from "../../utils/page.js";
import { uninstallUrl } from "../../utils/urls.js";

export default () => {
  it("uninstalls the extension", async function () {
    let expectedParams;

    if (browserDetails.browserName === "firefox") {
      expectedParams = {
        av: extension.version,
        rcid: expect.stringMatching(/^[a-f0-9-]{36}$/), // single-use rotating client ID (UUID v4)
      };
    } else {
      expectedParams = {
        av: extension.version,
        bc: expect.any(Number),
        lt: expect.any(Number),
        t: expect.any(Number),
        wafc: "0", // always 0 as we don't do that anymore
        aa: expect.stringMatching(/(u|0|1|2)/),
        ps: expect.stringMatching(/(0|1)/),
        er: expect.stringMatching(/^([a-zA-Z0-9+/,_=]{8}|null)$/), // experiments revision ID. Example: ietbCO3H
        ev: expect.stringMatching(/^[a-zA-Z0-9+/]+=*/), // experiments variants. Example: AQ%3D%3
        ca: expect.stringMatching(/^[a-zA-Z0-9+/]+=*/), // cohort assignments. Example: AQ%3D%3
        rcid: expect.stringMatching(/^[a-f0-9-]{36}$/), // rotating client ID (UUID v4)
      };
    }

    await uninstallExtension(initOptionsGeneralTab);
    const { url } = await findUrl(uninstallUrl);

    const params = new URLSearchParams(new URL(url).search);
    const actualParams = Object.fromEntries(params);

    if (typeof actualParams.bc !== "undefined") {
      actualParams.bc = parseInt(actualParams.bc, 10);
    }

    if (typeof actualParams.lt !== "undefined") {
      actualParams.lt = parseInt(actualParams.lt, 10);
    }

    if (typeof actualParams.t !== "undefined") {
      actualParams.t = parseInt(actualParams.t, 10);
    }

    expect(actualParams).toEqual(expectedParams);
  });
};
