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
  getFiltersProgrammatically,
  getSubscriptionsProgrammatically,
  toggleSubscriptionProgrammatically,
  setTimeoutForExtensionReload
} from "@eyeo/test-utils/extension";
import {
  enablePremiumProgrammatically,
  sendExtCommandInTrustedIframe,
  setPausedStateFromPopup,
  setAADefaultState,
  disablePremiumProgrammatically,
  initOptionsGeneralTab,
  isPremiumLabelPresent,
  loadPageWithTrustedIframe
} from "../../utils/page.js";
import {
  BT_PARTNER_URL,
  TRUSTED_IFRAME_URL
} from "./trusted-iframe-experiments.js";

function getCombinations() {
  return [
    { premium: false, aa: true, allowlist: false }, // default state
    { premium: false, aa: false, allowlist: false }, // change aa
    { premium: false, aa: false, allowlist: true }, // change allowlist
    { premium: true, aa: false, allowlist: true } // change premium
  ];
}

async function setExtensionState({ premium, aa, allowlist }) {
  if (premium) {
    const isPremium = await isPremiumLabelPresent();
    if (!isPremium) {
      await enablePremiumProgrammatically();
    }
  }

  if (allowlist) {
    const filters = await getFiltersProgrammatically(initOptionsGeneralTab);
    if (!filters.length) {
      await setPausedStateFromPopup(BT_PARTNER_URL);
    }
  }

  await initOptionsGeneralTab(getOptionsHandle());

  const aaUrl =
    extension.manifestVersion === 2
      ? "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
      : "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

  const subscriptions = await getSubscriptionsProgrammatically(
    initOptionsGeneralTab
  );
  const hasAA = subscriptions.some(
    (sub) => sub.title === "Allow nonintrusive advertising"
  );
  if ((aa && !hasAA) || (!aa && hasAA)) {
    await toggleSubscriptionProgrammatically(initOptionsGeneralTab, aaUrl);
  }
}

export default () => {
  const statusCombinations = getCombinations();

  after(async function () {
    setTimeoutForExtensionReload(this);
    await setAADefaultState();
    await removeAllFilters();
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
          hasPremium: premium,
          aa,
          allowlist: expectedAllowlist
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
