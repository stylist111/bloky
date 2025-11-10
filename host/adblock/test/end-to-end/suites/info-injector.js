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

/* For ESLint: List any global identifiers used in this file below */

import { prepareExtensionHook } from "@eyeo/test-utils/hooks";
import {
  getOptionsHandle,
  blockAds,
  verifyInjectedExtensionData,
} from "@eyeo/test-utils/extension";
import {
  getUserIdFromStorage,
  getPopupBlockedAdsTotalCount,
  isPremiumActivated,
  callUIExperimentsAPI,
} from "../utils/page.js";

export const testUrl = "https://getadblock.com";
export const dataAttribute = "data-adblock-extension-info";

const maxAdsBlocked = 100;

export async function getActualExtensionData() {
  const id = await getUserIdFromStorage(getOptionsHandle());
  const blockCount = await blockAds(-1, maxAdsBlocked, getPopupBlockedAdsTotalCount);
  await prepareExtensionHook();
  const { version } = extension;
  const isPremium = await isPremiumActivated();
  const experimentFlags = await callUIExperimentsAPI("getFlags");
  return { id, isPremium, version, blockCount, experimentFlags };
}

export default async () => {
  it(`verifies injected data on adblockplus.org matches AdBlock extension data`, async () => {
    await verifyInjectedExtensionData(testUrl, dataAttribute, getActualExtensionData);
  });
};
