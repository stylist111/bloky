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
  afterSequence,
  beforeSequence,
  globalRetriesNumber,
  isFirefox,
  switchToABPOptionsTab
} = require("../helpers");
const { expect } = require("chai");
const AdvancedPage = require("../page-objects/advanced.page");
const GeneralPage = require("../page-objects/general.page");
const TestPages = require("../page-objects/testPages.page");
let lastTest = false;

describe("test subscriptions as part of the integration tests", function () {
  this.retries(globalRetriesNumber);

  before(async function () {
    await beforeSequence();
  });

  afterEach(async function () {
    if (lastTest == false) {
      await afterSequence();
    }
  });

  it("should add new subscription via link", async function () {
    if (process.env.MANIFEST_VERSION === "3") this.skip();

    await browser.url(
      "https://eyeo.gitlab.io/browser-extensions-and-premium/supplemental/QA-team/adblocking" +
        "/subscriptions/subscriptions-testpage.html"
    );
    const testPages = new TestPages(browser);
    expect(await testPages.getSubscriptionBlockingText()).to.include(
      "/subscription-blocking.js should be blocked"
    );
    expect(await testPages.getSubscriptionBlockingRegexText()).to.include(
      "/subscription-blocking-regex.js should be blocked"
    );
    expect(await testPages.getSubscriptionHidingIdText()).to.include(
      "id element should be hidden"
    );
    expect(await testPages.getSubscriptionHidingClassText()).to.include(
      "class element should be hidden"
    );
    await testPages.clickSubscribeLink();
    const generalPage = new GeneralPage(browser);

    await switchToABPOptionsTab();
    console.error(String(await generalPage.getPredefinedDialogTitleText()));
    expect(
      String(await generalPage.getPredefinedDialogTitleText()).includes(
        "ARE YOU SURE YOU WANT TO ADD THIS FILTER LIST?"
      )
    ).to.be.true;
    await generalPage.clickYesUseThisFLButton();
    expect(
      String(
        await generalPage.getMoreFilterListsTableItemByLabelText(
          "ABP test subscription"
        )
      ).includes("ABP test subscription")
    ).to.be.true;
    await browser.newWindow(
      "https://eyeo.gitlab.io/browser-extensions-and-premium/supplemental/QA-team/adblocking" +
        "/subscriptions/subscriptions-testpage.html"
    );
    await browser.refresh();
    expect(await testPages.getSubscriptionBlockingText()).to.include(
      "/subscription-blocking.js was blocked"
    );
    expect(await testPages.getSubscriptionBlockingRegexText()).to.include(
      "/subscription-blocking-regex.* was blocked"
    );
    expect(await testPages.isSubscriptionHidingIdDisplayed()).to.be.false;
    expect(await testPages.isSubscriptionHidingClassDisplayed()).to.be.false;
  });

  it("should disable/enable subscriptions", async function () {
    const advancedPage = new AdvancedPage(browser);
    await advancedPage.init();
    await advancedPage.clickEasyListFLStatusToggle();
    expect(await advancedPage.isEasyListFLStatusToggleSelected()).to.be.false;
    await browser.newWindow(
      "http://testpages.eyeo.com:3005/easylist-filters.html"
    );
    if (isFirefox()) {
      await browser.pause(500);
    }
    await browser.refresh();
    const testPages = new TestPages(browser);
    if (isFirefox()) {
      if ((await testPages.getCurrentTitle()) != "EasyList Filters") {
        await testPages.switchToTab("EasyList Filters");
        await browser.refresh();
      }
    }
    await testPages.checkPage({ expectAllowlisted: true });

    await switchToABPOptionsTab();
    await advancedPage.init();
    await advancedPage.clickEasyListFLStatusToggle();
    expect(await advancedPage.isEasyListFLStatusToggleSelected()).to.be.true;
    await browser.newWindow(
      "http://testpages.eyeo.com:3005/easylist-filters.html"
    );
    await browser.refresh();
    if (isFirefox()) {
      if ((await testPages.getCurrentTitle()) != "EasyList Filters") {
        await testPages.switchToTab("EasyList Filters");
        await browser.refresh();
      }
    }
    await testPages.checkPage({ expectAllowlisted: false });
  });

  it("should add/remove subscriptions", async function () {
    const advancedPage = new AdvancedPage(browser);
    if (isFirefox()) {
      await browser.refresh();
      await switchToABPOptionsTab();
      await advancedPage.init();
      await advancedPage.clickAddBuiltinFilterListButton();
      await advancedPage.clickEasyListEnglishFL();
      await advancedPage.init();
    } else {
      await advancedPage.init();
    }
    await advancedPage.clickEasyListFLTrashButton();
    expect(await advancedPage.isEasyListFLDisplayed()).to.be.false;
    await browser.newWindow(
      "http://testpages.eyeo.com:3005/easylist-filters.html"
    );
    await browser.refresh();
    const testPages = new TestPages(browser);
    if (isFirefox()) {
      if ((await testPages.getCurrentTitle()) != "EasyList Filters") {
        await testPages.switchToTab("EasyList Filters");
        await browser.refresh();
      }
    }
    await testPages.checkPage({ expectAllowlisted: true });

    await switchToABPOptionsTab();
    await advancedPage.init();
    await advancedPage.clickAddBuiltinFilterListButton();
    await advancedPage.clickEasyListEnglishFL();
    expect(await advancedPage.isEasyListFLDisplayed()).to.be.true;
    expect(await advancedPage.isEasyListFLStatusToggleSelected()).to.be.true;
    expect(await advancedPage.isEasyListFLUpdatingDone()).to.be.true;
    await browser.newWindow(
      "http://testpages.eyeo.com:3005/easylist-filters.html"
    );

    await browser.refresh();
    if (isFirefox()) {
      if ((await testPages.getCurrentTitle()) != "EasyList Filters") {
        await testPages.switchToTab("EasyList Filters");
        await browser.refresh();
      }
    }
    lastTest = true;
    await testPages.checkPage({ expectAllowlisted: false });
  });
});
