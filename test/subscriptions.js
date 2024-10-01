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

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN, TEST_ADMIN_PAGES_URL}
  from "./test-server-urls.js";
import {clearRequestLogs, isMV3, Page, setEndpointResponse, shouldBeLoaded,
        setMinTimeout, waitForAssertion, waitForSubscriptionToBeSynchronized,
        clearEndpointResponse} from "./utils.js";
import {wait} from "./polling.js";
import {addFilter, EWE, runInBackgroundPage, getTestEvents, clearTestEvents,
        expectTestEvents} from "./messaging.js";
import {VALID_FILTER_TEXT, subAntiCVLocal, subTestUpdatable2,
        subEasylistLive, subTestCustom1, subTestCustom2, subAcceptableAdsLive,
        subTestUpdatable1, subAntiCVLive, subTestNoDNR, subTestAllowingFilter}
  from "./api-fixtures.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

const VALID_SUBSCRIPTION_URL = subTestCustom1.url;
const VALID_SUBSCRIPTION_URL_2 = subTestCustom2.url;

// this subscription doesn't appear in background.js and isn't bundled
const USER_SUBSCRIPTION_URL = `${TEST_ADMIN_PAGES_URL}/user-subscription.txt`;

const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_REQUEST_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
const VALID_CONTENT_FILTER_TEXT = `${TEST_PAGES_DOMAIN}###image`;

const DNR = browser.declarativeNetRequest;

describe("Subscriptions", function() {
  it("adds a subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getSubscriptions();
    // homepage is `null` on MV2 until download
    let homepage = isMV3() ? VALID_SUBSCRIPTION_URL : null;
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true,
      title: isMV3() ? subTestCustom1.title : VALID_SUBSCRIPTION_URL,
      homepage,
      updatable: expect.any(Boolean)
    })]);
  });

  it("adds a subscription with properties", async function() {
    let title = "testTitle";
    let homepage = "testHomePage";

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL, {title, homepage});

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true,
      title,
      homepage,
      updatable: expect.any(Boolean)
    })]);
  });

  it("adds a user subscription", async function() {
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({
      url: USER_SUBSCRIPTION_URL,
      enabled: true,
      title: USER_SUBSCRIPTION_URL,
      homepage: null,
      updatable: true
    })]);
  });

  it("adds a privilegd subscription by default", async function() {
    let url = isMV3() ? subAntiCVLocal.url : subAntiCVLive.mv2_url;
    await EWE.subscriptions.add(url);

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({url, privileged: true})]);
  });

  it("overrides a privileged subscription to non-privileged", async function() {
    let url = isMV3() ? subAntiCVLocal.url : subAntiCVLive.mv2_url;
    await EWE.subscriptions.add(url, {privileged: false});

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({url, privileged: false})]);
  });

  it("adds a privileged subscription from the recommendations", async function() {
    setMinTimeout(this, 10000);

    let defaultRecommendations = await EWE.testing._recommendations();
    await EWE.testing._setRecommendations([{_source: subTestUpdatable1}]);
    await EWE.testing._cleanSubscriptionClassesCache();

    let subUrl = isMV3() ? subTestUpdatable1.url : subTestUpdatable1.mv2_url;
    try {
      await EWE.subscriptions.add(subUrl);
      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual([expect.objectContaining({
        url: subUrl,
        privileged: true
      })]);
    }
    finally {
      await EWE.testing._setRecommendations(defaultRecommendations);
      await EWE.testing._cleanSubscriptionClassesCache();
    }
  });

  it("adds the anti-cv subscription using addDefaults", async function() {
    setMinTimeout(this, 15000);

    await EWE.subscriptions.addDefaults("en");

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs.length).toBeGreaterThanOrEqual(3);

    let url = isMV3() ? subAntiCVLocal.url : subAntiCVLive.mv2_url;
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({url, privileged: true}),
      expect.objectContaining({privileged: false})
    ]));
  });

  it("does not add defaults if subscriptions are already added", async function() {
    setMinTimeout(this, 15000);

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.addDefaults();

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([
      expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
    ]);
  });

  it("adds defaults if the force flag is passed to addDefaults", async function() {
    setMinTimeout(this, 15000);

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.addDefaults(null, true);

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs.length).toBeGreaterThanOrEqual(4);

    let url = isMV3() ? subAntiCVLocal.url : subAntiCVLive.mv2_url;
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
      expect.objectContaining({url, privileged: true}),
      expect.objectContaining({privileged: false})
    ]));
  });

  it("adds default live subscriptions", async function() {
    setMinTimeout(this, 15000);

    for (let sub of [subEasylistLive, subAntiCVLive, subAcceptableAdsLive]) {
      await EWE.subscriptions.add(isMV3() ? sub.url : sub.mv2_url);
    }

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs.length).toEqual(3);

    // If the test fails with "downloadStatus": "synchronize_connection_error",
    // the diff_url property from live subscriptions in
    // test/scripts/custom-subscriptions.json probably needs to be updated
    if (isMV3()) {
      for (let sub of subs) {
        expect(sub).toEqual(expect.objectContaining({
          downloadStatus: "synchronize_ok",
          diffURL: expect.stringMatching(/.*diff.*/)
        }));
      }
    }
  });

  it("adds downloadable subscriptions in MV2 and non-downloadable subscriptions in MV3", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    let updatable = !isMV3();
    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      updatable
    })]);
  });

  it("does not add an invalid subscription", async function() {
    await expect(EWE.subscriptions.add(INVALID_SUBSCRIPTION_URL))
      .rejects.toThrow("Error: Invalid subscription URL provided: invalidUrl");
  });

  it("adds user subscription when endpoint responds with 404", async function() {
    // this endpoint is responding with 404
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);

    await waitForAssertion(async() => {
      expect(await EWE.subscriptions.getSubscriptions()).toEqual([
        expect.objectContaining({downloadStatus: "synchronize_connection_error"})]);
    });
  });

  it("adds user subscription and synchronizes successfully even if there are some invalid filters", async function() {
    let invalidUnicodeElemhide = "invalid-unicode-🔥.com###example";
    let invalidUnicodeRequest = "foo$domain=invalid-unicode-🔥.com";
    // This is an invalid regex in MV3 only. The regex comes from a real filter
    // list.
    let invalidRegex = "/^https?://.*/[a-z0-9A-Z_]{2,15}.(php|jx|jsx|1ph|jsf|jz|jsm|j$)/";
    let invalidWildcardDomain = "foo$domain=example.*.*";
    let valid = "image.png";

    let filterTexts = [
      invalidUnicodeElemhide,
      invalidUnicodeRequest,
      invalidRegex,
      invalidWildcardDomain,
      valid
    ];

    await setEndpointResponse(
      USER_SUBSCRIPTION_URL,
      "[Adblock Plus 2.0]\n" + filterTexts.join("\n")
    );

    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);

    let filters = await EWE.subscriptions.getFilters(USER_SUBSCRIPTION_URL);
    expect(filters).toEqual(
      filterTexts.map(text => expect.objectContaining({text}))
    );

    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("adds multiple subscriptions", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL_2);

    let subs = await EWE.subscriptions.getSubscriptions();
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

  it("gets filters from a user subscription [fuzz]", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL,
                              "[Adblock Plus 2.0]\n\n image.png");
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
    await waitForSubscriptionToBeSynchronized(USER_SUBSCRIPTION_URL);
    expect(await EWE.subscriptions.getForFilter("image.png")).toEqual([
      expect.objectContaining({url: USER_SUBSCRIPTION_URL})
    ]);
  });

  it("checks if a subscription has been added [fuzz]", async function() {
    expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(false);

    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(true);
  });

  it("disables an existing subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: false
    })]);
  });

  it("enables an existing subscription [fuzz]", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual([expect.objectContaining({
      url: VALID_SUBSCRIPTION_URL,
      enabled: true
    })]);
  });

  it("enables a subscription that is already enabled.", async function() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

    let subs = await EWE.subscriptions.getSubscriptions();
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

    expect(await EWE.subscriptions.getSubscriptions()).toEqual([]);
  });

  it("removes an user subscription [fuzz]", async function() {
    await setEndpointResponse(USER_SUBSCRIPTION_URL,
                              "[Adblock Plus 2.0]\n\n image.png");
    await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);

    expect(await EWE.subscriptions.getSubscriptions()).toEqual([
      expect.objectContaining({url: USER_SUBSCRIPTION_URL})
    ]);

    await EWE.subscriptions.remove(USER_SUBSCRIPTION_URL);

    expect(await EWE.subscriptions.getSubscriptions()).toEqual([]);
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
    expect(await EWE.subscriptions.getSubscriptions()).toEqual([]);
    expect(await EWE.filters.getUserFilters()).toEqual([]);

    if (DNR) {
      expect(await DNR.getEnabledRulesets()).toEqual([]);
      expect(await DNR.getDynamicRules()).toEqual([]);
    }
  });

  it("gets core and custom recommendations [mv2-only]", async function() {
    const expectedRecommendations = [
      // core recommendations should at least contain the default subscriptions
      subEasylistLive, subAcceptableAdsLive, subAntiCVLive,
      // custom recommendation
      subTestAllowingFilter
    ];

    let result = await EWE.subscriptions.getRecommendations();

    for (const subscription of expectedRecommendations) {
      let {languages, title, type, mv2_url: url} = subscription;
      if (!languages) {
        languages = [];
      }
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({languages, title, type, url})
      ]));
    }
  });

  async function prepareSyncTest() {
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
    await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL_2);

    // This wait is to make sure we don't confuse our download
    // starting events linked to calling `sync` with the download
    // starting events from just adding the sub.
    await wait(async() => {
      let subs = await EWE.subscriptions.getSubscriptions();
      return subs.every(sub => sub.lastDownload);
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
      subAcceptableAdsLive.url : subAcceptableAdsLive.mv2_url;
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

  it("still supports `getDownloadable()` in the API", async function() {
    let downloadables = await EWE.subscriptions.getDownloadable();
    let subscriptions = await EWE.subscriptions.getSubscriptions();
    expect(downloadables.size).toEqual(subscriptions.size);
    for (let i = 0; i < downloadables.size; i++) {
      expect(downloadables[i]).toEqual(expect.objectContaining({
        downloadable: expect.any(Boolean)
      }));
      expect(downloadables[i].updatable).toBeUndefined(); // not yet exposed

      expect(subscriptions[i]).toEqual(expect.objectContaining({
        updatable: expect.any(Boolean)
      }));
      expect(subscriptions[i].downloadable).toBeUndefined(); // deprecated

      delete downloadables[i].downloadable;
      delete subscriptions[i].updatable;
      expect(subscriptions[i]).toEqual(downloadables[i]);
    }
  });

  it("exposes `updatable` property in the `getSubscriptions()` response", async function() {
    setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 10000);

    if (isMV3()) {
      const countableSubUrl = subTestAllowingFilter.url;
      const diffUpdatableSubUrl = subTestUpdatable1.url;

      await EWE.subscriptions.add(countableSubUrl);
      await EWE.subscriptions.add(diffUpdatableSubUrl);

      const subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: countableSubUrl,
          updatable: false
        }),
        expect.objectContaining({
          url: diffUpdatableSubUrl,
          updatable: true
        })
      ]));
    }
    else {
      const fullUpdatableUrl = subTestUpdatable1.mv2_url;
      await EWE.subscriptions.add(fullUpdatableUrl);

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: fullUpdatableUrl,
          updatable: true
        })
      ]));
    }
  });

  describe("Filter list updates", function() {
    setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 10000);

    beforeEach(async function() {
      await clearRequestLogs();
      await setEndpointResponse("/subscription2.txt", "[Adblock Plus]");
    });

    let addSubscription = async function(url = subTestUpdatable2.url) {
      await EWE.subscriptions.add(url);
      await wait(
        async() => {
          // wait for subscription to be added
          await new Promise(resolve => setTimeout(resolve, 100));
          let subscriptions = await EWE.subscriptions.getSubscriptions();
          if (subscriptions.length > 0) {
            expect(subscriptions).toEqual(expect.arrayContaining([
              expect.objectContaining({url})
            ]));
            return true;
          }
        }, 2000, "Subscription was not downloaded."
      );
    };

    it("doesn't bring non-CV subscription data to DNR world [mv3-only]", async function() {
      let updatedReply = "[Adblock Plus]";
      await setEndpointResponse(subTestNoDNR.url, updatedReply);

      await addSubscription();
      let dynamicRules = await DNR.getDynamicRules().length;

      await addSubscription(subTestNoDNR.url);
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
      await setEndpointResponse(subTestNoDNR.url, updatedReply);
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

    it("doesn't remove disabled custom filters which conflict with subscription filters but they remain disabled", async function() {
      // usually this test takes ~3 000ms but sometimes it reaches 50 000ms
      // to retrieve correct state of dynamic rules from browser
      setMinTimeout(this, 50000);
      let updatedReply = [
        "[Adblock Plus]",
        "/image-from-custom-filter.png^$image"
      ].join("\n");
      await setEndpointResponse("/subscription2.txt", updatedReply);

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

      await setEndpointResponse("/subscription2.txt", updatedReply);
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
  });

  describe("getMigrationErrors", function() {
    afterEach(async function() {
      await EWE.subscriptions.clearMigrationErrors();
    });

    it("getMigrationErrors returns an empty array when there are no errors [fuzz]", async function() {
      let migrationErrors = await EWE.subscriptions.getMigrationErrors();
      expect(migrationErrors).toEqual([]);
    });

    it("returns an empty array when there is invalid data in prefs", async function() {
      await EWE.testing._setPrefs("migration_subscription_errors", {});
      let migrationErrors = await EWE.subscriptions.getMigrationErrors();
      expect(migrationErrors).toEqual([]);
    });

    it("clears migration errors when clearMigrationErrors is called", async function() {
      let subscription = {
        url: INVALID_SUBSCRIPTION_URL
      };
      let error = "Invalid URL";

      await EWE.testing._saveSubscriptionMigrationError(subscription, error);

      let errorsBeforeClear = await EWE.subscriptions.getMigrationErrors();
      expect(errorsBeforeClear).toEqual([
        expect.objectContaining({
          error,
          subscription
        })
      ]);

      await EWE.subscriptions.clearMigrationErrors();

      let errorsAfterClear = await EWE.subscriptions.getMigrationErrors();
      expect(errorsAfterClear).toEqual([]);
    });
  });

  describe("Subscription events [fuzz]", function() {
    const USER_SUBSCRIPTION_BODY = "[Adblock Plus 2.0]\nimage.png";

    afterEach(async function() {
      await clearEndpointResponse(USER_SUBSCRIPTION_URL);
    });

    it("listens to onAdded events", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await expectTestEvents("subscriptions.onAdded", [[
        expect.objectContaining({
          url: VALID_SUBSCRIPTION_URL,
          enabled: true,
          title: isMV3() ? subTestCustom1.title : VALID_SUBSCRIPTION_URL
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

    it("listens to onAdded events for custom user subscriptions", async function() {
      await setEndpointResponse(USER_SUBSCRIPTION_URL, USER_SUBSCRIPTION_BODY);
      await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
      await expectTestEvents("subscriptions.onAdded", [[
        expect.objectContaining({
          url: USER_SUBSCRIPTION_URL,
          enabled: true,
          title: USER_SUBSCRIPTION_URL
        })
      ]]);
    });

    it("listens to onChanged events for custom user subscriptions", async function() {
      await setEndpointResponse(USER_SUBSCRIPTION_URL, USER_SUBSCRIPTION_BODY);
      await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
      await EWE.subscriptions.disable(USER_SUBSCRIPTION_URL);
      await expectTestEvents(
        "subscriptions.onChanged",
        expect.arrayContaining([[
          expect.objectContaining({
            url: USER_SUBSCRIPTION_URL,
            enabled: false
          }),
          "enabled"
        ]])
      );
    });

    it("listens to onRemoved events for custom user subscriptions", async function() {
      await setEndpointResponse(USER_SUBSCRIPTION_URL, USER_SUBSCRIPTION_BODY);
      await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);
      await EWE.subscriptions.remove(USER_SUBSCRIPTION_URL);
      await expectTestEvents("subscriptions.onRemoved", [[
        expect.objectContaining({url: USER_SUBSCRIPTION_URL})
      ]]);
    });

    it("stops emitting events for removed subscriptions", async function() {
      await setEndpointResponse(USER_SUBSCRIPTION_URL, USER_SUBSCRIPTION_BODY);
      await EWE.subscriptions.add(USER_SUBSCRIPTION_URL);

      // wait for downloading started
      await waitForAssertion(() => {
        let changeEvents = getTestEvents("subscriptions.onChanged");
        let downloadStartingEvents = changeEvents.filter(event => {
          return event[0].downloading == true && event[1] == "downloading";
        });
        expect(downloadStartingEvents).toEqual([[
          expect.objectContaining({url: USER_SUBSCRIPTION_URL}),
          "downloading"
        ]]);
      }, 3000, 5);

      // remove the subscription, the synchronization continues meanwhile
      await EWE.subscriptions.remove(USER_SUBSCRIPTION_URL);
      clearTestEvents("subscriptions.onChanged");

      // await for the sync to be finished
      await new Promise(r => setTimeout(r, 3000));

      await expectTestEvents("subscriptions.onChanged", []);
    });
  });
});
