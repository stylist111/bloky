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
  sendExtCommandInTrustedIframe,
  loadPageWithTrustedIframe,
  callUIExperimentsAPI
} from "../../utils/page.js";

export const BT_PARTNER_URL = "https://www.accuweather.com/";
export const TRUSTED_IFRAME_URL =
  "https://btloader.com/trustedIframe.html?o=5673795450830848";

export default () => {
  let trustedIframe;

  function assertIframeResponse(iframeResponse, expectedResult) {
    expect(iframeResponse.length).toEqual(1);
    expect(iframeResponse[0]).toMatchObject({
      requestId: expect.stringMatching(/\S/), // non-empty string
      name: extension.flattrName,
      version: extension.version,
      result: expectedResult
    });

    // error property should be missing
    expect(iframeResponse[0].error).toBeUndefined();
  }

  beforeEach(async function () {
    trustedIframe = await loadPageWithTrustedIframe(
      BT_PARTNER_URL,
      TRUSTED_IFRAME_URL
    );
  });

  it("retrieves experiment assignments from a trusted iframe injected into BT partner website", async function () {
    const iframeResponse = await sendExtCommandInTrustedIframe(
      trustedIframe,
      "getExperimentAssignments"
    );
    const assignments = await callUIExperimentsAPI("getAssignments");

    assertIframeResponse(iframeResponse, assignments);
  });

  it("retrieves experiment flags from a trusted iframe injected into BT partner website", async function () {
    const iframeResponse = await sendExtCommandInTrustedIframe(
      trustedIframe,
      "getExperimentFlags"
    );
    const flags = await callUIExperimentsAPI("getFlags");

    assertIframeResponse(iframeResponse, flags);
  });
};
