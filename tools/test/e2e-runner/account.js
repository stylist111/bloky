/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import { openNewTab } from "./driver.js";
import { getOptionsHandle, reloadExtension } from "./extension.js";
import { localTestPageUrl } from "../test-server/host-server/urls.js";

const ACCOUNT_API_HOST = "api.ua.eyeo.it";
const PORTAL_LOGIN_PATH = "/api/auth/ext-login";
const EMAIL_ADDRESS = "john@example.com";
const ACCESS_TOKEN = "a-valid-access-token";
const REFRESH_TOKEN = "a-valid-refresh-token";

/**
 * Mock of a free user profile response from the API.
 * @type {{email: string, displayName: string, features: *[]}}
 */
export const FREE_USER_MOCK = {
  email: EMAIL_ADDRESS,
  displayName: "John Doe",
  features: [],
};

/**
 * Mock of a premium user profile response from the API.
 * @type {{email: string, displayName: string, features: string[]}}
 */
export const PREMIUM_USER_MOCK = {
  ...FREE_USER_MOCK,
  features: ["abp_premium", "ab_premium"],
};

/**
 * Mocks the OTP login endpoint.
 *
 * @param host - The host to mock the endpoint for.
 * @param applicationName - The portal name to set in the response headers.
 * @returns {Promise<void>}
 */
async function mockOtpLoginEndpoint(host, applicationName) {
  const { mockServer } = global;
  await mockServer
    .forPost(PORTAL_LOGIN_PATH)
    .forHost(host)
    .once()
    .thenReply(200, JSON.stringify({}), {
      "X-Application-Name": applicationName,
      "X-Access-Token": ACCESS_TOKEN,
      "X-Refresh-Token": REFRESH_TOKEN,
    });
}

/**
 * Mocks the user profile endpoint.
 *
 * @param user - The user profile to return.
 * @param priority - The priority of the mock.
 *   Higher priority mocks are matched first.
 * @returns {Promise<void>}
 */
async function mockUserProfileEndpoint(user, priority = 1) {
  const { mockServer } = global;
  return await mockServer
    .forGet("/v1/profile")
    .forHost(ACCOUNT_API_HOST)
    .asPriority(priority)
    .withHeaders({ Authorization: `Bearer ${ACCESS_TOKEN}` })
    .once()
    .thenReply(200, JSON.stringify({ user }));
}

/**
 * Simulates the activation of a premium account by mocking the OTP login and user
 * profile endpoints, then triggering a login request from the extension.
 *
 * @param portalUrl - The URL of the portal to use for login.
 * @param applicationName - The application name to set in the OTP login response headers.
 * @returns {Promise<void>}
 */
export async function simulatePremiumActivation(portalUrl, applicationName, initOptionsGeneralTab) {
  const loginUrl = new URL(PORTAL_LOGIN_PATH, portalUrl);
  const host = loginUrl.host;
  await mockOtpLoginEndpoint(host, applicationName);
  await mockUserProfileEndpoint(PREMIUM_USER_MOCK);

  // navigate to a webpage where we can trigger the login
  await openNewTab(localTestPageUrl);

  // Simulate the request to login the extension. This will be intercepted
  // by the mock server the response will activate the premium account in
  // the extension
  await driver.executeAsyncScript(async (url, callback) => {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    callback();
  }, loginUrl.toString());

  // make sure user profile was fetched
  await initOptionsGeneralTab(getOptionsHandle());
  await driver.wait(
    async () => {
      const accountData = await driver.executeAsyncScript(async (callback) => {
        const data = await browser.storage.local.get("ewe:account");
        callback(data["ewe:account"]);
      });
      return accountData?.user?.email === EMAIL_ADDRESS;
    },
    5000,
    "Premium account was not activated",
  );
}

/**
 * Simulates the downgrade of a premium user to a free user by mocking the user
 * profile endpoint to return a free user profile and forcing a profile sync.
 *
 * @param initOptionsGeneralTab - The function to initialize the general tab of the options page.
 * @returns {Promise<void>}
 */
export async function simulateDowngradeToFreeUser(initOptionsGeneralTab) {
  await driver.switchTo().window(getOptionsHandle());
  // Force fetching user profile again by removing last sync info
  await driver.executeAsyncScript(async (callback) => {
    const data = await browser.storage.local.get("ewe:account");
    data["ewe:account"].profileSync = {};
    await browser.storage.local.set(data);
    callback();
  });

  // Make sure backend signals this user is free
  const profileEndpointMock = await mockUserProfileEndpoint(FREE_USER_MOCK, 10);

  // Reload extension to trigger profile sync with new mock
  await reloadExtension(initOptionsGeneralTab);

  // Check that profile endpoint mock was called
  await driver.wait(
    async () => {
      const isPending = await profileEndpointMock.isPending();
      return !isPending;
    },
    2000,
    "User profile endpoint was not called",
  );

  // make sure account data was updated
  await driver.wait(
    async () => {
      const accountData = await driver.executeAsyncScript(async (callback) => {
        const data = await browser.storage.local.get("ewe:account");
        callback(data["ewe:account"]);
      });
      return accountData?.user?.features?.length === 0 && !accountData?.user?.hasPremium;
    },
    5000,
    "Premium account was not deactivated",
  );

  // refresh the page to make sure new state is loaded
  await driver.navigate().refresh();
  await initOptionsGeneralTab(getOptionsHandle());
}
