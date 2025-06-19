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
import { getOptionsHandle } from "@eyeo/test-utils/extension";
import { isCheckboxPropertyEnabled } from "@eyeo/test-utils/driver";
import {
  enablePremiumProgrammatically,
  sendExtCommandInTrustedIframe,
  setPausedStateFromPopup,
  clickFilterlist,
  initOptionsFiltersTab,
  setAADefaultState,
  disablePremiumProgrammatically,
  loadPageWithTrustedIframe,
} from "../../utils/page.js";

const BT_PARTNER_URL = "https://www.accuweather.com/";
const TRUSTED_IFRAME_URL = "https://btloader.com/trustedIframe.html?o=5673795450830848";

function getCombinations() {
  const combinations = [];
  for (const premium of [true, false]) {
    for (const aa of [true, false]) {
      for (const allowlist of [true, false]) {
        combinations.push({ premium, aa, allowlist });
      }
    }
  }
  return combinations;
}

async function setExtensionState({ premium, aa, allowlist }) {
  // Set premium
  if (premium) {
    await enablePremiumProgrammatically();
  } else {
    await disablePremiumProgrammatically();
  }

  // Set Acceptable Ads
  await initOptionsFiltersTab(getOptionsHandle());
  const isEnabled = await isCheckboxPropertyEnabled("#adblockFilterList_0");
  if ((aa && !isEnabled) || (!aa && isEnabled)) {
    await clickFilterlist("acceptable_ads", "#adblockFilterList_0", aa);
    // Allow time for state to update in webext
    await driver.sleep(2000);
  }

  // Set allowlist
  await setPausedStateFromPopup(BT_PARTNER_URL, allowlist);
}

export default () => {
  const statusCombinations = getCombinations();

  after(async function () {
    // Reset to default state after the tests
    await disablePremiumProgrammatically();
    await setAADefaultState();
  });

  statusCombinations.forEach(({ premium, aa, allowlist }) => {
    const testName = `retrieves extension status - premium -> ${premium}, AA -> ${aa}, allowlisted -> ${allowlist}`;
    it(testName, async function () {
      this.timeout(60000); // Long test with many checks
      await setExtensionState({ premium, aa, allowlist });

      const trustedIframe = await loadPageWithTrustedIframe(BT_PARTNER_URL, TRUSTED_IFRAME_URL);
      const responses = await sendExtCommandInTrustedIframe(trustedIframe, "getStatus");

      expect(responses.length).toEqual(1);

      let resp = responses[0];
      expect(resp.error).toBeUndefined();

      const expectedAllowlist = allowlist
        ? { status: true, origin: "popup", expiresAt: expect.any(Number) }
        : { status: false };

      const expected = {
        requestId: expect.stringMatching(/\S/),
        name: extension.flattrName,
        version: extension.version,
        result: {
          aa,
          allowlist: expectedAllowlist,
          license: premium ? expect.any(String) : null,
        },
      };

      try {
        expect(resp).toMatchObject(expected);
      } catch (e) {
        const retryResponses = await sendExtCommandInTrustedIframe(trustedIframe, "getStatus");
        [resp] = retryResponses;
        expect(resp).toMatchObject(expected);
      }

      if (allowlist) {
        expect(resp.result.allowlist.origin).toEqual("popup");
        expect(resp.result.allowlist.expiresAt).toBeLessThanOrEqual(
          Date.now() + 1000 * 60 * 60 * 24 * 7,
        );
        expect(resp.result.allowlist.expiresAt).toBeGreaterThan(
          Date.now() + 1000 * 60 * 60 * 24 * 7 - 1000 * 60 * 10,
        );
      }
    });
  });
};
