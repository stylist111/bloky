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
import {EWE, clearTestEvents, expectTestEvents, getTestEvents} from "./messaging.js";
import {hasUpdateStaticRules, Page, setEndpointResponse, shouldBeLoaded,
        setMinTimeout, expectElemHideVisible, expectElemHideHidden,
        syncSubHasLastFilter, syncSubHasNoLastFilter,
        waitForSubscriptionToBeSynchronized, clearRequestLogs, getRequestLogs}
  from "./utils.js";
import {wait} from "./polling.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

const UPDATABLE_SUBSCRIPTION_ID = "00000000-0000-0000-0000-000000000060";
const UPDATABLE_SUBSCRIPTION_URL = "http://localhost:3003/updatable_subscription.txt";

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

const EMPTY_DIFF_UPDATE = JSON.stringify({
  filters: {
    add: [],
    remove: []
  }
});

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
    "1u2pp.invalid##.ads",
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
    ...UPDATES4.removed,
    "###elem-hide"
  ]
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

  // Check the dynamic rule count. It will check consistency with the
  // content of the dynamicFilters.
  async function checkDynamicRuleCount(count) {
    let dynamicRules = await browser.declarativeNetRequest.getDynamicRules();
    expect(dynamicRules.length).toEqual(count, "dynamic rules count mismatch");

    // We count the number of rules in the dynamicFilters and compare that.
    let dynamicFilterRuleCount = 0;
    (await EWE.testing.getDynamicFilters()).forEach(
      dynamicFilter => dynamicFilterRuleCount += dynamicFilter[1].ruleIds.length
    );
    expect(dynamicFilterRuleCount).toEqual(count, "dynamic filters count mismatch");
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
    await clearRequestLogs();
    await setEndpointResponse("/updatable_subscription/diff.json", EMPTY_DIFF_UPDATE);
    await EWE.testing.clearIsDnrSubscriptionUpdating();

    // Ensure it is enabled.
    await EWE.subscriptions.add(UPDATABLE_SUBSCRIPTION_URL);

    if (hasUpdateStaticRules()) {
      await waitForSubscriptionToBeSynchronized(UPDATABLE_SUBSCRIPTION_URL);
    }
  });

  // The purpose of this test is to make sure we change nothing
  // if the static rules update API isn't available.
  it("Doesn't update without the static rules updates [fuzz] [mv3-only]", async function() {
    // If we are on Chrome 111+ we don't run this test.
    if (hasUpdateStaticRules()) {
      this.skip();
    }

    // The case of the first update.
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES);

    // There should have been no dyamic rules added.
    let added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(0);

    let savedUpdates = await EWE.testing._getPrefs("ruleset_updates");
    expect(savedUpdates).not.toEqual(
      expect.arrayContaining([expect.arrayContaining([
        UPDATABLE_SUBSCRIPTION_ID
      ])])
    );
  });

  it("Updates subscriptions [fuzz] [mv3-only]", async function() {
    // This is MV3 only and we need Chrome 111+ API for this.
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

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
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES);
    await checkRulesAreDisabled(UPDATABLE_SUBSCRIPTION_ID, ids);
    // Check that 4 dynamic rules have been added.
    let added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(4);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES);

    // Check that these are not reported as user filter.
    let userFilters = await EWE.filters.getUserFilters();
    expect(userFilters.length).toEqual(0);

    // The update disables one more static rule, and add DYNAMIC_FILTER
    ids = UPDATES2.removed.flatMap(text => mapper.get(text));
    expect(ids.length).toEqual(3);
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES2);
    await checkRulesAreDisabled(UPDATABLE_SUBSCRIPTION_ID, ids);
    // Check that we have 5 dynamic rules.
    added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(5);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES2);

    // The case of the update reenabling a previously disabled static
    // rule STATIC_FILTER_TO_DISABLE
    ids = mapper.get(STATIC_FILTER_TO_DISABLE);
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES3);
    await checkRulesAreNotDisabled(UPDATABLE_SUBSCRIPTION_ID, ids);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES3);

    // Add a user dynamic filter. This will be used to check overlaps with
    // subscription. This is DYNAMIC_FILTER2
    await EWE.filters.add([DYNAMIC_FILTER2]);
    await checkDynamicRuleCount(6);
    // Still the same update state
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES3);

    userFilters = await EWE.filters.getUserFilters();
    expect(userFilters.length).toEqual(1);

    // Update that also bring rule DYNAMIC_FILTER2
    let dynFilter = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .toEqual(-1);
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);
    let dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter2.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .not.toEqual(-1);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES4);

    // Revert the update so that DYNAMIC_FILTER2 is no longer part of
    // this but is still present.
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES3);
    await checkDynamicRuleCount(6);
    dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter).toEqual(dynFilter2);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES3);

    // This update will try to enable a static rules that is enabled.
    // It should not change the dynamic rules.

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES5);
    await checkDynamicRuleCount(6);

    let dynFilter3 = await getDynamicFilter(STATIC_FILTER_TO_DISABLE);
    expect(dynFilter3).toBeUndefined();
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES5);

    // Empty update: no disabled rules, no dynamic rules.
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, EMPTY_UPDATE);
    let disabled = await browser.declarativeNetRequest.getDisabledRuleIds(
      {rulesetId: UPDATABLE_SUBSCRIPTION_ID}
    );
    expect(disabled.length).toBe(0);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, EMPTY_UPDATE);

    // DYNAMIC_FILTER2 is the last one left.
    await checkDynamicRuleCount(1);
  });

  async function hasFilterInSubscription(url, text) {
    let subscriptions = await EWE.subscriptions.getForFilter(text);
    let subscription = subscriptions.find(sub => sub.url == url);
    return !!subscription;
  }

  it("does update the filterStorage [mv3-only]", async function() {
    // This is MV3 only and we need Chrome 111+ API for this.
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);
    let dynFilter = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .not.toEqual(-1);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES4);

    expect(await hasFilterInSubscription(
      UPDATABLE_SUBSCRIPTION_URL, "###elem-hide")).toBe(true);
    expect(await hasFilterInSubscription(
      UPDATABLE_SUBSCRIPTION_URL, DYNAMIC_FILTER2)).toBe(true);
    expect(await hasFilterInSubscription(
      UPDATABLE_SUBSCRIPTION_URL, "1u2pp.invalid##.ads")).toBe(true);

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES5);
    await checkDynamicRuleCount(6);

    let dynFilter2 = await getDynamicFilter(STATIC_FILTER_TO_DISABLE);
    expect(dynFilter2).toBeUndefined();
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES5);
    // This filter is removed in that update
    expect(await hasFilterInSubscription(
      UPDATABLE_SUBSCRIPTION_URL, "###elem-hide")).toBe(false);
  });

  it("does not add dynamic rules when not added", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.subscriptions.remove(UPDATABLE_SUBSCRIPTION_URL);

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(0);
  });

  it("does not add dynamic rules when not enabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.subscriptions.disable(UPDATABLE_SUBSCRIPTION_URL);
    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(0);
  });

  it("removes dynamic rules when removed", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we remove the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.remove(UPDATABLE_SUBSCRIPTION_URL);
    await checkDynamicRuleCount(0);
  });

  it("removes dynamic rules when disabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we disable the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.disable(UPDATABLE_SUBSCRIPTION_URL);
    await checkDynamicRuleCount(0);
  });

  it("restores dynamic rules when reenabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrDiffSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we disable the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.disable(UPDATABLE_SUBSCRIPTION_URL);
    await checkDynamicRuleCount(0);

    await EWE.subscriptions.enable(UPDATABLE_SUBSCRIPTION_URL);
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
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      await EWE.testing.testSetDynamicRulesAvailable(5);

      await EWE.filters.add([DYNAMIC_FILTER]);
      await checkDynamicRuleCount(1);

      await EWE.testing._dnrDiffSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES);
      await checkDynamicRuleCount(5);
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES);

      // UPDATES2 will add DYNAMIC_FILTER, but it's already there.
      await EWE.testing._dnrDiffSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES2);
      await checkDynamicRuleCount(5);
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES2);
      let dynFilters = await EWE.testing.getDynamicFilters();

      {
        let map = new Map(dynFilters);
        let detail = map.get(DYNAMIC_FILTER);
        expect(detail);
        expect(detail.subscriptionIds.length).toBe(2);
      }

      clearTestEvents("subscriptions.onChanged");
      // This update should fail
      await EWE.testing._dnrDiffSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES2A
      );

      const lastEvent = getTestEvents("subscriptions.onChanged").slice(-1);
      expect(lastEvent).toEqual(
        [
          [
            expect.objectContaining({
              url: UPDATABLE_SUBSCRIPTION_URL,
              downloadStatus: "synchronize_diff_too_many_filters"
            }),
            "downloadStatus"
          ]
        ]
      );

      await checkDynamicRuleCount(5);
      // The previous update state should have been kept
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES2);

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

      await EWE.testing._dnrDiffSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES2B);
      await checkDynamicRuleCount(5);
      dynFilters2 = await EWE.testing.getDynamicFilters();
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES2B);

      // Check that DYNAMIC_FILTERS has the proper subscriptions, ie NOT
      // just `null`
      let f2 = dynFilters2.find(element => element[0] == DYNAMIC_FILTER);
      expect(f2);
      expect(f2[1].subscriptionIds).toEqual(
        expect.not.arrayContaining([UPDATABLE_SUBSCRIPTION_ID])
      );
      expect(f2[1].subscriptionIds.length).toBe(1);
      expect(f2[1].subscriptionIds).toEqual(
        expect.arrayContaining([null])
      );
    });

    it("Rollback on maximum subscriptions with no updates", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      await EWE.testing.testSetDynamicRulesAvailable(3);

      clearTestEvents("subscriptions.onChanged");
      // This update should fail
      await EWE.testing._dnrDiffSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES
      );

      const lastEvent = getTestEvents("subscriptions.onChanged").slice(-1);
      expect(lastEvent).toEqual(
        [
          [
            expect.objectContaining({
              url: UPDATABLE_SUBSCRIPTION_URL,
              downloadStatus: "synchronize_diff_too_many_filters"
            }),
            "downloadStatus"
          ]
        ]
      );

      await checkDynamicRuleCount(0);
      await checkDynamicRuleCount(0);
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, EMPTY_UPDATE);
    });
  });

  describe("Updates using the diffing mechanism [mv3-only]", function() {
    setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 10000);

    beforeEach(async function() {
      await EWE.subscriptions.remove(UPDATABLE_SUBSCRIPTION_URL);
      await EWE.testing.clearIsDnrSubscriptionUpdating();
      clearTestEvents("subscriptions.onChanged");
    });

    it("creates a diff enabled subscription when adding one [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      let testDiffUrl = "http://localhost:3003" + testDiffUrlEndpoint;
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: ["###elem-hide-img-request"],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);

      let subs = await EWE.subscriptions.getSubscriptions();

      expect(subs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            diffURL: testDiffUrl,
            enabled: true,
            id: UPDATABLE_SUBSCRIPTION_ID,
            url: testDiffSubscriptionUrl
          })
        ])
      );

      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      // There's a chance that this could get out of sync.

      await expectTestEvents(
        "subscriptions.onAdded",
        expect.arrayContaining([[
          expect.objectContaining({
            url: testDiffSubscriptionUrl,
            diffURL: testDiffUrl
          })
        ]])
      );
    });

    async function diffUpdateIsApplied(
      testDiffSubscriptionUrl, testDiffUrlEndpoint) {
      // start with empty diffs
      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await shouldBeLoaded(
        "image.html",
        "image.png"
      );

      // new filters added to the diffs
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: ["image.png"],
          remove: []
        }
      }));
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);

      await wait(async() => {
        let newDNRrules = await browser.declarativeNetRequest.getDynamicRules();
        if (newDNRrules.length > 0) {
          return true;
        }
      }, 4000, "Subscription was not synchronised properly.");

      // now we block the image
      await new Page("image.html").expectResource("image.png").toBeBlocked();
    }

    it("filters from diffs are not removed when removing the same user filter", async function() {
      await EWE.filters.add("image.png");

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: ["image.png"],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await new Page("image.html")
        .expectResource("image.png")
        .toBeBlocked();

      await EWE.filters.remove("image.png");

      await new Page("image.html")
        .expectResource("image.png")
        .toBeBlocked();
    });

    it("applies and blocks with new request filters added in the diffs [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      await diffUpdateIsApplied(testDiffSubscriptionUrl, testDiffUrlEndpoint);
    });

    it("applies and blocks with new request filters added in the diffs for anti-cv subscription [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/anti-cv-subscription.txt";
      let testDiffUrlEndpoint = "/anti-cv-subscription_diff.json";
      await diffUpdateIsApplied(testDiffSubscriptionUrl, testDiffUrlEndpoint);
    });

    it("applies and blocks with new content filters added in the diffs [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 30000);

      const testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      const testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);

      const elemId = "diff-elem-item";
      await expectElemHideVisible({elemId});

      // add filter
      const filter = "###diff-elem-item";
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [filter],
          remove: []
        }
      }));

      await syncSubHasLastFilter(testDiffSubscriptionUrl, filter);

      await expectElemHideHidden({elemId, timeout: 10000});

      // remove filter
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: [filter]
        }
      }));

      await syncSubHasNoLastFilter(testDiffSubscriptionUrl, filter);

      await expectElemHideVisible({elemId});
    });

    it("Subscriptions with empty diffs still block with normal filters [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);

      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png",
        "Image from subscription did not load correctly even before of adding the subscription");

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();
    });

    it("doesnt apply filters removed by the diffs [mv3-only]", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: ["/image-from-subscription.png^$image"]
        }
      }));
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png"
      );
    });

    it("doesn't remove enabled user filters which conflict with subscription filters", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 20000);

      let filter = "/image-from-custom-filter.png^$image";
      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [filter],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await EWE.filters.add([filter]);
      let userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toMatchObject(
        {
          csp: null,
          enabled: true,
          selector: null,
          slow: false,
          text: "/image-from-custom-filter.png^$image",
          thirdParty: null,
          type: "blocking"
        }
      );
      await new Page("image-from-custom-filter.html")
        .expectResource("image-from-custom-filter.png")
        .toBeBlocked();

      // update reply on the server to remove filter
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: [filter]
        }
      }));

      await EWE.subscriptions.sync(testDiffSubscriptionUrl);

      userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toMatchObject({
        csp: null,
        enabled: true,
        selector: null,
        slow: false,
        text: "/image-from-custom-filter.png^$image",
        thirdParty: null,
        type: "blocking"
      });
      await new Page("image-from-custom-filter.html")
        .expectResource("image-from-custom-filter.png")
        .toBeBlocked();
    });

    it("disables and enables filter from static rulesets", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 20000);

      const filter = "/image-from-subscription.png^$image";
      const testDiffSubscriptionUrl = "http://localhost:3000/subscription.txt";

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();

      // not added by user
      await EWE.filters.disable(filter);

      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png",
        "Image was blocked even though the filter was disabled by user");

      await EWE.filters.enable(filter);

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();
    });

    it("disables and enables user filter that duplicates filter from static ruleset", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 20000);

      const filter = "/image-from-subscription.png^$image";
      const testDiffSubscriptionUrl = "http://localhost:3000/subscription.txt";

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();

      // user filter that is exactly the same as in static ruleset
      await EWE.filters.add(filter);
      await EWE.filters.disable(filter);

      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png",
        "Image was blocked even though the user filter was created and disabled by user");

      await EWE.filters.enable(filter);

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();
    });

    it("enables subscription filter when according disabled user filter is removed", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 20000);

      let filter = "/image-from-custom-filter.png^$image";

      await EWE.filters.add(filter);
      await EWE.filters.disable(filter);

      let userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toEqual(expect.objectContaining({
        text: filter,
        enabled: false
      }));

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [filter],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toEqual(expect.objectContaining({
        text: filter,
        enabled: false
      }));

      await shouldBeLoaded(
        "image-from-custom-filter.html",
        "image-from-custom-filter.png",
        "Image was blocked even though the user filter was created and disabled by user");

      await EWE.filters.remove(filter);

      await new Page("image-from-custom-filter.html")
        .expectResource("image-from-custom-filter.png")
        .toBeBlocked();
    });

    it("doesn't synchronize the same DiffUpdatable subscription concurrently", async function() {
      setMinTimeout(this, 40000);

      if (!hasUpdateStaticRules()) {
        this.skip();
      }
      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      let filter = "someFilter";
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [filter],
          remove: []
        }
      }));
      await EWE.subscriptions.add(testDiffSubscriptionUrl);

      for (let i = 0; i < 1000; i++) {
        await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      }

      let filters = await EWE.subscriptions.getFilters(
        testDiffSubscriptionUrl);
      expect(filters.filter(eachFilter => eachFilter.text === filter).length)
        .toEqual(1);
    });

    it("wipes out diff updates after webext update", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 15000);

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      let filterToAdd = "image.png";
      let filterToDisable = "/image-from-subscription.png^$image";

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [filterToAdd],
          remove: [filterToDisable]
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await wait(async() => {
        let newDNRrules = await browser.declarativeNetRequest.getDynamicRules();
        if (newDNRrules.length > 0 &&
          newDNRrules[0].condition.urlFilter == "image.png") {
          return true;
        }
      }, 3000, "Subscription was not synchronised properly.");

      // filter which is delivered with diff updates is active
      await new Page("image.html")
        .expectResource("image.png")
        .toBeBlocked();

      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png"
      );

      // simulate webext restart
      await EWE.testing.clearSkipInitRulesets(); // called in `onInstalled()`
      await EWE.testing.checkAndInitSubscriptions(false);

      // no dynamic filters
      await checkDynamicRuleCount(0);

      // all diff filters should be wiped out
      let subscriptions = await EWE.subscriptions.getForFilter(filterToAdd);
      expect(subscriptions.length).toEqual(0);

      // filterToAdd is removed and thus is not blocking
      await shouldBeLoaded(
        "image.html",
        "image.png");

      // filterToRemove is added back and thus is blocking
      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();

      let savedUpdates = await EWE.testing._getPrefs("ruleset_updates");
      expect(savedUpdates).toEqual([]);
    });

    it("does not wipe out user filters after webext update", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 15000);

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";
      let filterToAdd = "image.png";

      await EWE.filters.add(filterToAdd);
      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      // user filter is active
      await new Page("image.html")
        .expectResource("image.png")
        .toBeBlocked();

      // simulate webext restart
      await EWE.testing.clearSkipInitRulesets(); // called in `onInstalled()`
      await EWE.testing.checkAndInitSubscriptions(false);

      // user filter is still listed and active
      let userFilters = await EWE.filters.getUserFilters();
      expect(userFilters.length).toEqual(1);

      await new Page("image.html")
        .expectResource("image.png")
        .toBeBlocked();
    });

    it("passes users counting data to back-end", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await clearRequestLogs();
      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      let requests = (await getRequestLogs()).filter(
        eachRequest => eachRequest.url.includes(testDiffUrlEndpoint));
      expect(requests).toEqual(expect.arrayContaining([expect.objectContaining({
        query: expect.objectContaining({
          addonName: expect.any(String),
          addonVersion: expect.any(String),
          application: expect.any(String),
          applicationVersion: expect.any(String),
          platform: expect.any(String),
          platformVersion: expect.any(String),
          lastVersion: expect.any(String),
          downloadCount: expect.any(String),
          disabled: "false",
          manifestVersion: "3"
        })
      })]));
    });

    it("passes firstVersion and lastVersion", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let analytics = await EWE.testing._getPrefs("analytics");
      let previousTrustedHosts = analytics.trustHosts;
      try {
        // we need to make 'localhost' trustedHost to record the response's
        // 'version' as 'firstVersion'.
        analytics.trustedHosts = ["localhost:3003"];
        delete analytics.data; // removes the "firstVersion"
        await EWE.testing._setPrefs("analytics", analytics);

        let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
        let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

        await clearRequestLogs();
        await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
        await EWE.subscriptions.add(testDiffSubscriptionUrl);
        await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

        await clearRequestLogs();
        await EWE.subscriptions.sync(testDiffSubscriptionUrl);
        await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

        let now = new Date();
        let today = `${now.getFullYear()}`;
        today += (now.getMonth() + 1).toString().padStart(2, "0");
        today += now.getDate().toString().padStart(2, "0");

        let requests = (await getRequestLogs()).filter(
          eachRequest => eachRequest.url.includes(testDiffUrlEndpoint));
        for (let eachRequest of requests) {
          expect(eachRequest.query["lastVersion"].startsWith(today)).toEqual(true);
          expect(eachRequest.query["firstVersion"].startsWith(today)).toEqual(true);
        }
      }
      finally {
        analytics.trustHosts = previousTrustedHosts;
        await EWE.testing._setPrefs("analytics", analytics);
      }
    });

    it("passes users counting data to back-end even for disabled subscriptions", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl, {}, "add() from test");
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      await EWE.subscriptions.disable(testDiffSubscriptionUrl);
      await clearRequestLogs();

      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      let requests = (await getRequestLogs()).filter(
        eachRequest => eachRequest.url.includes(testDiffUrlEndpoint));
      expect(requests).toEqual(expect.arrayContaining([expect.objectContaining({
        query: expect.objectContaining({
          disabled: "true"
        })
      })]));
    });

    it("increments downloadCount", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      // after 4 we start sending "4+" to keep the request anonymized
      for (let expectedDownloadCount of ["1", "2", "3", "4", "4+", "4+"]) {
        await clearRequestLogs();
        await EWE.subscriptions.sync(testDiffSubscriptionUrl);
        await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

        let request = (await getRequestLogs()).find(
          eachRequest => eachRequest.url.includes(testDiffUrlEndpoint));
        expect(request.query["downloadCount"]).toEqual(expectedDownloadCount);
      }
    });

    it("increments lastVersion", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      let testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      let firstDate = "Wed, 17 Jan 2024 10:30:27 GMT";
      let expectedFirstVersion = "202401171030";
      let secondDate = "Tue, 23 Jan 2024 10:40:27 GMT";
      let expectedSecondVersion = "202401231040";

      let checkLastVersionSentToEndpoint = async expectedLastVersion => {
        await clearRequestLogs();
        await EWE.subscriptions.sync(testDiffSubscriptionUrl);
        await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);
        let requests = await getRequestLogs(testDiffUrlEndpoint);
        expect(requests[0].query["lastVersion"]).toBe(expectedLastVersion);
      };

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE, "GET",
                                200, {date: firstDate});
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl);

      // Current version of the subscription should now be expectedFirstVersion,
      // from the first sync.
      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE, "GET",
                                200, {date: secondDate});
      await checkLastVersionSentToEndpoint(expectedFirstVersion);

      // When the last sync happened, it also updated the current version of the
      // subscription to expectedSecondVersion.
      await checkLastVersionSentToEndpoint(expectedSecondVersion);
    });

    it("notifies the error when the DNR limit is reached", async function() {
      if (!hasUpdateStaticRules()){
        this.skip();
      }
      try {
        let testDiffUrlEndpoint = "/updatable_subscription/diff.json";

        await EWE.testing.testSetDynamicRulesAvailable(1);
        await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
          filters: {
            add: ["filterThatFits", "filterThatDoesNotFitIntoTheLimit"],
            remove: []
          }
        }));

        clearTestEvents("subscriptions.onChanged");
        await EWE.subscriptions.add(UPDATABLE_SUBSCRIPTION_URL);

        // this is the same as waitForSubscriptionToBeSynchronized() but without
        // cleaning the test events
        await wait(async() => {
          let changeEvents = getTestEvents("subscriptions.onChanged");
          return changeEvents.filter(event => {
            return event[0].url === UPDATABLE_SUBSCRIPTION_URL &&
              event[1] === null; // whole subscription update, not property
          }).length > 0;
        }, 3000, "Subscription was not synchronized.");

        const lastEvent = getTestEvents("subscriptions.onChanged").slice(-1);
        expect(lastEvent).toEqual(
          [
            [
              expect.objectContaining({
                url: UPDATABLE_SUBSCRIPTION_URL,
                downloadStatus: "synchronize_diff_too_many_filters"
              }),
              "downloadStatus"
            ]
          ]
        );
      }
      finally {
        await EWE.testing.testSetDynamicRulesAvailable(0);
      }
    });

    it("notifies subscribed listeners", async function() {
      if (!hasUpdateStaticRules()) {
        this.skip();
      }

      setMinTimeout(this, 20000);

      const testDiffSubscriptionUrl = "http://localhost:3003/updatable_subscription.txt";
      const testDiffUrlEndpoint = "/updatable_subscription/diff.json";

      await setEndpointResponse(testDiffUrlEndpoint, EMPTY_DIFF_UPDATE);
      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await waitForSubscriptionToBeSynchronized(testDiffSubscriptionUrl, false);

      await wait(async() => {
        let hasDownloadingTrue = false;
        let hasDownloadingFalse = false;
        let hasLastDownload = false;
        let hasDownloadStatus = false;

        const events = getTestEvents("subscriptions.onChanged");
        for (const event of events) {
          const subscription = event[0];
          const changedProperty = event[1];

          if (subscription.url != testDiffSubscriptionUrl) {
            continue;
          }

          if (changedProperty === "downloading") {
            hasDownloadingTrue |= subscription.downloading === true;
            hasDownloadingFalse |= subscription.downloading === false;
          }
          else if (changedProperty === "lastDownload") {
            hasLastDownload = true;
          }
          else if (changedProperty === "downloadStatus") {
            hasDownloadStatus = true;
          }
        }

        return hasDownloadingTrue && hasDownloadingFalse &&
          hasLastDownload && hasDownloadStatus;
      }, 3000, "Not enough events");
    });
  });
});
