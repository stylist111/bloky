/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import expect from "expect";
import {TEST_ADMIN_PAGES_URL, TEST_PAGES_URL} from "@eyeo/test-utils/sdk-urls";
import {clearTestEvents, EWE, expectTestEvents} from "./messaging.js";
import {MILLIS_IN_SECOND} from "#adblockpluscore/lib/time.js";
import {
  clearEndpointResponse,
  clearRequestLogs,
  delayThenExpectNextPing,
  expectNextPing,
  getRequestLogIntervals,
  isFirefox,
  ISO_DATE_REGEX,
  Page,
  setEndpointResponse,
  setMinTimeout, sleep,
  waitForAssertion
} from "./utils.js";
import {
  PREMIUM_USER_PROFILE,
  PREMIUM_USER_WITH_TRIAL_PROFILE,
  ACCOUNT_ROUTES,
  ACCOUNT_PATHS,
  STORED_PREMIUM_USER_PROFILE,
  STORED_PREMIUM_USER_WITH_TRIAL_PROFILE,
  PROFILE_SYNC_URL,
  STORED_FREE_USER_PROFILE,
  REFRESH_TOKEN_INVALID_ERROR,
  INTERNAL_SERVER_ERROR,
  DEFAULT_LOGIN_PATTERN
} from "./fixtures/account.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";

const API_BASE_URL = `${TEST_ADMIN_PAGES_URL}/accounts`;
const APPLICATION_ID = "ewe-test-application-id";
const ERROR_BACKOFF_MS = 2 * MILLIS_IN_SECOND;
const PING_INTERVAL_MS = MILLIS_IN_SECOND;


async function setServerConfig(config) {
  for (const route of config) {
    const {url, method, response, headers, status = 200} = route;
    await setEndpointResponse(url, response, method, status, headers);
  }
}

async function resetServerConfig(config) {
  for (const route of config) {
    const {url} = route;
    await clearEndpointResponse(url);
  }
}

async function startWithTestArgs({
  syncInterval = PING_INTERVAL_MS,
  errorRetryDelay = ERROR_BACKOFF_MS,
  disableAutosync
}) {
  let loginRequestPattern = DEFAULT_LOGIN_PATTERN;

  // Firefox listener is not triggered if the pattern contains the port.
  // That is why we use localhost without port.
  if (isFirefox()) {
    loginRequestPattern = DEFAULT_LOGIN_PATTERN.replace(/:\d+/, "");
  }

  const config = {
    apiBaseUrl: API_BASE_URL,
    applicationId: APPLICATION_ID,
    loginRequestPattern,
    profileSyncConfig: {
      syncInterval,
      errorRetryDelay,
      disableAutosync
    }
  };
  await EWE.testing.restartAccount(config);
}

async function assertAccountState({
  isLoggedIn = true,
  hasPremium = false,
  profile = STORED_FREE_USER_PROFILE,
  expectLastSuccessfulRequest = true,
  expectLastRequestError = false,
  timeout = 4000
} = {}) {
  return waitForAssertion(async() => {
    expect(await EWE.account.isLoggedIn()).toBe(isLoggedIn);
    expect(await EWE.account.hasPremium()).toBe(hasPremium);
    expect(await EWE.account.getProfile())
      .toStrictEqual(profile);
    expect(await EWE.account.isTrial())
      .toBe(profile && profile.subscription ?
        profile.subscription.isTrial : false);
    expect(await EWE.account.getPreferences())
      .toStrictEqual(profile && profile.preferences ?
        profile.preferences : {});
    expect(await EWE.account.getTrialDaysLeft())
      .toBe(profile && profile.subscription && typeof profile.subscription.trialDaysLeft === "number" ?
        profile.subscription.trialDaysLeft : 0);

    const syncStatus = await EWE.account.getProfileSyncStatus();

    const expectedSyncStatus = {
      ...(expectLastSuccessfulRequest && {
        lastSuccessfulRequest: expect.stringMatching(ISO_DATE_REGEX)
      }),
      ...(expectLastRequestError && {
        lastRequestError: expect.stringMatching(ISO_DATE_REGEX)
      })
    };

    expect(syncStatus).toEqual(expect.objectContaining(expectedSyncStatus));
  }, timeout);
}

async function assertPremiumUser() {
  return assertAccountState({
    isLoggedIn: true,
    hasPremium: true,
    profile: STORED_PREMIUM_USER_PROFILE,
    expectLastSuccessfulRequest: true,
    expectLastRequestError: false
  });
}

async function assertPremiumUserWithTrial() {
  return assertAccountState({
    isLoggedIn: true,
    hasPremium: true,
    profile: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE,
    expectLastSuccessfulRequest: true,
    expectLastRequestError: false
  });
}

async function assertFreeUser() {
  return assertAccountState();
}

async function assertLogOutUser() {
  return assertAccountState({
    isLoggedIn: false,
    hasPremium: false,
    profile: null,
    expectLastSuccessfulRequest: false,
    expectLastRequestError: false
  });
}

async function logInUser() {
  await new Page(`${TEST_PAGES_URL}/account-log-in.html`).loaded;
}

describe("Account", function() {
  let onChangedEvents = [];
  const retryFetchIntervals = [
    500,
    1000,
    2000
  ];

  before(async function() {
    await EWE.testing.clearAccountStorage();
    await setServerConfig(ACCOUNT_ROUTES);
  });

  beforeEach(async function() {
    await clearTestEvents("account.onChanged");
    await EWE.testing.stopAccount();
    await startWithTestArgs({
      disableAutosync: true
    });
    onChangedEvents = [];
  });

  after(async function() {
    await resetServerConfig(ACCOUNT_ROUTES);
    await clearTestEvents("account.onChanged");
    await clearRequestLogs();
  });

  it("returns valid data when user is logged out", async function() {
    await assertLogOutUser();
    expect(await EWE.account.getLastTokenUpdate()).toBeNull();
    // No events should be emitted when the user is logged out
    await expectTestEvents("account.onChanged", onChangedEvents);
  });

  it("successfully logs in the user", async function() {
    const beforeLogIn = Date.now();
    await logInUser();

    await waitForAssertion(async() => {
      expect(await EWE.account.isLoggedIn()).toBe(true);
      expect(await EWE.account.hasPremium()).toBe(false);
      expect(await EWE.account.getProfile()).toBeNull();
      expect(await EWE.account.getProfileSyncStatus()).toEqual({});

      const lastTokenUpdate = await EWE.account.getLastTokenUpdate();
      expect(lastTokenUpdate).toBeGreaterThanOrEqual(beforeLogIn);
      expect(lastTokenUpdate).toBeLessThanOrEqual(Date.now());
    });
    // No events should be emitted until the profile is fetched
    await expectTestEvents("account.onChanged", onChangedEvents);
  });

  it("successfully starts profile sync if user is logged in", async function() {
    await EWE.testing.stopAccount();
    await startWithTestArgs({
      disableAutosync: false
    });
    await expectNextPing({
      expectedNewPingCount: 1,
      url: PROFILE_SYNC_URL
    });
    await assertFreeUser();
    // Check that the on changed event is emitted
    onChangedEvents.push([{oldUser: null, user: STORED_FREE_USER_PROFILE}]);
    await expectTestEvents("account.onChanged", onChangedEvents);
  });

  it("successfully logs out the user", async function() {
    await EWE.testing.stopAccount();
    await sleep(1000);
    await EWE.account.logOut();

    await assertLogOutUser();
    // The last token update is kept after logging out
    expect(await EWE.account.getLastTokenUpdate()).not.toBeNull();

    // Check that the logout event was emitted
    onChangedEvents.push([{user: null}]);
    await expectTestEvents("account.onChanged", onChangedEvents);
  });

  describe("Profile Sync", function() {
    setMinTimeout(this, 20000);

    beforeEach(async function() {
      await EWE.testing.stopAccount();
      await EWE.testing.clearAccountStorage();
      await startWithTestArgs({
        disableAutosync: false
      });
      await setServerConfig(ACCOUNT_ROUTES);
      await clearRequestLogs();
      await clearTestEvents("account.onChanged");
    });

    it("updates the profile on schedule", async function() {
      await assertLogOutUser();
      await logInUser();
      await expectNextPing({
        expectedNewPingCount: 1,
        url: PROFILE_SYNC_URL
      });
      await assertFreeUser();
      const initialSyncStatus = await EWE.account.getProfileSyncStatus();
      onChangedEvents.push([{oldUser: null, user: STORED_FREE_USER_PROFILE}]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      // Simulate a profile update to premium user
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, PREMIUM_USER_PROFILE, "GET", 200);

      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: PROFILE_SYNC_URL
      });
      await assertPremiumUser();
      onChangedEvents.push([{
        oldUser: STORED_FREE_USER_PROFILE,
        user: STORED_PREMIUM_USER_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);
      const updatedSyncStatus = await EWE.account.getProfileSyncStatus();
      expect(updatedSyncStatus.lastSuccessfulRequest)
        .not.toBe(initialSyncStatus.lastSuccessfulRequest);
      expect(await getRequestLogIntervals(PROFILE_SYNC_URL))
        .toEqual([PING_INTERVAL_MS]);
    });

    it("logs in successfully with license and starts the scheduler", async function() {
      await assertLogOutUser();
      await EWE.account.logInWithLicense({
        clientId: "test-client-id",
        licenseId: "test-license-id"
      });
      await assertFreeUser();
      onChangedEvents.push([{oldUser: null, user: STORED_FREE_USER_PROFILE}]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      await expectNextPing({
        expectedNewPingCount: 1,
        url: PROFILE_SYNC_URL
      });
      await assertFreeUser();
      // Data on profile is the same so no event is emitted
      await expectTestEvents("account.onChanged", onChangedEvents);

      const initialSyncStatus = await EWE.account.getProfileSyncStatus();

      // Simulate a profile update to premium user
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, PREMIUM_USER_PROFILE, "GET", 200);

      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: PROFILE_SYNC_URL
      });
      await assertPremiumUser();
      onChangedEvents.push([{
        oldUser: STORED_FREE_USER_PROFILE,
        user: STORED_PREMIUM_USER_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      const updatedSyncStatus = await EWE.account.getProfileSyncStatus();
      expect(updatedSyncStatus.lastSuccessfulRequest)
        .not.toBe(initialSyncStatus.lastSuccessfulRequest);
      expect(await getRequestLogIntervals(PROFILE_SYNC_URL))
        .toEqual([PING_INTERVAL_MS]);
    });

    it("scheduler logs out the user if the tokens expired", async function() {
      const timeout = 4 * MILLIS_IN_SECOND;
      await assertLogOutUser();
      await logInUser();
      await expectNextPing({
        expectedNewPingCount: 1,
        url: PROFILE_SYNC_URL,
        timeout
      });
      await assertFreeUser();
      onChangedEvents.push([{oldUser: null, user: STORED_FREE_USER_PROFILE}]);

      // Simulate access token expiration
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, REFRESH_TOKEN_INVALID_ERROR, "GET", 401);
      // Simulate refresh token expiration
      await setEndpointResponse(ACCOUNT_PATHS.REFRESH_TOKENS, REFRESH_TOKEN_INVALID_ERROR, "POST", 401);

      await assertLogOutUser();
      onChangedEvents.push([{user: null}]);
      expect(await getRequestLogIntervals(PROFILE_SYNC_URL))
        .toEqual([PING_INTERVAL_MS]);
      await expectTestEvents("account.onChanged", onChangedEvents);
    });

    it("syncs with error retry delay if there is a network error or server error", async function() {
      const syncInterval = 4 * MILLIS_IN_SECOND;
      const errorRetryDelay = 3 * MILLIS_IN_SECOND;
      const maxFetchRetryDelay = 4 * MILLIS_IN_SECOND;
      const timeout = syncInterval + maxFetchRetryDelay;

      await EWE.testing.stopAccount();
      await EWE.testing.clearAccountStorage();
      await startWithTestArgs({
        syncInterval,
        errorRetryDelay,
        disableAutosync: false
      });

      await logInUser();
      await expectNextPing({
        expectedNewPingCount: 1,
        url: PROFILE_SYNC_URL
      });
      await assertFreeUser();
      // The first profile sync should emit an event with the free user profile
      onChangedEvents.push([{oldUser: null, user: STORED_FREE_USER_PROFILE}]);

      // Simulate an internal server error
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, INTERNAL_SERVER_ERROR, "GET", 500);

      await delayThenExpectNextPing({
        delay: syncInterval,
        url: PROFILE_SYNC_URL,
        timeout
      });

      await assertAccountState({
        isLoggedIn: true,
        hasPremium: false,
        profile: STORED_FREE_USER_PROFILE,
        expectLastSuccessfulRequest: true,
        expectLastRequestError: true,
        timeout: maxFetchRetryDelay
      });

      // Simulate the server has recovered and the profile is available again
      // Simulate a profile update to premium user
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, PREMIUM_USER_PROFILE, "GET", 200);

      await delayThenExpectNextPing({
        delay: errorRetryDelay,
        url: PROFILE_SYNC_URL
      });

      // There should not be a request error after the retry.
      await assertAccountState({
        isLoggedIn: true,
        hasPremium: true,
        profile: STORED_PREMIUM_USER_PROFILE,
        expectLastSuccessfulRequest: true,
        expectLastRequestError: false
      });
      // The second profile sync should emit an event
      onChangedEvents.push([{
        oldUser: STORED_FREE_USER_PROFILE,
        user: STORED_PREMIUM_USER_PROFILE
      }]);

      await delayThenExpectNextPing({
        delay: syncInterval,
        url: PROFILE_SYNC_URL
      });

      await assertAccountState({
        isLoggedIn: true,
        hasPremium: true,
        profile: STORED_PREMIUM_USER_PROFILE,
        expectLastSuccessfulRequest: true,
        expectLastRequestError: false
      });

      await expectTestEvents("account.onChanged", onChangedEvents);
    });

    it("syncs with error delay when the service worker is suspended after a server error [mv3-only]", async function() {
      const syncInterval = 4 * MILLIS_IN_SECOND;
      const errorRetryDelay = 3 * MILLIS_IN_SECOND;
      const maxFetchRetryDelay = 2.5 * MILLIS_IN_SECOND;
      const timeout = syncInterval + maxFetchRetryDelay;

      await EWE.testing.stopAccount();
      await EWE.testing.clearAccountStorage();
      await startWithTestArgs({
        syncInterval,
        errorRetryDelay,
        disableAutosync: false
      });

      // Simulate an internal server error
      await setEndpointResponse(ACCOUNT_PATHS.PROFILE, INTERNAL_SERVER_ERROR, "GET", 500);

      await logInUser();
      await expectNextPing({
        expectedNewPingCount: 1,
        url: PROFILE_SYNC_URL,
        timeout
      });
      await assertAccountState({
        isLoggedIn: true,
        hasPremium: false,
        profile: null,
        expectLastSuccessfulRequest: false,
        expectLastRequestError: true,
        timeout
      });

      // Suspend the service worker
      await suspendServiceWorker(this);
      await EWE.testing.stopAccount();
      await startWithTestArgs({
        syncInterval,
        errorRetryDelay,
        disableAutosync: false
      });

      await delayThenExpectNextPing({
        delay: errorRetryDelay,
        url: PROFILE_SYNC_URL,
        timeout
      });
      await assertAccountState({
        isLoggedIn: true,
        hasPremium: false,
        profile: null,
        expectLastSuccessfulRequest: false,
        expectLastRequestError: true,
        timeout: maxFetchRetryDelay
      });

      // No events should be emitted because the profile was not fetched
      await expectTestEvents("account.onChanged", []);

      const maxFetchDuration = retryFetchIntervals.reduce(
        (total, num) => total + num,
        0
      );

      // First 2 requests are the initial fetch retry attempts
      // This one might take longer if the service worker startup is slow. But
      // it absolutely should not happen sooner than the backoff delay
      // minus the max fetch duration of all retry attempts.
      expect((await getRequestLogIntervals(PROFILE_SYNC_URL))[2])
        .toBeGreaterThanOrEqual(errorRetryDelay - maxFetchDuration);
    });
  });

  describe("Trial user profile", function() {
    beforeEach(async function() {
      await EWE.testing.stopAccount();
      await EWE.testing.clearAccountStorage();
      await startWithTestArgs({disableAutosync: false});
      await setEndpointResponse(
        ACCOUNT_PATHS.PROFILE,
        PREMIUM_USER_WITH_TRIAL_PROFILE,
        "GET",
        200
      );
      await clearTestEvents("account.onChanged");
      onChangedEvents = [];
    });

    it("identifies user on trial as premium", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      onChangedEvents.push([{
        oldUser: null,
        user: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);
    });

    it("returns correct trial status for trial user", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      const trial = await EWE.account.isTrial();
      expect(trial).toBe(true);
    });

    it("returns trial days left for trial user", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      const trialDaysLeft = await EWE.account.getTrialDaysLeft();
      expect(trialDaysLeft).toBe(15);
    });

    it("returns correct preferences for trial user", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      const preferences = await EWE.account.getPreferences();
      expect(preferences).toEqual({marketingEmail: false});
    });

    it("transitions from trial to paid premium", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      onChangedEvents.push([{
        oldUser: null,
        user: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      // Simulate trial ending and user purchasing premium
      await setEndpointResponse(
        ACCOUNT_PATHS.PROFILE,
        PREMIUM_USER_PROFILE,
        "GET",
        200
      );

      // Wait for profile sync to pick up the change
      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: PROFILE_SYNC_URL
      });
      await assertPremiumUser();

      onChangedEvents.push([{
        oldUser: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE,
        user: STORED_PREMIUM_USER_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      // Verify trial status changed
      const trial = await EWE.account.isTrial();
      expect(trial).toBe(false);

      const trialDaysLeft = await EWE.account.getTrialDaysLeft();
      expect(trialDaysLeft).toBe(0);
    });

    it("transitions from trial to free user", async function() {
      await logInUser();
      await assertPremiumUserWithTrial();

      onChangedEvents.push([{
        oldUser: null,
        user: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      // Simulate trial expiring without purchase
      await setEndpointResponse(
        ACCOUNT_PATHS.PROFILE,
        {user: STORED_FREE_USER_PROFILE},
        "GET",
        200
      );

      // Wait for profile sync to pick up the change
      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: PROFILE_SYNC_URL
      });
      await assertFreeUser();

      onChangedEvents.push([{
        oldUser: STORED_PREMIUM_USER_WITH_TRIAL_PROFILE,
        user: STORED_FREE_USER_PROFILE
      }]);
      await expectTestEvents("account.onChanged", onChangedEvents);

      // Verify trial status changed
      const trial = await EWE.account.isTrial();
      expect(trial).toBe(false);

      const trialDaysLeft = await EWE.account.getTrialDaysLeft();
      expect(trialDaysLeft).toBe(0);
    });
  });
});
