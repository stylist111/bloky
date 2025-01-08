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

import {
  beforeSequence,
  getTabId,
  switchToABPOptionsTab,
  enablePremiumProgrammatically,
  waitForAssertion,
  waitForExtension,
  isEdge
} from "../../helpers.js";
import { expect } from "chai";
import PopupPage from "../../page-objects/popup.page.js";
import TestPage from "../../page-objects/testPages.page.js";
import GeneralPage from "../../page-objects/general.page.js";
import AdvancedPage from "../../page-objects/advanced.page.js";
import testData from "../../test-data/data-smoke-tests.js";
import AllowlistedWebsitesPage from "../../page-objects/allowlistedWebsites.page.js";
import { upgradeExtension } from "../../runners/helpers.mjs";

let popupUrl;
let prevExtVersion;

async function blockSomeItems() {
  const page = new TestPage(browser);
  await browser.newWindow(testData.blockHideUrl);
  await page.switchToTab("EasyList Filters");

  // We need to wait here to blocking to be applied
  await browser.pause(2000);
  await browser.closeWindow();
  await switchToABPOptionsTab();
}

async function getTotalCount() {
  const page = new TestPage(browser);
  // We should get the total blocked count from the page with no ads
  await browser.newWindow("http://localhost:3005/test.html");
  await page.switchToTab("localhost:3005/test.html");
  const tabId = await getTabId({ title: "localhost:3005/test.html" });

  const popup = new PopupPage(browser);
  await popup.init(popupUrl, tabId);
  const count = await popup.getNumberOfAdsBlockedInTotalText();

  // cleanup
  await browser.closeWindow();
  await page.switchToTab("localhost:3005/test.html");
  await browser.closeWindow();
  await switchToABPOptionsTab();

  return parseInt(count, 10);
}

export default () => {
  describe("Upgrade Extension", function () {
    before(async function () {
      // https://eyeo.atlassian.net/browse/EXT-153
      if (isEdge()) this.skip();

      ({ popupUrl, extVersion: prevExtVersion } = await beforeSequence());
    });

    it("keeps current settings after upgrade", async function () {
      const advancedPage = new AdvancedPage(browser);
      const allowlistedPage = new AllowlistedWebsitesPage(browser);
      const generalPage = new GeneralPage(browser);
      const popup = new PopupPage(browser);
      const testPage = new TestPage(browser);
      const customFilter = "/testfiles/blocking/partial-path/";

      // block and hide ads on a page
      await blockSomeItems();

      // check total ads blocked count
      const totalCount = await getTotalCount();

      // activate premium
      await enablePremiumProgrammatically();

      // Uncheck "show number of ads blocked in icon" checkbox
      await advancedPage.init();
      await advancedPage.clickShowNumberOfAdsBlockedCheckbox();

      // note: we need easylist to be off, otherwise there is not enough space
      // for all the filterlists used in test below (MV3)
      await advancedPage.clickEasyListFLTrashButton();

      await switchToABPOptionsTab();
      await generalPage.init();

      // block additional tracking
      await generalPage.clickBlockAdditionalTrackingCheckbox();

      // turn off AA
      await generalPage.clickAllowAcceptableAdsCheckbox();

      // enable premium lists
      await generalPage.clickBlockCookieConsentPopupsCheckbox();
      await generalPage.clickBlockCookieConsentPopupsDialogOkButton();

      // add German + English language filter list
      await generalPage.clickAddALanguageButton();
      await generalPage.clickDeutschPlusEnglishListItem();

      // allowlist test page
      await browser.newWindow("http://localhost:3005/test.html");
      await testPage.switchToTab("localhost:3005/test.html");
      const tabId = await getTabId({ title: "localhost:3005/test.html" });
      await popup.init(popupUrl, tabId);
      await popup.clickThisPageToggle();
      // wait for refresh button to appear to confirm
      // that allowlist filter got saved
      await popup.isRefreshButtonDisplayed();

      // add custom filter
      await switchToABPOptionsTab();
      await advancedPage.init();
      await advancedPage.typeTextToAddCustomFilterListInput(customFilter);
      await advancedPage.clickAddCustomFilterListButton();
      expect(await advancedPage.verifyTextPresentInCustomFLTable(customFilter))
        .to.be.true;

      // upgrade extension
      await upgradeExtension();
      const { extVersion } = await waitForExtension();

      // check the extension version has changed
      expect(extVersion).to.not.equal(prevExtVersion);

      // check total ads blocked count and if total count
      // is still increasing
      expect(await getTotalCount()).to.be.equal(totalCount);
      await blockSomeItems();
      expect(await getTotalCount()).to.be.greaterThan(totalCount);

      // Sometimes the options page may be "frozen" at this point.
      // Waiting for some description is a workaround to make sure the next
      // additional tracking checks have meaningful elements
      await waitForAssertion(
        async () => {
          await switchToABPOptionsTab({ refresh: true });
          await generalPage.init();
          expect(
            await generalPage.getBlockAdditionalTrackingDescriptionText()
          ).to.contain("Protect your privacy");
        },
        {
          timeout: 5000,
          timeoutMsg: "Unexpected Block Additional Tracking description"
        }
      );

      // check if additional tracking is enabled & disable it
      expect(await generalPage.isBlockAdditionalTrackingCheckboxSelected()).to
        .be.true;
      await generalPage.clickBlockAdditionalTrackingCheckbox();
      await browser.pause(100);
      await waitForAssertion(
        async () => {
          expect(
            await generalPage.isBlockAdditionalTrackingCheckboxSelected(
              false,
              500
            )
          ).to.be.false;
        },
        {
          timeout: 5000,
          timeoutMsg: "Block Additional Tracking Checkbox is selected"
        }
      );

      // check premium lists & deactivate, AA disabled & enable it
      const checkboxes = [
        {
          method: () => generalPage.isBlockMoreDistractionsCheckboxSelected(),
          expected: true,
          text: "Block More Distractions"
        },
        {
          method: () =>
            generalPage.isBlockCookieConsentPopupsCheckboxSelected(),
          expected: true,
          text: "Block Cookie Consent"
        },
        {
          method: () => generalPage.isAllowAcceptableAdsCheckboxSelected(),
          expected: false,
          text: "Allow Acceptable Ads"
        }
      ];
      for (const checkbox of checkboxes) {
        expect(await checkbox.method()).to.be.equal(checkbox.expected);
      }

      await generalPage.clickBlockMoreDistractionsCheckbox();
      await generalPage.clickBlockCookieConsentPopupsCheckbox();
      await generalPage.clickAllowAcceptableAdsCheckbox();

      for (const checkbox of checkboxes) {
        await waitForAssertion(
          async () => {
            expect(await checkbox.method()).to.be.equal(!checkbox.expected);
          },
          {
            timeout: 5000,
            timeoutMsg: `Checkbox ${checkbox.text} didn't change after click`
          }
        );
      }
      // check if language filter list is still there
      expect(await generalPage.isDeutschPlusEnglishLanguageTableItemDisplayed())
        .to.be.true;
      await generalPage.clickDeutschPlusEnglishLanguageChangeButton();
      await generalPage.clickItalianoPlusEnglishListItem();
      await waitForAssertion(
        async () => {
          expect(
            await generalPage.isDeutschPlusEnglishLanguageTableItemDisplayed(
              false,
              500
            )
          ).to.be.false;
        },
        {
          timeout: 5000,
          timeoutMsg: "Deutsch + English item is still visible after 5000 ms",
          // refreshing will change the focus to top-window
          refresh: false
        }
      );
      await waitForAssertion(
        async () => {
          expect(
            await generalPage.isItalianoPlusEnglishLanguageTableItemDisplayed(
              true,
              500
            )
          ).to.be.true;
        },
        {
          timeout: 5000,
          timeoutMsg: "Italian item is not visible",
          // refreshing will change the focus to top-window
          refresh: false
        }
      );

      // we need to switch focus to options tab to be able to switch to other
      await switchToABPOptionsTab();

      // check if "show number of ads blocked in icon" checkbox is unchecked
      await advancedPage.init();
      expect(await advancedPage.isShowNumberOfAdsBlockedCheckboxSelected()).to
        .be.false;

      // webdriverIO in headless doesn't "see" custom filter list
      // table until we add something into it. Adding another custom
      // filter as a workaround.
      await advancedPage.typeTextToAddCustomFilterListInput(
        "/testfiles/blocking/another-custom-filter/"
      );
      await advancedPage.clickAddCustomFilterListButton();
      // Workaround for "Timed out receiving message from renderer: 10.000"
      await browser.pause(2000);
      // check if custom filter is still there
      expect(await advancedPage.verifyTextPresentInCustomFLTable(customFilter))
        .to.be.true;
      // check that removal works
      await advancedPage.clickCustomFilterListsCheckboxByText(customFilter);
      await advancedPage.clickDeleteCustomFLButton();
      await waitForAssertion(
        async () => {
          expect(
            await advancedPage.verifyTextPresentInCustomFLTable(customFilter)
          ).to.be.false;
        },
        {
          timeout: 5000,
          timeoutMsg: "Custom Filter wasn't removed"
        }
      );

      // check allowlisted
      // we need to switch to options tab from filters view
      await switchToABPOptionsTab();
      await allowlistedPage.init();
      const allowlistedTableItems =
        await allowlistedPage.getAttributeOfAllowlistingTableItems(
          "aria-label"
        );
      expect(allowlistedTableItems[0]).to.equal("localhost:3005/test.html");
    });
  });
};
