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
import {EWE, expectTestEvents} from "./messaging.js";
import {hasUpdateStaticRules, Page, setEndpointResponse, shouldBeLoaded,
        setMinTimeout, wait, expectElemHideVisible, expectElemHideHidden,
        syncSubHasLastFilter, syncSubHasNoLastFilter}
  from "./utils.js";
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
    await fetch("http://localhost:3003/clear");
    await setEndpointResponse("/updatable_subscription/diff.json", JSON.stringify({
      filters: {
        add: [],
        remove: []
      }
    }));
    // Ensure it is enabled.
    await EWE.subscriptions.add(UPDATABLE_SUBSCRIPTION_URL);
  });

  // The purpose of this test is to make sure we change nothing
  // if the static rules update API isn't available.
  it("Doesn't update without the static rules updates [fuzz] [mv3-only]", async function() {
    // If we are on Chrome 111+ we don't run this test.
    if (hasUpdateStaticRules()) {
      this.skip();
    }

    // The case of the first update.
    await EWE.testing._dnrSubscriptionUpdate(
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
    await EWE.testing._dnrSubscriptionUpdate(
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
    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES2);
    await checkRulesAreDisabled(UPDATABLE_SUBSCRIPTION_ID, ids);
    // Check that we have 5 dynamic rules.
    added = await browser.declarativeNetRequest.getDynamicRules();
    expect(added.length).toEqual(5);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES2);

    // The case of the update reenabling a previously disabled static
    // rule STATIC_FILTER_TO_DISABLE
    ids = mapper.get(STATIC_FILTER_TO_DISABLE);
    await EWE.testing._dnrSubscriptionUpdate(
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
    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);
    let dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter2.subscriptionIds.indexOf(UPDATABLE_SUBSCRIPTION_ID))
      .not.toEqual(-1);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES4);

    // Revert the update so that DYNAMIC_FILTER2 is no longer part of
    // this but is still present.
    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES3);
    await checkDynamicRuleCount(6);
    dynFilter2 = await getDynamicFilter(DYNAMIC_FILTER2);
    expect(dynFilter).toEqual(dynFilter2);
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES3);

    // This update will try to enable a static rules that is enabled.
    // It should not change the dynamic rules.

    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES5);
    await checkDynamicRuleCount(6);

    let dynFilter3 = await getDynamicFilter(STATIC_FILTER_TO_DISABLE);
    expect(dynFilter3).toBeUndefined();
    await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES5);

    // Empty update: no disabled rules, no dynamic rules.
    await EWE.testing._dnrSubscriptionUpdate(
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

    await EWE.testing._dnrSubscriptionUpdate(
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

    await EWE.testing._dnrSubscriptionUpdate(
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

    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(0);
  });

  it("does not add dynamic rules when not enabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.subscriptions.disable(UPDATABLE_SUBSCRIPTION_URL);
    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(0);
  });

  it("remove dynamic rules when removed", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we remove the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.remove(UPDATABLE_SUBSCRIPTION_URL);
    await checkDynamicRuleCount(0);
  });

  it("remove dynamic rules when disabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrSubscriptionUpdate(
      UPDATABLE_SUBSCRIPTION_URL, UPDATES4);
    await checkDynamicRuleCount(6);

    // If we disable the subscription all the dynamic rules should be
    // removed.
    await EWE.subscriptions.disable(UPDATABLE_SUBSCRIPTION_URL);
    await checkDynamicRuleCount(0);
  });

  it("restore dynamic rules when reenabled", async function() {
    if (!hasUpdateStaticRules()) {
      this.skip();
    }

    await EWE.testing._dnrSubscriptionUpdate(
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

      await EWE.testing._dnrSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES);
      await checkDynamicRuleCount(5);
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, UPDATES);

      // UPDATES2 will add DYNAMIC_FILTER, but it's already there.
      await EWE.testing._dnrSubscriptionUpdate(
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

      // This update should fail
      await expect(EWE.testing._dnrSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES2A
      )).rejects.toThrow(
        "FilterError: {\"type\":\"too_many_filters\",\"option\":null}"
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

      await EWE.testing._dnrSubscriptionUpdate(
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
      // This update should fail
      await expect(EWE.testing._dnrSubscriptionUpdate(
        UPDATABLE_SUBSCRIPTION_URL, UPDATES
      )).rejects.toThrow(
        "FilterError: {\"type\":\"too_many_filters\",\"option\":null}"
      );

      await checkDynamicRuleCount(0);
      await checkUpdateStateSaved(UPDATABLE_SUBSCRIPTION_ID, EMPTY_UPDATE);
    });
  });

  describe("Updates using the diffing mechanism", function() {
    setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 10000);

    beforeEach(async function() {
      await EWE.subscriptions.remove(UPDATABLE_SUBSCRIPTION_URL);
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
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);

      let subs = await EWE.subscriptions.getDownloadable();

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
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);

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

      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);

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
      await setEndpointResponse(testDiffUrlEndpoint, JSON.stringify({
        filters: {
          add: [],
          remove: []
        }
      }));

      await shouldBeLoaded(
        "image-from-subscription.html",
        "image-from-subscription.png",
        "Image from subscription did not load correctly even before of adding the subscription");

      await EWE.subscriptions.add(testDiffSubscriptionUrl);
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      await new Page("image-from-subscription.html").expectResource("image-from-subscription.png").toBeBlocked();
    });

    it("doesnt apply filters removed by the diffs [mv3-only]", async function() {
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
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
      await new Page("image-from-subscription.html").expectResource("image-from-subscription.png").toBeBlocked();

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
      await EWE.subscriptions.sync(testDiffSubscriptionUrl);
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
  });
});
