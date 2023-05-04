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

import browser from "webextension-polyfill";
import expect from "expect";
import {DnrMapper} from "adblockpluscore/lib/dnr/mapper.js";
import {EWE} from "./messaging.js";
import {hasUpdateStaticRules} from "./utils.js";

const UPDATABLE_SUBSCRIPTION_ID = "65ABBA21-96DA-40EB-8C43-BA9A5073B211";

const DYNAMIC_FILTER = "||b5gxiibirp.invalid^";
const DYNAMIC_FILTER2 = "||ttle10x9w7.invalid^";
const DYNAMIC_FILTER3 = "||ma50byuiyppz.invalid^";
const STATIC_FILTER_TO_DISABLE = "||kiihsbhe.invalid^";

const EMPTY_UPDATE = {
  added: [
  ],
  removed: [
  ]
};

const UPDATES = {
  added: [
    "||qkq0b8rl0qa6.invalid^",
    "||aktc734q.invalid^",
    "||zjllt.invalid^",
    "||742y5g6ud9xk.invalid^"
  ],
  removed: [
    "||qd82zmh.invalid^",
    STATIC_FILTER_TO_DISABLE
  ]
};

const UPDATES2 = {
  added: [
    ...UPDATES.added,
    DYNAMIC_FILTER
  ],
  removed: [
    ...UPDATES.removed,
    "||apsj51qbzgh.invalid^"
  ]
};

const UPDATES3 = {
  added: [
    ...UPDATES2.added
  ],
  removed: [
    ...UPDATES2.removed
  ].filter(text => text != STATIC_FILTER_TO_DISABLE)
};

const UPDATES4 = {
  added: [
    ...UPDATES3.added,
    DYNAMIC_FILTER2
  ],
  removed: [
    ...UPDATES3.removed
  ]
};

const UPDATES5 = {
  added: [
    ...UPDATES4.added,
    STATIC_FILTER_TO_DISABLE
  ],
  removed: [
    ...UPDATES4.removed
  ]
};

const SUBSCRIPTION = {
  url: "http://localhost:3003/updateable_subscription.txt",
  type: "ads",
  downloadable: false,
  id: UPDATABLE_SUBSCRIPTION_ID
};

describe("Test subscriptions update", function() {
  async function checkRulesAreDisabled(rulesetId, ruleIds) {
    let disabled = await browser.declarativeNetRequest.getDisabledRuleIds(
      {rulesetId}
    );
    expect(disabled).toEqual(expect.arrayContaining(
      ruleIds
    ));
  }

  async function checkRulesAreNotDisabled(rulesetId, ruleIds) {
    let disabled = await browser.declarativeNetRequest.getDisabledRuleIds(
      {rulesetId}
    );
    expect(disabled).toEqual(expect.not.arrayContaining(
      ruleIds
    ));
  }

  async function checkDynamicRuleCount(count) {
    let dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
    expect(dynamicRules.length).toEqual(count, "dynamic rules count mismatch");

    // Both should be equal.
    let dynamicFilters = await EWE.testing.getDynamicFilters();
    expect(dynamicFilters.length).toEqual(count, "dynamic filters count mismatch");
  }

  async function getDynamicFilter(text) {
    let dynFilters = new Map(await EWE.testing.getDynamicFilters());
    return dynFilters.get(text);
  }

  // Compare two sets of dynamic filters (as returned by
  // `EWE.testing.getDynamicFilters()`). But since the ruleIds can be
  // different, we take this into account.
  function areDynamicFiltersEquivalent(dynFilters1, dynFilters2) {
    expect(dynFilters1.length).toBe(dynFilters2.length);

    let map2 = new Map(dynFilters2);
    for (let [text, detail] of dynFilters1) {
      let detail2 = map2.get(text);
      expect(detail2);
      expect(detail.enabled).toBe(detail2.enabled);
      expect(detail.metadata).toStrictEqual(detail2.metadata);
      // Rule IDs will change, but we should have the same number.
      expect(detail.ruleIds.length).toBe(detail2.ruleIds.length);
      expect(detail.subscriptionIds).toStrictEqual(detail2.subscriptionIds);
      map2.delete(text);
    }

    expect(map2.size).toBe(0);
    return true;
  }

  // Check that a specific state of for subscription `id` has been
  // saved.
  async function checkUpdateStateSaved(id, update) {
    let savedUpdates = await EWE.testing._getPrefs("ruleset_updates");
    expect(savedUpdates).toEqual(
      expect.arrayContaining([[id, update]])
    );
  }

  beforeEach(async function() {
    // Ensure it is enabled.
    await EWE.subscriptions.add(SUBSCRIPTION.url);
  });

  // The purpose of this test is to make sure we change nothing
  // if the static rules update API isn't available.
  it("Doesn't update without the static rules updates [fuzz] [mv3-only]", async function() {
    // If we are on Chrome 111+ we don't run this test.
    if (hasUpdateStaticRules())
      this.skip();

    // The case of the first update.
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES);

    // There should have been no dyamic rules added.
    let added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(0);

    let savedUpdates = await EWE.testing._getPrefs("ruleset_updates");
    expect(savedUpdates).not.toEqual(
      expect.arrayContaining([expect.arrayContaining([SUBSCRIPTION.id])])
    );
  });

  it("Updates subscriptions [fuzz] [mv3-only]", async function() {
    // This is MV3 only and we need Chrome 111+ API for this.
    if (!hasUpdateStaticRules())
      this.skip();

    let mapper = new DnrMapper(async() =>
      await EWE.testing.getSubscriptionRulesetMap(UPDATABLE_SUBSCRIPTION_ID)
    );
    await mapper.load();

    // The case of the first update.
    // Will add 4 new dynamic rules, and disable 2 static rules.
    let dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
    expect(dynamicRules.length).toEqual(0);
    let ids = UPDATES.removed.flatMap(text => mapper.get(text));
    expect(ids.length).toEqual(2);
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES);
    await checkRulesAreDisabled(SUBSCRIPTION.id, ids);
    // Check that 4 dynamic rules have been added.
    let added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(4);
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES);

    // The update disables one more static rule, and add DYNAMIC_FILTER
    ids = UPDATES2.removed.flatMap(text => mapper.get(text));
    expect(ids.length).toEqual(3);
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES2);
    await checkRulesAreDisabled(SUBSCRIPTION.id, ids);
    // Check that we have 5 dynamic rules.
    added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(5);
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES2);

    // The case of the update reenabling a previously disabled static
    // rule STATIC_FILTER_TO_DISABLE
    ids = mapper.get(STATIC_FILTER_TO_DISABLE);
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES3);
    await checkRulesAreNotDisabled(SUBSCRIPTION.id, ids);
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES3);

    // Add a user dynamic filter. This will be used to check overlaps with
    // subscription. This is DYNAMIC_FILTER2
    await EWE.filters.add([DYNAMIC_FILTER2]);
    await checkDynamicRuleCount(6);
    // Still the same update state
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES3);

    // Update that also bring rule DYNAMIC_FILTER2
    let dynFilter = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .toEqual(-1);
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES4);
    await checkDynamicRuleCount(6);
    let dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter2.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .not.toEqual(-1);
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES4);

    // Revert the update so that DYNAMIC_FILTER2 is no longer part of
    // this but is still present.
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES3);
    await checkDynamicRuleCount(6);
    dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter).toEqual(dynFilter2);
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES3);

    // This update will try to enable a static rules that is enabled.
    // It should not change the dynamic rules.
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES5);
    await checkDynamicRuleCount(6);
    let dynFilter3 = await getDynamicFilter(STATIC_FILTER_TO_DISABLE);
    expect(dynFilter3).toBeUndefined();
    await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES5);

    // Empty update: no disabled rules, no dynamic rules.
    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, EMPTY_UPDATE);
    let disabled = await browser.declarativeNetRequest.getDisabledRuleIds(
      {rulesetId: SUBSCRIPTION.id}
    );
    expect(disabled.length).toBe(0);
    await checkUpdateStateSaved(SUBSCRIPTION.id, EMPTY_UPDATE);

    // DYNAMIC_FILTER2 is the last one left.
    await checkDynamicRuleCount(1);
  });

  it("does not add dynamic rules when not added", async function() {
    if (!hasUpdateStaticRules())
      this.skip();

    await EWE.subscriptions.remove(SUBSCRIPTION.url);

    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES4);
    await checkDynamicRuleCount(0);
  });

  it("does not add dynamic rules when not enabled", async function() {
    if (!hasUpdateStaticRules())
      this.skip();

    // We need to mutate the subscription object, so we deep copy.
    let subscription = JSON.parse(JSON.stringify(SUBSCRIPTION));
    await EWE.subscriptions.disable(subscription.url);
    // Because this is a mock subscription, we need to set the
    // disabled property too.
    subscription.disabled = true;

    await EWE.testing.dnrSubscriptionUpdate(subscription, UPDATES4);
    await checkDynamicRuleCount(0);
  });


  it("remove dynamic rules when removed", async function() {
    if (!hasUpdateStaticRules())
      this.skip();

    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we remove the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.remove(SUBSCRIPTION.url);
    await checkDynamicRuleCount(0);
  });

  it("remove dynamic rules when disabled", async function() {
    if (!hasUpdateStaticRules())
      this.skip();

    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we disable the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.disable(SUBSCRIPTION.url);
    await checkDynamicRuleCount(0);
  });

  it("restore dynamic rules when reenabled", async function() {
    if (!hasUpdateStaticRules())
      this.skip();

    await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we disable the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.disable(SUBSCRIPTION.url);
    await checkDynamicRuleCount(0);

    await EWE.subscriptions.enable(SUBSCRIPTION.url);
    await checkDynamicRuleCount(6);
  });

  // Specific test cases for rollback.
  const UPDATES2A = {
    added: [
      ...UPDATES.added,
      DYNAMIC_FILTER3
    ],
    removed: [
      ...UPDATES2.removed
    ]
  };

  const UPDATES2B = {
    added: [
      ...UPDATES.added
    ],
    removed: [
      ...UPDATES2.removed
    ]
  };

  describe("Rollback updates [mv3-only]", function() {
    afterEach(async function() {
      await EWE.testing.testSetDynamicRulesAvailable(0);
    });

    it("Rollback on maximum subscriptions after update", async function() {
      if (!hasUpdateStaticRules())
        this.skip();

      await EWE.testing.testSetDynamicRulesAvailable(5);

      await EWE.filters.add([DYNAMIC_FILTER]);
      await checkDynamicRuleCount(1);

      await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES);
      await checkDynamicRuleCount(5);
      await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES);

      // UPDATES2 will add DYNAMIC_FILTER, but it's already there.
      await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES2);
      await checkDynamicRuleCount(5);
      await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES2);
      let dynFilters = await EWE.testing.getDynamicFilters();

      {
        let map = new Map(dynFilters);
        let detail = map.get(DYNAMIC_FILTER);
        expect(detail);
        expect(detail.subscriptionIds.length).toBe(2);
      }

      // This update should fail
      await expect(EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES2A))
        .rejects.toThrow(
          "FilterError: {\"type\":\"too_many_filters\",\"option\":null}"
        );
      await checkDynamicRuleCount(5);
      // The previous update state should have been kept
      await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES2);

      // Check that DYNAMIC_FILTER is still here
      let dynFilters2 = await EWE.testing.getDynamicFilters();

      {
        let map = new Map(dynFilters2);
        let detail = map.get(DYNAMIC_FILTER);
        expect(detail);
        expect(detail.subscriptionIds.length).toBe(2);
      }

      // `subscriptionIds` WILL be different.
      areDynamicFiltersEquivalent(dynFilters, dynFilters2);

      await EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES2B);
      await checkDynamicRuleCount(5);
      dynFilters2 = await EWE.testing.getDynamicFilters();
      await checkUpdateStateSaved(SUBSCRIPTION.id, UPDATES2B);

      // Check that DYNAMIC_FILTERS has the proper subscriptions, ie NOT
      // just `null`
      let f2 = dynFilters2.find(element => element[0] == DYNAMIC_FILTER);
      expect(f2);
      expect(f2[1].subscriptionIds).toEqual(
        expect.not.arrayContaining([SUBSCRIPTION.id])
      );
      expect(f2[1].subscriptionIds.length).toBe(1);
      expect(f2[1].subscriptionIds).toEqual(
        expect.arrayContaining([null])
      );
    });

    it("Rollback on maximum subscriptions with no updates", async function() {
      if (!hasUpdateStaticRules())
        this.skip();

      await EWE.testing.testSetDynamicRulesAvailable(3);

      // This update should fail
      await expect(EWE.testing.dnrSubscriptionUpdate(SUBSCRIPTION, UPDATES))
        .rejects.toThrow(
          "FilterError: {\"type\":\"too_many_filters\",\"option\":null}"
        );

      await checkDynamicRuleCount(0);
      await checkUpdateStateSaved(SUBSCRIPTION.id, EMPTY_UPDATE);
    });
  });
});
