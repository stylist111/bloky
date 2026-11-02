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

// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

import {subAntiCVLocal, subEasylistLocal, subAcceptableAdsLocal}
  from "../../fixtures/subscriptions.js";

describe("EWE.subscriptions", function() {
  let subscriptions;
  let migrate;
  let updateSubscriptionInformation;

  async function mockAndImport(addAliases = null) {
    let module = await mock("subscriptions.js", null, addAliases);
    subscriptions = module.default;
    ({migrate, updateSubscriptionInformation} = module);
  }

  const LEDGER_KEY = "ewe:subscriptionLedger";
  const SUBSCRIPTION_URL = "https://example.com/subscription.txt";
  const RULESET_ID = "ruleset-id";

  async function getLedger() {
    let items = await env.browser.storage.local.get(LEDGER_KEY);
    return items[LEDGER_KEY] || {};
  }

  function entry(state, reason) {
    return {state, reason, ts: expect.any(Number)};
  }

  // Sets up a single bundled subscription whose DNR ruleset can be
  // enabled and disabled in the test environment.
  function setupDnrSubscription(properties = {}) {
    // eslint-disable-next-line no-undef
    let {RegularSubscription} = global.subscriptionClasses;
    let subscription = Object.assign(new RegularSubscription(), {
      url: SUBSCRIPTION_URL,
      id: RULESET_ID,
      disabled: false,
      ...properties
    });
    // eslint-disable-next-line no-undef
    global.fromURL = () => subscription;
    env.setFilterStorageSubscriptions([subscription]);
    env.navigator.userAgent = "Mozilla/5.0 Chrome/130.0";

    env.browser.runtime.manifest.declarative_net_request.rule_resources =
      [{id: subscription.id}];
    Object.assign(env.browser.declarativeNetRequest, {
      getEnabledRulesets: () => Promise.resolve([]),
      updateEnabledRulesets: () => Promise.resolve(),
      getDisabledRuleIds: () => Promise.resolve([]),
      updateStaticRules: () => Promise.resolve()
    });

    return subscription;
  }

  beforeEach(async function() {
    env.configure();
    await mockAndImport();
    env.setRecommendations([]);
    env.setFilterStorageSubscriptions([]);
  });

  describe("addDefaults()", function() {
    it("throws if no default language subscription is provided", async function() {
      env.setRecommendations([]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No default language subscription");
    });

    it("throws if no anti-circumvention subscription is provided", async function() {
      env.setRecommendations([subEasylistLocal, subAcceptableAdsLocal]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No anti-circumvention subscription");
    });

    it("throws if no allowing subscription is provided", async function() {
      env.setRecommendations([subEasylistLocal, subAntiCVLocal]);
      await expect(subscriptions.addDefaults("en"))
        .rejects.toThrow("No allowing subscription");
    });
  });

  describe("ledger when enabling or disabling DNR rulesets", function() {
    const DNR_ERROR = "Internal error";

    let subscription;

    beforeEach(function() {
      subscription = setupDnrSubscription();
    });

    it("records enabling a subscription once its ruleset is enabled", async function() {
      subscription.disabled = true;

      await subscriptions.enable(SUBSCRIPTION_URL, {reason: "user_action"});

      expect(subscription.disabled).toBe(false);
      expect(await getLedger()).toEqual({
        [SUBSCRIPTION_URL]: entry("enabled", "user_action")
      });
    });

    it("doesn't record enabling a subscription if enabling its ruleset fails", async function() {
      subscription.disabled = true;
      env.browser.declarativeNetRequest.updateEnabledRulesets =
        () => Promise.reject(new Error(DNR_ERROR));

      await expect(subscriptions.enable(SUBSCRIPTION_URL,
                                        {reason: "user_action"}))
        .rejects.toThrow(DNR_ERROR);

      expect(subscription.disabled).toBe(true);
      expect(await getLedger()).toEqual({});
    });

    it("records removing a subscription once its ruleset is disabled", async function() {
      env.browser.declarativeNetRequest.getEnabledRulesets =
        () => Promise.resolve([RULESET_ID]);

      await subscriptions.remove(SUBSCRIPTION_URL);

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([]);
      expect(await getLedger()).toEqual({
        [SUBSCRIPTION_URL]: entry("removed", "unknown")
      });
    });

    it("changes the subscription before writing the ledger", async function() {
      // Anything observing the subscriptions, e.g. the UI asking for them
      // right after adding one, must see the change without waiting for
      // the ledger to be written to storage.
      const NEW_URL = "https://example.com/new-subscription.txt";
      // eslint-disable-next-line no-undef
      let {RegularSubscription} = global.subscriptionClasses;
      let newSubscription = Object.assign(new RegularSubscription(), {
        url: NEW_URL,
        downloadable: true,
        lastDownload: 1,
        disabled: false
      });
      // eslint-disable-next-line no-undef
      global.fromURL = url => (url == NEW_URL ? newSubscription : subscription);

      let adding = subscriptions.add(NEW_URL, {reason: "user_action"});
      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toContain(newSubscription);
      await adding;

      let disabling = subscriptions.disable(NEW_URL, {reason: "user_action"});
      expect(newSubscription.disabled).toBe(true);
      await disabling;

      expect(await getLedger()).toEqual({
        [NEW_URL]: entry("disabled", "user_action")
      });
    });

    it("doesn't record removing a subscription if disabling its ruleset fails", async function() {
      env.browser.declarativeNetRequest.getEnabledRulesets =
        () => Promise.resolve([RULESET_ID]);
      env.browser.declarativeNetRequest.updateEnabledRulesets =
        () => Promise.reject(new Error(DNR_ERROR));

      await expect(subscriptions.remove(SUBSCRIPTION_URL,
                                        {reason: "user_action"}))
        .rejects.toThrow(DNR_ERROR);

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([subscription]);
      expect(await getLedger()).toEqual({});
    });
  });

  describe("migrate()", function() {
    const MV2_URL = "https://example.com/mv2/subscription.txt";
    const MV3_URL = "https://example.com/mv3/subscription.txt";
    const DNR_ERROR = "Internal error";

    let prefs;
    let mv2Subscription;
    let mv3Subscription;

    after(function() {
      // eslint-disable-next-line no-undef
      delete global.addonBundledSubscriptions;
    });

    beforeEach(async function() {
      prefs = {migration_subscription_errors: []};
      env.setPrefs(prefs);
      // eslint-disable-next-line no-undef
      global.addonBundledSubscriptions = [
        {id: RULESET_ID, url: MV3_URL, mv2_url: MV2_URL}
      ];
      // Both are read when the module under test is imported, so import it
      // again, with the bundled subscriptions coming from the mock.
      await mockAndImport(["./info.js"]);

      // eslint-disable-next-line no-undef
      let {RegularSubscription} = global.subscriptionClasses;
      mv2Subscription = Object.assign(new RegularSubscription(), {
        url: MV2_URL,
        downloadable: true,
        disabled: false,
        downloadCount: 3,
        version: 42
      });
      mv3Subscription = Object.assign(new RegularSubscription(), {
        url: MV3_URL,
        id: RULESET_ID,
        downloadable: false,
        disabled: false,
        lastDownload: 1
      });
      // eslint-disable-next-line no-undef
      global.fromURL =
        url => (url == MV3_URL ? mv3Subscription : mv2Subscription);
      env.setFilterStorageSubscriptions([mv2Subscription]);

      env.browser.runtime.manifest.declarative_net_request.rule_resources =
        [{id: RULESET_ID}];
      Object.assign(env.browser.declarativeNetRequest, {
        getEnabledRulesets: () => Promise.resolve([]),
        updateEnabledRulesets: () => Promise.resolve()
      });
    });

    it("replaces a downloadable subscription with its bundled one", async function() {
      await migrate();

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([mv3Subscription]);
      expect(mv3Subscription.downloadCount).toBe(3);
      expect(mv3Subscription.version).toBe(42);
      expect(prefs.migration_subscription_errors).toEqual([]);
      expect(await getLedger()).toEqual({
        [MV2_URL]: entry("removed", "migration"),
        [MV3_URL]: entry("enabled", "migration")
      });
    });

    it("records a migration error if adding the bundled one fails", async function() {
      env.browser.declarativeNetRequest.updateEnabledRulesets =
        () => Promise.reject(new Error(DNR_ERROR));

      await migrate();

      expect(prefs.migration_subscription_errors).toEqual([{
        subscription: expect.objectContaining({url: MV2_URL}),
        error: expect.stringContaining(DNR_ERROR)
      }]);
    });
  });

  describe("updateSubscriptionInformation()", function() {
    const MV2_URL = "https://example.com/mv2/subscription.txt";
    const MV3_URL = "https://example.com/mv3/subscription.txt";
    const DNR_ERROR = "Internal error";

    let mv2Subscription;
    let mv3Subscription;

    after(function() {
      // eslint-disable-next-line no-undef
      delete global.addonBundledSubscriptions;
    });

    beforeEach(async function() {
      // eslint-disable-next-line no-undef
      global.addonBundledSubscriptions = [
        {id: RULESET_ID, url: MV3_URL, mv2_url: MV2_URL}
      ];
      // The bundled subscriptions are read when the module under test is
      // imported, so import it again, with them coming from the mock.
      await mockAndImport(["./info.js"]);

      // eslint-disable-next-line no-undef
      let {RegularSubscription} = global.subscriptionClasses;
      mv2Subscription = Object.assign(new RegularSubscription(), {
        url: MV2_URL,
        downloadable: true,
        disabled: false,
        downloadCount: 3,
        version: 42
      });
      mv3Subscription = Object.assign(new RegularSubscription(), {
        url: MV3_URL,
        id: RULESET_ID,
        downloadable: false,
        hasBundledFilters: true,
        disabled: false,
        lastDownload: 1
      });
      // eslint-disable-next-line no-undef
      global.fromURL =
        url => (url == MV3_URL ? mv3Subscription : mv2Subscription);
      env.setFilterStorageSubscriptions([mv2Subscription]);
      env.navigator.userAgent = "Mozilla/5.0 Chrome/130.0";

      env.browser.runtime.manifest.declarative_net_request.rule_resources =
        [{id: RULESET_ID}];
      Object.assign(env.browser.declarativeNetRequest, {
        getEnabledRulesets: () => Promise.resolve([]),
        updateEnabledRulesets: () => Promise.resolve(),
        getDisabledRuleIds: () => Promise.resolve([]),
        updateStaticRules: () => Promise.resolve()
      });
    });

    it("moves a subscription on a bundled one's MV2 URL to the bundled one", async function() {
      await updateSubscriptionInformation();

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([mv3Subscription]);
      expect(mv3Subscription.downloadCount).toBe(3);
      expect(mv3Subscription.version).toBe(42);
      expect(mv3Subscription.disabled).toBe(false);
      expect(await getLedger()).toEqual({
        [MV2_URL]: entry("removed", "migration"),
        [MV3_URL]: entry("enabled", "migration")
      });
    });

    it("keeps the bundled one disabled if the MV2 one was disabled", async function() {
      mv2Subscription.disabled = true;

      await updateSubscriptionInformation();

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([mv3Subscription]);
      expect(mv3Subscription.disabled).toBe(true);
      expect(await getLedger()).toEqual({
        [MV2_URL]: entry("removed", "migration"),
        [MV3_URL]: entry("disabled", "migration")
      });
    });

    it("adds the bundled one before removing the MV2 one", async function() {
      let storedWhenEnabling;
      env.browser.declarativeNetRequest.updateEnabledRulesets = () => {
        // eslint-disable-next-line no-undef
        storedWhenEnabling = [...global.filterStorageSubscriptions];
        return Promise.resolve();
      };

      await updateSubscriptionInformation();

      expect(storedWhenEnabling).toEqual([mv2Subscription, mv3Subscription]);
      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([mv3Subscription]);
    });

    it("keeps the MV2 one if enabling the bundled one fails", async function() {
      env.browser.declarativeNetRequest.updateEnabledRulesets =
        () => Promise.reject(new Error(DNR_ERROR));

      await expect(updateSubscriptionInformation()).rejects.toThrow(DNR_ERROR);

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([
        mv2Subscription, mv3Subscription
      ]);
      expect(await getLedger()).toEqual({
        [MV3_URL]: entry("enabled", "migration")
      });
    });

    it("only removes the MV2 one if the bundled one is already there", async function() {
      mv3Subscription.downloadCount = 7;
      env.setFilterStorageSubscriptions([mv2Subscription, mv3Subscription]);

      await updateSubscriptionInformation();

      // eslint-disable-next-line no-undef
      expect(global.filterStorageSubscriptions).toEqual([mv3Subscription]);
      expect(mv3Subscription.downloadCount).toBe(7);
      expect(mv3Subscription.disabled).toBe(false);
      expect(await getLedger()).toEqual({
        [MV2_URL]: entry("removed", "migration")
      });
    });
  });

  describe("restoreFromLedger()", function() {
    const PREMIUM_ID = "CDAD4CF5-2706-42CB-B404-F5B9B61B8CAA";

    let subscription;

    async function setLedger(entries) {
      await env.browser.storage.local.set({[LEDGER_KEY]: entries});
    }

    beforeEach(async function() {
      // eslint-disable-next-line no-undef
      global.__hasPremium = false;
      subscription = setupDnrSubscription({disabled: true});
      await setLedger({
        [SUBSCRIPTION_URL]: {state: "enabled", reason: "user_action", ts: 1}
      });
    });

    afterEach(function() {
      // eslint-disable-next-line no-undef
      delete global.__hasPremium;
    });

    it("restores a subscription recorded as enabled", async function() {
      let result = await subscriptions.restoreFromLedger();

      expect(result).toEqual({
        restored: [SUBSCRIPTION_URL], skipped: [], errors: []
      });
      expect(subscription.disabled).toBe(false);
      expect(await getLedger()).toEqual({
        [SUBSCRIPTION_URL]: entry("enabled", "recovery")
      });
    });

    it("skips a premium subscription without a premium plan", async function() {
      subscription = setupDnrSubscription({disabled: true, id: PREMIUM_ID});

      let result = await subscriptions.restoreFromLedger();

      expect(result).toEqual({
        restored: [],
        skipped: [{url: SUBSCRIPTION_URL, reason: "no_premium"}],
        errors: []
      });
      expect(subscription.disabled).toBe(true);
      expect(await getLedger()).toEqual({
        [SUBSCRIPTION_URL]: {state: "enabled", reason: "user_action", ts: 1}
      });
    });

    it("restores a premium subscription with a premium plan", async function() {
      // eslint-disable-next-line no-undef
      global.__hasPremium = true;
      subscription = setupDnrSubscription({disabled: true, id: PREMIUM_ID});

      let result = await subscriptions.restoreFromLedger();

      expect(result).toEqual({
        restored: [SUBSCRIPTION_URL], skipped: [], errors: []
      });
      expect(subscription.disabled).toBe(false);
      expect(await getLedger()).toEqual({
        [SUBSCRIPTION_URL]: entry("enabled", "recovery")
      });
    });

    it("doesn't report a premium subscription that needs no change", async function() {
      subscription = setupDnrSubscription({disabled: false, id: PREMIUM_ID});

      let result = await subscriptions.restoreFromLedger();

      expect(result).toEqual({restored: [], skipped: [], errors: []});
    });

    it("reports a failure to restore a subscription", async function() {
      env.browser.declarativeNetRequest.updateEnabledRulesets =
        () => Promise.reject(new Error("Internal error"));

      let result = await subscriptions.restoreFromLedger();

      expect(result).toEqual({
        restored: [],
        skipped: [],
        errors: [{
          url: SUBSCRIPTION_URL,
          error: expect.stringContaining("Internal error")
        }]
      });
      expect(subscription.disabled).toBe(true);
    });
  });
});
