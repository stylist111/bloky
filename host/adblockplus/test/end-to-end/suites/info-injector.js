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
/* global ewe */

import { prepareExtensionHook } from "@eyeo/test-utils/hooks";
import {
  blockAds,
  verifyInjectedExtensionData
} from "@eyeo/test-utils/extension";
import {
  isPremiumActivated,
  getPopupBlockedAdsTotalCount,
  callUIExperimentsAPI,
  callUIAccountAPI
} from "../utils/page.js";

export const testUrl = "https://adblockplus.org";
export const dataAttribute = "data-adblock-plus-extension-info";

const maxAdsBlocked = 100;

export async function getActualExtensionData() {
  const blockCount = await blockAds(
    -1,
    maxAdsBlocked,
    getPopupBlockedAdsTotalCount
  );
  await prepareExtensionHook();
  const { version } = extension;
  const isPremium = await isPremiumActivated();
  const id = await driver.executeScript(() => {
    return browser.storage.local
      .get("pref:installation_id")
      .then((data) => data["pref:installation_id"] || null);
  });
  const isTrial = await callUIAccountAPI("isTrial");
  const experimentFlags = await callUIExperimentsAPI("getFlags");
  return { id, isPremium, isTrial, version, blockCount, experimentFlags };
}

export default async () => {
  it(`verifies injected data on adblockplus.org matches AdBlock extension data`, async () => {
    await verifyInjectedExtensionData(
      testUrl,
      dataAttribute,
      getActualExtensionData
    );
  });
};
