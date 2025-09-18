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
import {
  getOptionsHandle,
  setTimeoutForExtensionReload,
  removeAllFilters,
} from "@eyeo/test-utils/extension";
import { isCheckboxPropertyEnabled } from "@eyeo/test-utils/driver";
import {
  enablePremiumProgrammatically,
  sendExtCommandInTrustedIframe,
  setPausedStateFromPopup,
  initOptionsFiltersTab,
  isPremiumLabelPresent,
  setAADefaultState,
  clickFilterlist,
  disablePremiumProgrammatically,
  loadPageWithTrustedIframe,
  checkSubscriptionsState,
} from "../../utils/page.js";
import { BT_PARTNER_URL, TRUSTED_IFRAME_URL } from "./trusted-iframe-experiments.js";

function getCombinations() {
  const combinations = [];
  for (const premium of [false, true]) {
    for (const allowlist of [false, true]) {
      for (const aa of [true, false]) {
        combinations.push({ premium, aa, allowlist });
      }
    }
  }
  return combinations;
}

async function setExtensionState({ premium, aa, allowlist }) {
  // Set premium
  if (premium) {
    const isPremium = await isPremiumLabelPresent();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
  }
  // Set allowlist
  if (allowlist) {
    await setPausedStateFromPopup(BT_PARTNER_URL);
  }

  // Set Acceptable Ads
  await initOptionsFiltersTab(getOptionsHandle());
  const checkboxSelector = "#adblockFilterList_0";
  const name = "acceptable_ads";
  const isEnabled = await isCheckboxPropertyEnabled(checkboxSelector);

  if ((aa && !isEnabled) || (!aa && isEnabled)) {
    await clickFilterlist(name, checkboxSelector, aa);
    const regexp = isEnabled ? /Unsubscribed/ : /updated|Subscribed/;
    await checkSubscriptionsState([{ name, enabled: aa, checkboxSelector }], {
      timeout: 10000,
      regexp,
    });
  }
}

export default () => {
  const statusCombinations = getCombinations();

  after(async function () {
    setTimeoutForExtensionReload(this); // disablePremiumProgrammatically reloads extension
    // Reset to default state after the tests
    await disablePremiumProgrammatically();
    await setAADefaultState();
    await removeAllFilters();
  });

  statusCombinations.forEach(({ premium, aa, allowlist }) => {
    const testName = `retrieves extension status - premium -> ${premium}, allowlisted -> ${allowlist}, AA -> ${aa}`;
    it(testName, async function () {
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
          hasPremium: premium,
          aa,
          allowlist: expectedAllowlist,
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
        await initOptionsFiltersTab(getOptionsHandle());
        await removeAllFilters();
      }
    });
  });
};
