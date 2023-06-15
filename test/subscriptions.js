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

import {Page, setMinTimeout, wait, waitForAssertion, isEdge, isIncognito, isMV3,
        expectElemHideVisible, expectElemHideHidden, TEST_PAGES_URL,
        TEST_PAGES_DOMAIN, shouldBeLoaded, setEndpointResponse}
  from "./utils.js";
import {addFilter, EWE, runInBackgroundPage, getTestEvents, clearTestEvents,
        expectTestEvents} from "./messaging.js";
import {VALID_FILTER_TEXT, subCircumvention} from "./api-fixtures.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

const VALID_SUBSCRIPTION_URL = `${TEST_PAGES_URL}/subscription.txt`;
const VALID_SUBSCRIPTION_URL_2 = `${TEST_PAGES_URL}/subscription.txt?2`;
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_REQUEST_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
const VALID_CONTENT_FILTER_TEXT = `${TEST_PAGES_DOMAIN}###image`;

const DNR = browser.declarativeNetRequest;

describe("Subscriptions", function() {
  it("adds a subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getDownloadable();
    // homepage is `null` on MV2 until download
    let homepage = isMV3() ? "http://localhost:3000/subscription.txt" : null;
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true,
      title: isMV3() ? "Test MV3 Custom Subscription" : VALID_SUBSCRIPTION_URL,
      homepage,
      downloadable: expect.any(Boolean)
    })]);
  });

  it("adds a subscription with properties", async function() {
    let title = "testTitle";
    let homepage = "testHomePage";

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL, {title, homepage});
    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true,
      title,
      homepage,
      downloadable: expect.any(Boolean)
    })]);
  });

  it("adds downloadable subscriptions in MV2 and non-downloadable subscriptions in MV3", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    let downloadable = !isMV3();
    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      downloadable
    })]);
  });

  it("does not add an invalid subscription", async function() {
    await expect(EWE.subscriptions.add(INVALID_SUBSCRIPTION_URL))
      .rejects.toThrow("Error: Invalid subscription URL provided: invalidUrl");
  });

  it("adds multiple subscriptions", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL_2);

    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([
      expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
      expect.objectContaining({url: VALID_SUBSCRIPTION_URL_2})
    ]);
  });

  it("gets subscriptions for a filter", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await wait(async() => {
      let loaded = await EWE.subscriptions.getFilters(VALID_SUBSCRIPTION_URL);
      return loaded.length > 0;
    }, 4000);

    expect(await EWE.subscriptions.getForFilter("/image-from-subscription.png^$image")).toEqual([
      expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
    ]);
  });

  it("gets user subscriptions for a filter [fuzz]", async function() {
    await addFilter(VALID_FILTER_TEXT);
    expect(await EWE.subscriptions.getForFilter(VALID_FILTER_TEXT)).toEqual([
      expect.objectContaining({
        url: expect.stringContaining("~user~"),
        downloadable: false
      })
    ]);
  });

  it("gets filters from a subscription [fuzz]", async function() {
    expect(await EWE.subscriptions.getFilters(
      VALID_SUBSCRIPTION_URL)).toEqual([]);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

    let result;
    await wait(async() => {
      result = await EWE.subscriptions.getFilters(VALID_SUBSCRIPTION_URL);
      return result.length > 0;
    }, 4000);

    expect(result).toEqual(expect.arrayContaining([expect.objectContaining(
      {text: "/image-from-subscription.png^$image"}
    )]));
  });

  it("checks if a subscription has been added [fuzz]", async function() {
    expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(false);

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(true);
  });

  it("disables an existing subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: false
    })]);
  });

  it("enables an existing subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true
    })]);
  });

  it("enables a subscription that is already enabled.", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true
    })]);
  });

  it("fails enabling/disabling a nonexistent subscription", async function() {
    let errorMessage = "Error: Subscription does not exist: DoesNotExist";
    await expect(EWE.subscriptions.enable("DoesNotExist"))
      .rejects.toThrow(errorMessage);
    await expect(EWE.subscriptions.disable("DoesNotExist"))
      .rejects.toThrow(errorMessage);
  });

  it("removes a subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);

    expect(await EWE.subscriptions.getDownloadable()).toEqual([]);
  });

  it("fails removing a nonexistent subscription", async function() {
    let errorMessage = "Error: Subscription does not exist: DoesNotExist";
    await expect(EWE.subscriptions.remove("DoesNotExist"))
      .rejects.toThrow(errorMessage);
  });

  it("removes all subscriptions and filters", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL_2);
    await EWE.filters.add([
      VALID_REQUEST_FILTER_TEXT,
      VALID_CONTENT_FILTER_TEXT
    ]);

    await EWE.testing._removeAllSubscriptions();
    expect(await EWE.subscriptions.getDownloadable()).toEqual([]);
    expect(await EWE.filters.getUserFilters()).toEqual([]);

    if (DNR) {
      expect(await DNR.getEnabledRulesets()).toEqual([]);
      expect(await DNR.getDynamicRules()).toEqual([]);
    }
  });

  it("gets adblockpluscore recommendations [mv2-only] [mv2-custom-subs-skip]", async function() {
    // In MV3, subscriptions must always be provided, so the core
    // subscriptions are not used and this test doesn't apply.
    let result = await EWE.subscriptions.getRecommendations();
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        languages: ["en"],
        title: "EasyList",
        type: "ads",
        url: "https://easylist-downloads.adblockplus.org/easylist.txt"
      })
    ]));

    for (let item of result) {
      if (item.id) {
        continue;
      }
      expect(item).toEqual({
        languages: expect.any(Object),
        title: expect.any(String),
        type: expect.any(String),
        url: expect.any(String),
        mv2URL: expect.any(String)
      });

      for (let language of item.languages) {
        expect(language).toEqual(expect.any(String));
      }
    }
  });

  it("gets recommendations from overridden subscriptions file [mv2-custom-subs-only]", async function() {
    let result = await EWE.subscriptions.getRecommendations();
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        languages: ["en"],
        title: "TestSubscriptionEn",
        type: "ads",
        url: "https://easylist-downloads.adblockplus.org/easylist.txt"
      })
    ]));

    for (let item of result) {
      if (item.id) {
        continue;
      }
      expect(item).toEqual({
        languages: expect.any(Object),
        title: expect.any(String),
        type: expect.any(String),
        url: expect.any(String),
        mv2URL: expect.any(String)
      });

      for (let language of item.languages) {
        expect(language).toEqual(expect.any(String));
      }
    }
  });

  async function prepareSyncTest() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL_2);

    // This wait is to make sure we don't confuse our download
    // starting events linked to calling `sync` with the download
    // starting events from just adding the sub.
    await wait(async() => {
      let subs = await EWE.subscriptions.getDownloadable();
      return subs.every(sub => (!sub.downloadable || sub.lastDownload));
    }, 1000, "Subscriptions were not synced when added");

    clearTestEvents("subscriptions.onChanged");
  }

  // Disabled on MV3 as the subscriptions are not downloaded.
  it("syncs a specific subscription if specified [mv2-only]", async function() {
    setMinTimeout(this, 5000);
    await prepareSyncTest();
    await EWE.subscriptions.sync(VALID_SUBSCRIPTION_URL);

    await waitForAssertion(() => {
      let changeEvents = getTestEvents("subscriptions.onChanged");
      let downloadStartingEvents = changeEvents.filter(event => {
        return event[0].downloading == true && event[1] == "downloading";
      });
      expect(downloadStartingEvents).toEqual([[
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        "downloading"
      ]]);
    });
  });

  // Disabled on MV3 as the subscriptions are not downloaded.
  it("syncs all subscriptions if no subscription is specified [mv2-only]", async function() {
    await prepareSyncTest();
    await EWE.subscriptions.sync();

    await waitForAssertion(() => {
      let changeEvents = getTestEvents("subscriptions.onChanged");
      let downloadStartingEvents = changeEvents.filter(event => {
        return event[0].downloading == true && event[1] == "downloading";
      });
      expect(downloadStartingEvents).toEqual([[
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        "downloading"
      ], [
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL_2}),
        "downloading"
      ]]);
    });
  });

  it("returns the right URLs per manifest version", async function() {
    let expectedAaURL = isMV3() ?
      "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt" :
      "https://easylist-downloads.adblockplus.org/exceptionrules.txt";
    let actualAaURL = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "subscriptions"},
      {op: "getProp", arg: "ACCEPTABLE_ADS_URL"}
    ]);
    expect(actualAaURL).toEqual(expectedAaURL);
    let expectedAaPrivacyURL = isMV3() ?
      "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules-privacy-friendly.txt" :
      "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
    let actualAaPrivacyURL = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "subscriptions"},
      {op: "getProp", arg: "ACCEPTABLE_ADS_PRIVACY_URL"}
    ]);

    expect(actualAaPrivacyURL).toEqual(expectedAaPrivacyURL);
  });

  describe("Filter list updates", function() {
    setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 10000);

    beforeEach(async function() {
      await fetch("http://localhost:3003/clear");
      await setEndpointResponse("/anti-cv-subscription.txt", "[Adblock Plus]");
    });

    let addSubscription = async function(url = subCircumvention.url) {
      await EWE.subscriptions.add(url);
      await wait(
        async() => {
          // wait for subscription to be added
          await new Promise(resolve => setTimeout(resolve, 100));
          let subscriptions = await EWE.subscriptions.getDownloadable();
          if (subscriptions.length > 0) {
            expect(subscriptions).toEqual(expect.arrayContaining([
              expect.objectContaining({url})
            ]));
            return true;
          }
        }, 2000, "Subscription was not downloaded."
      );
    };

    let synchronizeAndCheck = async function(expectedFilter, timeout = 6000) {
      await wait(async() => {
        await EWE.subscriptions.sync();
        let subscriptionFilter =
          await EWE.subscriptions.getForFilter(expectedFilter);
        if (subscriptionFilter.length > 0) {
          return true;
        }
      }, timeout, "Subscription was not synchronised properly.");
    };

    it("updates the CV subscription [fuzz]", async function() {
      let updatedReply = "[Adblock Plus]";
      let filterToAdd = "example.com#$#abort-on-property-read atob";
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await addSubscription();

      // update reply on the server
      updatedReply = ["[Adblock Plus]", filterToAdd].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      let timeoutForCheck = isFuzzingServiceWorker ? 10000 : 6000;
      await synchronizeAndCheck(filterToAdd, timeoutForCheck);

      expect(await EWE.subscriptions.getForFilter(filterToAdd)).toEqual(
        expect.arrayContaining([expect.objectContaining(
          {url: subCircumvention.url}
        )])
      );
    });

    it("adds & removes content filter by updating CV subscription", async function() {
      let updatedReply = [
        "[Adblock Plus]",
        "example.com##element_hiding_filter_2"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await addSubscription();
      await expectElemHideVisible();

      // update reply on the server to add content filter
      updatedReply = ["[Adblock Plus]", "###elem-hide"].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await synchronizeAndCheck("###elem-hide");
      await expectElemHideHidden();

      // update reply on the server to remove content filter
      updatedReply = ["[Adblock Plus]", "###elem-hide_3"].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await synchronizeAndCheck("###elem-hide_3");
      await expectElemHideVisible();
    });

    it("doesn't bring non-CV subscription data to DNR world [mv3-only]", async function() {
      let updatedReply = "[Adblock Plus]";
      await setEndpointResponse("/subscription-that-shouldnt-be-moved-to-dnr-world.txt", updatedReply);

      await addSubscription();
      let dynamicRules = await DNR.getDynamicRules().length;

      await addSubscription("http://localhost:3003/subscription-that-shouldnt-be-moved-to-dnr-world.txt");
      expect(await DNR.getDynamicRules().length)
        .toEqual(dynamicRules);
      await shouldBeLoaded(
        "image-from-non-dnr-subscription.html",
        "image-from-non-dnr-subscription.png",
        "Image from non dnr subscription was blocked before rule was added"
      );

      // update reply on the server
      updatedReply = [
        "[Adblock Plus]",
        "example.com##element_hiding_filter",
        "/image-from-non-dnr-subscription.png^$image"
      ].join("\n");
      await setEndpointResponse("/subscription-that-shouldnt-be-moved-to-dnr-world.txt", updatedReply);
      await EWE.subscriptions.sync();

      expect(await DNR.getDynamicRules().length).toEqual(dynamicRules);
      // check that the circumvention subscription was updated and the non-DNR
      // related subscription wasn't
      await shouldBeLoaded("image-from-cv-subscription.html",
                           "image-from-cv-subscription.png");
      await shouldBeLoaded("image-from-non-dnr-subscription.html",
                           "image-from-non-dnr-subscription.png",
                           "Image from non dnr subscription was blocked");
    });

    it("doesn't remove enabled custom filters which conflict with subscription filters", async function() {
      let updatedReply = [
        "[Adblock Plus]",
        "/image-from-custom-filter.png^$image"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await addSubscription();
      await EWE.filters.add(["/image-from-custom-filter.png^$image"]);
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
      await new Page("image-from-custom-filter.html").expectResource("image-from-custom-filter.png").toBeBlocked();

      // update reply on the server to remove filter
      updatedReply =
        ["[Adblock Plus]", "example.com##.inserted_rtb"].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);

      await synchronizeAndCheck("example.com##.inserted_rtb");

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
      await new Page("image-from-custom-filter.html").expectResource("image-from-custom-filter.png").toBeBlocked();
    });

    it("doesn't remove disabled custom filters which conflict with subscription filters but they remain disabled", async function() {
      // usually this test takes ~3 000ms but sometimes it reaches 50 000ms
      // to retrieve correct state of dynamic rules from browser
      setMinTimeout(this, 50000);
      let updatedReply = [
        "[Adblock Plus]",
        "/image-from-custom-filter.png^$image"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);

      await EWE.filters.add(["/image-from-custom-filter.png^$image"]);
      await addSubscription();
      let userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toMatchObject({
        csp: null,
        enabled: true,
        selector: null,
        slow: false,
        text: "/image-from-custom-filter.png^$image",
        thirdParty: null,
        type: "blocking"
      });
      await new Page("image-from-custom-filter.html").expectResource("image-from-custom-filter.png").toBeBlocked();

      await EWE.filters.disable(["/image-from-custom-filter.png^$image"]);
      userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toMatchObject({
        csp: null,
        enabled: false,
        selector: null,
        slow: false,
        text: "/image-from-custom-filter.png^$image",
        thirdParty: null,
        type: "blocking"
      });
      if (isMV3()) {
        // We need to wait for dynamic rules to have changes in filters applied
        await wait(async() => {
          let dynamicRules = await DNR.getDynamicRules();
          let dynamicRulesLength = dynamicRules.length;
          return dynamicRulesLength == 0;
        }, 15000, "DNRs weren't updated.");
      }

      await shouldBeLoaded("image-from-custom-filter.html", "image-from-custom-filter.png");
      // update reply on the server to remove filter
      updatedReply = "[Adblock Plus]";

      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await EWE.subscriptions.sync();
      // wait for subscriptions to be synced
      await new Promise(r => setTimeout(r, 1000));

      userFilters = await EWE.filters.getUserFilters();
      expect(userFilters[0]).toMatchObject({
        csp: null,
        enabled: false,
        selector: null,
        slow: false,
        text: "/image-from-custom-filter.png^$image",
        thirdParty: null,
        type: "blocking"
      });
      if (isMV3()) {
        let dynamicRules = await DNR.getDynamicRules();
        expect(dynamicRules.length).toBe(0);
      }
      await shouldBeLoaded("image-from-custom-filter.html", "image-from-custom-filter.png");
    });

    it("stops blocking resources after removing a URL filter", async function() {
      let updatedReply = [
        "[Adblock Plus]",
        "/image-from-cv-subscription.png^$image"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await addSubscription();
      await new Page("image-from-cv-subscription.html").expectResource("image-from-cv-subscription.png").toBeBlocked();

      // update reply on the server to remove filter
      updatedReply = "[Adblock Plus]";
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
      await EWE.subscriptions.sync();
      await shouldBeLoaded("image-from-cv-subscription.html", "image-from-cv-subscription.png");
    });

    it("blocks content after the filter list update", async function() {
      if (isEdge() && isIncognito() && !isMV3()) {
        setMinTimeout(this, 15000);
      }
      let updatedReply = [
        "[Adblock Plus]",
        "/image-for-filter-that-should-be-untouched.png^$image"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);

      if (DNR) {
        let dynamicRules = await DNR.getDynamicRules();
        expect(dynamicRules.length).toEqual(0);
        let enabledRulesets = await DNR.getEnabledRulesets();
        expect(enabledRulesets.length).toBe(0);
      }
      // make sure we have no subscription.
      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables.length).toBe(0);

      await shouldBeLoaded("image-from-cv-subscription.html", "image-from-cv-subscription.png");
      await addSubscription();

      // make sure we only have one subscription.
      downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables.length).toBe(1);

      if (DNR) {
        let enabledRulesets = await DNR.getEnabledRulesets();
        // we shouldn't have a ruleset enabled for this list.
        expect(enabledRulesets.length).toBe(0);
      }
      await shouldBeLoaded("image-from-cv-subscription.html", "image-from-cv-subscription.png");
      await new Page("image-from-cv-subscription.html").expectResource("image-for-filter-that-should-be-untouched.png").toBeBlocked();

      // update reply on the server
      let updatedReplyForRemoval = [
        "[Adblock Plus]",
        "/image-from-cv-subscription.png^$image"
      ].join("\n");
      await setEndpointResponse("/anti-cv-subscription.txt", updatedReplyForRemoval);
      await synchronizeAndCheck("/image-from-cv-subscription.png^$image");

      await new Page("image-from-cv-subscription.html").expectResource("image-from-cv-subscription.png").toBeBlocked();
      await shouldBeLoaded("image-from-cv-subscription.html", "image-for-filter-that-should-be-untouched.png");
    });
  });

  describe("Subscription events [fuzz]", function() {
    it("listens to onAdded events", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await expectTestEvents("subscriptions.onAdded", [[
        expect.objectContaining({
          url: VALID_SUBSCRIPTION_URL,
          enabled: true,
          title: isMV3() ? "Test MV3 Custom Subscription" : VALID_SUBSCRIPTION_URL
        })
      ]]);
    });

    it("listens to onChanged events", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      await expectTestEvents(
        "subscriptions.onChanged",
        expect.arrayContaining([[
          expect.objectContaining({
            url: VALID_SUBSCRIPTION_URL,
            enabled: false
          }),
          "enabled"
        ]])
      );
    });

    it("listens to onRemoved events", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);
      await expectTestEvents("subscriptions.onRemoved", [[
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      ]]);
    });
  });
});
