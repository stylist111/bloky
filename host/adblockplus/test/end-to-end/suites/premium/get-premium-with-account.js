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
  clickOnDisplayedElement,
  getDisplayedElement,
  openNewTab,
  waitForNotDisplayed,
  wait,
  findUrl
} from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  setTimeoutForExtensionReload,
  reloadExtension
} from "@eyeo/test-utils/extension";
import { dcTestPageUrl } from "@eyeo/test-utils/host-urls";
import { dcFilters } from "@eyeo/test-utils/host-filters";
import { premiumLinkButtons } from "../../utils/dataset.js";

import {
  initOptionsGeneralTab,
  initPopupWithLocalPage,
  checkPremiumActivated,
  clickFLAndCheck,
  setPremiumFLsDefaultState,
  disablePremiumProgrammatically
} from "../../utils/page.js";
import { premiumUrl } from "../../utils/urls.js";
import { premiumToggles, premiumFilterLists } from "../../utils/dataset.js";

const ACCESS_TOKEN = "a-valid-access-token";
const REFRESH_TOKEN = "a-valid-refresh-token";
const EMAIL_ADDRESS = "john@example.com";

async function mockOtpLoginEndpoint() {
  const { mockServer } = global;
  return await mockServer
    .forPost("/v1/otp/login")
    .forHost("api.ua.eyeo.it")
    .once()
    .thenReply(200, JSON.stringify({}), {
      "X-Application-Name": "abp-portal",
      "X-Access-Token": ACCESS_TOKEN,
      "X-Refresh-Token": REFRESH_TOKEN
    });
}

async function mockUserProfileEndpoint(
  options = { premium: true, priority: 1 }
) {
  const { premium, priority } = options;
  const { mockServer } = global;
  return await mockServer
    .forGet("/v1/profile")
    .forHost("api.ua.eyeo.it")
    .asPriority(priority)
    .withHeaders({ Authorization: `Bearer ${ACCESS_TOKEN}` })
    .once()
    .thenReply(
      200,
      JSON.stringify({
        user: {
          email: EMAIL_ADDRESS,
          displayName: "John Doe",
          features: premium ? ["abp_premium"] : []
        }
      })
    );
}

async function simulatePremiumActivation() {
  await mockOtpLoginEndpoint();
  await mockUserProfileEndpoint();

  // navigate to https://myaccount.adblockplus.org/
  await openNewTab(premiumUrl);

  // simulate the otp login, this will be intercepted by the mock server
  // the response will activate the premium account in the extension
  await driver.executeAsyncScript(async (callback) => {
    await fetch("https://api.ua.eyeo.it/v1/otp/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    callback();
  });

  // make sure user profile was fetched
  await driver.switchTo().window(getOptionsHandle());
  await driver.navigate().refresh();
  await driver.wait(
    async () => {
      const accountData = await driver.executeAsyncScript(async (callback) => {
        const data = await browser.storage.local.get("ewe:account");
        callback(data["ewe:account"]);
      });
      return accountData?.user?.email === EMAIL_ADDRESS;
    },
    5000,
    "Premium account was not activated"
  );
}

export default () => {
  afterEach(async function () {
    await setPremiumFLsDefaultState();
  });

  after(async function () {
    setTimeoutForExtensionReload(this);
    await disablePremiumProgrammatically();
  });

  it("logging in with a premium account", async function () {
    await simulatePremiumActivation();
    await checkPremiumActivated({ timeout: 2000 });
    // eslint-disable-next-line no-warning-comments
    // TODO: after full migration to new account system all users should have
    // accounts and this check should be moved to checkPremiumActivated function
    await getDisplayedElement("#user-account-manage", { timeout: 1000 });
  });

  it("has premium features", async function () {
    await simulatePremiumActivation();
    await initPopupWithLocalPage();

    // Default popup premium togles
    const actualToggles = [];
    for (const { selector, name } of premiumToggles) {
      const elem = await getDisplayedElement(selector);
      const enabled = await elem.getAttribute("aria-checked");
      actualToggles.push({ selector, name, enabled });
    }
    expect(actualToggles).toEqual(premiumToggles);

    // Cookie filters can be enabled
    // Clicking right after the popup is loaded may be ineffective, sleeping as a workaround
    await driver.sleep(1000);

    const { selector } = premiumToggles.find(({ name }) => name === "cookie");
    await clickOnDisplayedElement(selector);
    await clickOnDisplayedElement("#cookie-consent-modal-accept", {
      timeout: 3000
    });

    await wait(
      async () => {
        const elem = await getDisplayedElement(selector);
        return (await elem.getAttribute("aria-checked")) === "true";
      },
      2000,
      `${selector} was not enabled after clicking on it`
    );

    // Distraction Control
    await openNewTab(dcTestPageUrl);
    await getDisplayedElement("#control-element");
    for (const dcFilter of dcFilters) {
      await waitForNotDisplayed(dcFilter);
    }
  });

  it("enables premium filter lists", async function () {
    await simulatePremiumActivation();
    await initOptionsGeneralTab(getOptionsHandle());

    let someEnabled = false;
    for (const { name, stepsAfterClick } of premiumFilterLists) {
      const hasClicked = await clickFLAndCheck(name, {
        enable: true,
        stepsAfterClick
      });
      someEnabled = hasClicked || someEnabled;
    }

    if (!someEnabled) {
      throw new Error("All premium filterlists were previously enabled");
    }
  });

  it("downgrades if premium expired", async function () {
    setTimeoutForExtensionReload(this);
    await simulatePremiumActivation();
    await checkPremiumActivated({ timeout: 2000 });

    // Force fetching user profile again by removing last sync info
    await driver.switchTo().window(getOptionsHandle());
    await driver.executeAsyncScript(async (callback) => {
      const data = await browser.storage.local.get("ewe:account");
      data["ewe:account"].profileSync = {};
      await browser.storage.local.set(data);
      callback();
    });

    // Make sure backend signals this user is free
    const profileEndpointMock = await mockUserProfileEndpoint({
      premium: false,
      priority: 10 // higher priority to override previous mock
    });

    // Check this user is downgraded
    await reloadExtension(initOptionsGeneralTab);

    // Check that profile endpoint mock was called
    await driver.wait(
      async () => {
        const isPending = await profileEndpointMock.isPending();
        return !isPending;
      },
      2000,
      "User profile endpoint was not called"
    );

    // refresh the page to make sure new state is loaded
    await driver.navigate().refresh();
    await initOptionsGeneralTab(getOptionsHandle());

    // Easy check if user is free
    // Premium link/button checks
    for (const { selector, text } of premiumLinkButtons) {
      const elem = await getDisplayedElement(selector);
      expect(await elem.getText()).toEqual(text);

      await elem.click();
      await findUrl(premiumUrl);
      await driver.close();
      await initOptionsGeneralTab(getOptionsHandle());
    }
  });
};
