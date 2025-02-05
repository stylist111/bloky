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

const { expect } = require("chai");
const BasePage = require("./base.page");
const { waitForAssertion } = require("../helpers");

// This is used for content available on any test pages
class TestPages extends BasePage {
  constructor(browser) {
    super();
    this.browser = browser;
  }

  get customBlockingFilter() {
    return $("#custom-blocking");
  }

  get customBlockingRegexFilter() {
    return $("#custom-blocking-regex");
  }

  get customHidingClass() {
    return $("#custom-hiding-class");
  }

  get customHidingId() {
    return $("#custom-hiding-id");
  }

  get ecosiaAdPill() {
    return $("//span[@class='ad-pill']");
  }

  get ecosiaAdPillAlternate() {
    return $("span*=Ad");
  }

  get dcElementIdFilter() {
    return $("#element-id-dc");
  }

  get dcScriptIdFilter() {
    return $("#script-id-dc");
  }

  get controlElementFilter() {
    return $("#control-element");
  }

  get testElementIdFilter() {
    return $("#test-element-id");
  }

  get testElementClassFilter() {
    return $("#test-element-class");
  }

  get testScriptIdFilter() {
    return $("#script-id-full-path");
  }

  get testRegexScriptIdFilter() {
    return $("#script-id-regex");
  }

  get hiddenBySnippetText() {
    return $("p*=Snippet filter not applied");
  }

  get searchAdDiv() {
    return $("#search-ad");
  }

  get subscribeLink() {
    return $("//*[@id='subscription-link']/a");
  }

  get subscriptionBlocking() {
    return $("#subscription-blocking");
  }

  get subscriptionBlockingRegex() {
    return $("#subscription-blocking-regex");
  }

  get subscriptionHidingClass() {
    return $("#subscription-hiding-class");
  }

  get subscriptionHidingId() {
    return $("#subscription-hiding-id");
  }

  async clickSubscribeLink() {
    await this.waitForEnabledThenClick(this.subscribeLink);
  }

  get cookieBanner() {
    return $("#cookieConsentModal");
  }

  async getCustomBlockingFilterText() {
    return await (await this.customBlockingFilter).getText();
  }

  async getCustomBlockingRegexFilterText() {
    return await (await this.customBlockingRegexFilter).getText();
  }

  async getCustomHidingClassText() {
    return await (await this.customHidingClass).getText();
  }

  async getCustomHidingIdText() {
    return await (await this.customHidingId).getText();
  }

  async getSearchAdDivText() {
    return await (await this.searchAdDiv).getText();
  }

  async getSubscriptionBlockingText() {
    await (await this.subscriptionBlocking).waitForEnabled({ timeout: 2000 });
    return await (await this.subscriptionBlocking).getText();
  }

  async getSubscriptionBlockingRegexText() {
    return await (await this.subscriptionBlockingRegex).getText();
  }

  async getSubscriptionHidingClassText() {
    return await (await this.subscriptionHidingClass).getText();
  }

  async getSubscriptionHidingIdText() {
    return await (await this.subscriptionHidingId).getText();
  }

  async isCookieBannerDisplayed(reverseOption = false) {
    return await this.waitForDisplayedNoError(
      this.cookieBanner,
      reverseOption,
      2000
    );
  }

  async isCustomHidingClassDisplayed() {
    return await (await this.customHidingClass).isDisplayed();
  }

  async isCustomHidingIdDisplayed() {
    return await (await this.customHidingId).isDisplayed();
  }

  async isEcosiaAdPillDisplayed(reverseOption = false) {
    return await this.waitForDisplayedNoError(
      this.ecosiaAdPill,
      reverseOption,
      2000
    );
  }

  async isEcosiaAdPillAlternateDisplayed(reverseOption = false) {
    return await this.waitForDisplayedNoError(
      this.ecosiaAdPillAlternate,
      reverseOption,
      2000
    );
  }

  async isDcElementIdFilterDisplayed() {
    return await (await this.dcElementIdFilter).isDisplayed();
  }

  async isDcScriptIdFilterDisplayed() {
    return await (await this.dcScriptIdFilter).isDisplayed();
  }

  async isControlElementFilterDisplayed() {
    return await (await this.controlElementFilter).isDisplayed();
  }

  async isTestElementIdFilterDisplayed() {
    return await (await this.testElementIdFilter).isDisplayed();
  }

  async isTestElementClassFilterDisplayed() {
    return await (await this.testElementClassFilter).isDisplayed();
  }

  async isTestScriptIdFilterDisplayed() {
    return await (await this.testScriptIdFilter).isDisplayed();
  }

  async isTestRegexScriptIdFilterDisplayed() {
    return await (await this.testRegexScriptIdFilter).isDisplayed();
  }

  async isSearchAdDivDisplayed() {
    return await (await this.searchAdDiv).isDisplayed();
  }

  async isSubscriptionHidingClassDisplayed() {
    return await (await this.subscriptionHidingClass).isDisplayed();
  }

  async isSubscriptionHidingIdDisplayed() {
    return await (await this.subscriptionHidingId).isDisplayed();
  }

  async checkPage({ expectAllowlisted = false }) {
    expect(await this.isControlElementFilterDisplayed()).to.be.true;

    const timeout = 15000;
    await waitForAssertion(
      async () => {
        expect(await this.isTestElementIdFilterDisplayed()).to.equal(
          expectAllowlisted
        );
        expect(await this.isTestElementClassFilterDisplayed()).to.equal(
          expectAllowlisted
        );
        expect(await this.isTestScriptIdFilterDisplayed()).to.equal(
          expectAllowlisted
        );
        expect(await this.isTestRegexScriptIdFilterDisplayed()).to.equal(
          expectAllowlisted
        );
      },
      {
        timeout,
        // eslint-disable-next-line max-len
        timeoutMsg: `filters were not applied on page when expectAllowlisted=${expectAllowlisted}`
      }
    );
  }
}

module.exports = TestPages;
