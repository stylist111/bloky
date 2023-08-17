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

import {wait, TEST_ADMIN_PAGES_URL, TEST_MV3_SUBSCRIPTION_3, getRequestLogs,
        clearRequestLogs, setEndpointResponse, setMinTimeout, Page,
        waitForSubscriptionToBeSynchronized, shouldBeLoaded,
        hasUpdateStaticRules} from "./utils.js";
import {EWE, addFilter} from "./messaging.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {MILLIS_IN_HOUR, MILLIS_IN_DAY} from "adblockpluscore/lib/time.js";

describe("Synchronization", function() {
  this.timeout(30000);
  const METHOD_HEAD = "HEAD";

  async function configure(properties = {}) {
    await EWE.testing._setSubscriptions([TEST_MV3_SUBSCRIPTION_3]);

    await clearRequestLogs();
    let reply = "%5BAdblock%20Plus%5D%0A%21%20Expires%3A%201%20d"; // "! Expires: 1 d"
    await fetch(`${TEST_ADMIN_PAGES_URL}/configure?reply=${reply}`);

    await EWE.testing._removeAllSubscriptions();
    await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION_3.url, properties);

    let downloadables = await EWE.subscriptions.getDownloadable();
    expect(downloadables.length).toEqual(1);
    expect(downloadables).toEqual([expect.objectContaining({
      downloadable: false // Countable Sub
    })]);
  }

  async function requestsSent(url) {
    await wait(async() => {
      let requests = await getRequestLogs(url);
      return requests.length > 0;
    }, 20000, "No requests sent", 100);
  }

  it("sends HEAD requests for expired subscriptions after service worker restarts [mv3-only] [fuzz-skip]", async function() {
    await configure();
    await requestsSent(TEST_MV3_SUBSCRIPTION_3.url);
    await clearRequestLogs();

    let now = Date.now();
    let softExpiration = now / 1000; // seconds, not millis
    await EWE.testing._setSubscriptionProperties(
      TEST_MV3_SUBSCRIPTION_3.url, {
        softExpiration, expires: softExpiration,
        lastDownload: 1
      });

    await suspendServiceWorker(this);
    await addFilter("someFilterToAwakeTheSW");

    await requestsSent(TEST_MV3_SUBSCRIPTION_3.url);

    let requests = await getRequestLogs(TEST_MV3_SUBSCRIPTION_3.url);

    expect(requests.length).toEqual(1);
    expect(requests).toEqual([expect.objectContaining({
      method: METHOD_HEAD
    })]);
  });

  describe("Diff updates expiration", function() {
    let defaultCheckInterval;
    let defaultInitialDelay;

    beforeEach(async function() {
      // store default values from prefs
      defaultCheckInterval = await EWE.testing._getPrefs(
        "subscriptions_check_interval"
      );
      defaultInitialDelay = await EWE.testing._getPrefs(
        "subscriptions_initial_delay"
      );
    });

    afterEach(async function() {
      // cleanup
      await EWE.testing._setPrefs("subscriptions_check_interval", defaultCheckInterval);
      await EWE.testing._setPrefs("subscriptions_initial_delay", defaultInitialDelay);
      await EWE.testing._restartSynchronizer();
    });

    it("runs diff updates when a subscription expires [mv3-only]", async function() {
      setMinTimeout(this, 10000);

      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await shouldBeLoaded(
        "image.html",
        "image.png"
      );

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: ["image.png"],
          remove: []
        }
      }));

      // force the subscription to be expired
      let now = Date.now();
      let expiration = (now / 1000) + 1; // 1 second in the future
      await EWE.testing._setSubscriptionProperties(
        testDiffSubscriptionUrl, {
          softExpiration: expiration, expires: expiration,
          lastDownload: 1
        }
      );

      // make the downloader check for updates every 100ms
      await EWE.testing._setPrefs("subscriptions_check_interval", 100);
      await EWE.testing._setPrefs("subscriptions_initial_delay", 0);
      await EWE.testing._restartSynchronizer();
      // waiting for the subscription to be updated automatically
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);
      await new Page("image.html").expectResource("image.png").toBeBlocked();
    });

    it("uses diff updatable subscription expiration interval if provided", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      // The default interval is set to "5 days"
      await EWE.testing._setPrefs(
        "subscriptions_default_expiration_interval",
        5 * MILLIS_IN_DAY);

      // The subscription update interval is "1 day"
      let testDiffSubscriptionUrl =
        "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      const allDownloadables = await EWE.subscriptions.getDownloadable();
      const subscription =
        allDownloadables.find(
          eachSubscription => eachSubscription.url === testDiffSubscriptionUrl);

      // The subscription.expires should be 2 days (double the interval),
      // and the default value it's 10 days.
      // So we set the limit to 2 days + 1 hour.
      const limitExpiration =
        (Date.now() + (2 * MILLIS_IN_DAY) + MILLIS_IN_HOUR) / 1000; // in secs
      // the extra hour is to compensate the difference between Date.now()
      // calculated in the test and Date.now() calculated in Synchronizer.
      expect(subscription.expires).toBeLessThan(limitExpiration);
    });

    it("uses default diff updatable subscription expiration interval if not provided", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      // The default interval is 5 days
      await EWE.testing._setPrefs(
        "subscriptions_default_expiration_interval",
        5 * MILLIS_IN_DAY);

      // The subscription update interval is expected to be NOT set.
      let testDiffSubscriptionUrl = "http://localhost:3003/anti-cv-subscription.txt";
      let testDiffUrlEndpoint = "http://localhost:3003/anti-cv-subscription_diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      const allDownloadables = await EWE.subscriptions.getDownloadable();
      const subscription =
        allDownloadables.find(
          eachSubscription => eachSubscription.url === testDiffSubscriptionUrl);

      // 10 days - 1 hour in the future: it's double update interval - some gap
      // to compensate the difference between test Date.now() and Date.now()
      // that was actually used in Synchronizer for calculating `.expires`.
      const limitExpiration =
        (Date.now() + (10 * MILLIS_IN_DAY) - MILLIS_IN_HOUR) / 1000;

      expect(subscription.expires).toBeGreaterThan(limitExpiration);
    });
  });
});
