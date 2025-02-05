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

"use strict";

const {
  beforeSequence,
  getTabId,
  isEdge,
  switchToABPOptionsTab
} = require("../helpers");
const { expect } = require("chai");
const AllowlistedWebsitesPage = require("../page-objects/allowlistedWebsites.page");
const OneClickAllowAdsTestPage = require("../page-objects/oneClickAllowAdsTest.page");
const PaywallChunk = require("../page-objects/paywall.chunk");
const PopupPage = require("../page-objects/popup.page");
let popupUrl;

describe("test abp allowlisting api", function () {
  before(async function () {
    ({ popupUrl } = await beforeSequence());
  });

  it("should perform smart allowlisting", async function () {
    // https://eyeo.atlassian.net/browse/EXT-301
    if (isEdge()) this.skip();

    await browser.newWindow("https://allthatsinteresting.com/tag/history");
    await browser.url("https://allthatsinteresting.com/tag/science");
    const paywallChunk = new PaywallChunk(browser);
    expect(await paywallChunk.isPaywallContentDisplayed()).to.be.true;
    await paywallChunk.clickAllowAdsButton();
    expect(await paywallChunk.isPaywallContentDisplayed(true, 10000)).to.be
      .true;
    const tabId = await getTabId({
      urlPattern: "https://allthatsinteresting.com/tag/science"
    });
    const popupPage = new PopupPage(browser);
    await popupPage.init(popupUrl, tabId);
    expect(await popupPage.isDomainToggleChecked()).to.be.false;
    await switchToABPOptionsTab();
    const allowistedWebsitesPage = new AllowlistedWebsitesPage(browser);
    await allowistedWebsitesPage.init();
    const attributesOfAllowlistingTableItems =
      await allowistedWebsitesPage.getAttributeOfAllowlistingTableItems(
        "class"
      );
    attributesOfAllowlistingTableItems.forEach(async (element) => {
      expect(element).to.equal("allthatsinteresting.com");
    });
  });

  it("should display message for non-partners", async function () {
    // https://eyeo.atlassian.net/browse/EXT-301
    if (isEdge()) this.skip();

    const oneClickAllowAdsTestPage = new OneClickAllowAdsTestPage(browser);
    await oneClickAllowAdsTestPage.init();
    expect(await oneClickAllowAdsTestPage.isOneClickGFCPaywallDisplayed()).to.be
      .true;
    await oneClickAllowAdsTestPage.clickOneClickButton();
    expect(await oneClickAllowAdsTestPage.isWhichExtensionMessageDisplayed()).to
      .be.true;
  });
});
