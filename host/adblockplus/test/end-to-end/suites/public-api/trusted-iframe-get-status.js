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
  getOptionsHandle,
  removeAllFilters,
  setTimeoutForExtensionReload
} from "@eyeo/test-utils/extension";
import { isCheckboxPropertyEnabled } from "@eyeo/test-utils/driver";
import {
  enablePremiumProgrammatically,
  sendExtCommandInTrustedIframe,
  setPausedStateFromPopup,
  setAADefaultState,
  disablePremiumProgrammatically,
  initOptionsGeneralTab,
  isPremiumLabelPresent,
  clickFLCheckboxAndCheck,
  loadPageWithTrustedIframe
} from "../../utils/page.js";
import {
  BT_PARTNER_URL,
  TRUSTED_IFRAME_URL
} from "./trusted-iframe-experiments.js";

function getCombinations() {
  const combinations = [];
  for (const premium of [false, true]) {
    for (const allowlist of [false, true]) {
      for (const aa of [false, true]) {
        combinations.push({ premium, aa, allowlist });
      }
    }
  }
  return combinations;
}

async function setExtensionState({ premium, aa, allowlist }) {
  // Set premium
  if (premium) {
    const premiumAlreadyEnabled = await isPremiumLabelPresent();
    if (!premiumAlreadyEnabled) {
      await enablePremiumProgrammatically();
    }
  }

  // Set allowlist
  if (allowlist) {
    await setPausedStateFromPopup(BT_PARTNER_URL);
  }
  // Set Acceptable Ads
  await initOptionsGeneralTab(getOptionsHandle());
  if (!aa) {
    await clickFLCheckboxAndCheck("#acceptable-ads-allow", {
      enable: false,
      name: "Acceptable Ads"
    });
  }
  const newAaState = await isCheckboxPropertyEnabled("#acceptable-ads-allow");
  expect(newAaState).toEqual(aa);
}

export default () => {
  const statusCombinations = getCombinations();

  afterEach(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await setAADefaultState();
    await removeAllFilters();
  });

  after(async function () {
    await disablePremiumProgrammatically();
  });

  statusCombinations.forEach(({ premium, allowlist, aa }) => {
    const testName = `retrieves extension status - premium -> ${premium}, allowlisted -> ${allowlist}, AA -> ${aa}`;
    it(testName, async function () {
      setTimeoutForExtensionReload(this); // setExtensionState reloads extension
      await setExtensionState({ premium, allowlist, aa });
      const trustedIframe = await loadPageWithTrustedIframe(
        BT_PARTNER_URL,
        TRUSTED_IFRAME_URL
      );
      const responses = await sendExtCommandInTrustedIframe(
        trustedIframe,
        "getStatus"
      );

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
          license: premium ? expect.any(String) : null
        }
      };

      try {
        expect(resp).toMatchObject(expected);
      } catch (e) {
        const retryResponses = await sendExtCommandInTrustedIframe(
          trustedIframe,
          "getStatus"
        );
        [resp] = retryResponses;
        expect(resp).toMatchObject(expected);
      }

      if (allowlist) {
        expect(resp.result.allowlist.origin).toEqual("popup");
        expect(resp.result.allowlist.expiresAt).toBeLessThanOrEqual(
          Date.now() + 1000 * 60 * 60 * 24 * 7
        );
        expect(resp.result.allowlist.expiresAt).toBeGreaterThan(
          Date.now() + 1000 * 60 * 60 * 24 * 7 - 1000 * 60 * 10
        );
      }
    });
  });
};
