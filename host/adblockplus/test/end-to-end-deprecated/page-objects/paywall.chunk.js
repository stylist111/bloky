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

const BasePage = require("./base.page");

class PaywallChunk extends BasePage {
  constructor(browser) {
    super();
    this.browser = browser;
  }

  get allowAdsButton() {
    return $("div.bt-sw-cctamodal-default-cta-button-group");
  }

  get paywallContent() {
    return $("#bt-softwall");
  }

  async clickAllowAdsButton() {
    await (await this.allowAdsButton).click();
  }

  async isPaywallContentDisplayed(reverseOption = false, timeoutMs = 5000) {
    return await this.waitForDisplayedNoError(
      this.paywallContent,
      reverseOption,
      timeoutMs
    );
  }
}

module.exports = PaywallChunk;
