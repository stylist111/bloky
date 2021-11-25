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

import {Page, Popup, setMinTimeout, waitForInvisibleElement, wait,
        executeScript, TEST_PAGES_URL, TEST_PAGES_DOMAIN} from "./utils.js";
import {addFilter, callMethod, runInBackgroundPage, addFakeListener,
        removeFakeListeners, setTestSnippets} from "./messaging.js";

const VALID_SUBSCRIPTION_URL = `${TEST_PAGES_URL}/subscription.txt`;
const ANOTHER_VALID_SUBSCRIPTION_URL =
  `${TEST_PAGES_URL}/subscription-empty.txt`;
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: false,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};
const INVALID_FILTER_TEXT = "/foo/$rewrite=";

describe("API", () =>
{
  afterEach(() =>
  {
    Page.removeCurrent();
    Popup.removeCurrent();
  });

  describe("Subscriptions", () =>
  {
    it("adds a subscription", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL,
        homepage: null,
        downloadable: true
      })]);
    });

    it("adds a subscription with properties", async() =>
    {
      let title = "testTitle";
      let homepage = "testHomePage";

      await callMethod(["subscriptions"], "add",
                       [VALID_SUBSCRIPTION_URL, {title, homepage}]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title,
        homepage,
        downloadable: true
      })]);
    });

    it("does not add an invalid subscription", () =>
      expect(callMethod(["subscriptions"], "add", [INVALID_SUBSCRIPTION_URL]))
        .rejects.toThrow("Error: Invalid subscription URL provided: invalidUrl")
    );

    it("adds multiple subscriptions", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "add",
                       [VALID_SUBSCRIPTION_URL + "?2"]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("gets subscriptions for a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      expect(await callMethod(["subscriptions"], "getForFilter",
                              [VALID_FILTER_TEXT])).toEqual([
        expect.objectContaining({downloadable: false})
      ]);
    });

    it("gets filters from a subscription", async() =>
    {
      expect(await callMethod(["subscriptions"], "getFilters",
                              [VALID_SUBSCRIPTION_URL])).toEqual([]);

      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);

      let result;
      await wait(async() =>
      {
        result = await callMethod(["subscriptions"], "getFilters",
                                  [VALID_SUBSCRIPTION_URL]);
        return result.length > 0;
      }, 4000);

      expect(result).toEqual(expect.arrayContaining([expect.objectContaining(
        {text: "/image.png^$image"}
      )]));
    });

    it("checks if a subscription has been added", async() =>
    {
      expect(await callMethod(["subscriptions"], "has",
                              [VALID_SUBSCRIPTION_URL])).toBe(false);

      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      expect(await callMethod(["subscriptions"], "has",
                              [VALID_SUBSCRIPTION_URL])).toBe(true);
    });

    it("disables an existing subscription", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "disable", [VALID_SUBSCRIPTION_URL]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "disable", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "enable", [VALID_SUBSCRIPTION_URL]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("enables a subscription that is already enabled.", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "enable", [VALID_SUBSCRIPTION_URL]);

      let subs = await callMethod(["subscriptions"], "getDownloadable");
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("fails enabling/disabling a nonexistent subscription", async() =>
    {
      let errorMessage = "Error: Subscription does not exist: DoesNotExist";
      await expect(callMethod(["subscriptions"], "enable", ["DoesNotExist"]))
        .rejects.toThrow(errorMessage);
      await expect(callMethod(["subscriptions"], "disable", ["DoesNotExist"]))
        .rejects.toThrow(errorMessage);
    });

    it("removes a subscription", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "remove", [VALID_SUBSCRIPTION_URL]);

      expect(await callMethod(["subscriptions"], "getDownloadable"))
        .toEqual([]);
    });

    it("gets recommendations", async() =>
    {
      let result = await callMethod(["subscriptions"], "getRecommendations");

      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          languages: ["en"],
          title: "EasyList",
          type: "ads",
          url: "https://easylist-downloads.adblockplus.org/easylist.txt"
        })
      ]));

      for (let item of result)
      {
        expect(item).toEqual({
          languages: expect.any(Object),
          title: expect.any(String),
          type: expect.any(String),
          url: expect.any(String)
        });

        for (let language of item.languages)
          expect(language).toEqual(expect.any(String));
      }
    });

    it("listens to onAdded events", async() =>
    {
      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onAdded"});
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL
      }));
    });

    it("listens to onChanged events", async() =>
    {
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);

      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onChanged"});
      await callMethod(["subscriptions"], "disable", [VALID_SUBSCRIPTION_URL]);

      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
      expect(fake.lastArg).toEqual("enabled");
    });

    it("listens to onRemoved events", async() =>
    {
      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onRemoved"});
      await callMethod(["subscriptions"], "add", [VALID_SUBSCRIPTION_URL]);
      await callMethod(["subscriptions"], "remove", [VALID_SUBSCRIPTION_URL]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      );
    });

    it("syncs subscriptions", async function()
    {
      setMinTimeout(this, 3000);

      await new Promise((resolve, reject) =>
      {
        let previousDownload = 0;
        let syncedOne = false;
        let syncedAll = false;
        let sawGeneric = false;
        let sawDownloading = false;

        async function onChanged(subscription, property)
        {
          try
          {
            if (subscription.url != ANOTHER_VALID_SUBSCRIPTION_URL)
              return;

            if (property == "downloading")
            {
              expect(subscription.downloading).toEqual(true);
              sawDownloading = true;
              return;
            }

            if (property == null)
            {
              sawGeneric = true;
              return;
            }

            if (property != "lastDownload")
              return;

            expect(subscription.lastDownload).toBeGreaterThan(previousDownload);
            previousDownload = subscription.lastDownload;

            if (!syncedOne)
            {
              syncedOne = true;
              await new Promise(elapsed => setTimeout(elapsed, 1050));
              await callMethod(["subscriptions"], "sync",
                               [ANOTHER_VALID_SUBSCRIPTION_URL]);
            }
            else if (!syncedAll)
            {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1050));
              await callMethod(["subscriptions"], "sync");
            }
            else
            {
              expect(sawDownloading).toEqual(true);
              expect(sawGeneric).toEqual(true);
              resolve();
            }
          }
          catch (err)
          {
            reject(err);
          }
        }

        addFakeListener({namespace: "subscriptions",
                         eventName: "onChanged",
                         callback: onChanged})
          .then(() => callMethod(["subscriptions"], "add",
                                 [ANOTHER_VALID_SUBSCRIPTION_URL]))
          .catch(reject);
      });
    });
  });

  describe("Filters", () =>
  {
    it("adds a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([VALID_FILTER]);
    });

    it("does not add an invalid filter", () =>
      expect(addFilter(INVALID_FILTER_TEXT)).rejects.toThrow("FilterError")
    );

    it("adds multiple filters", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await addFilter("another-filter");

      expect(await callMethod(["filters"], "getUserFilters")).toEqual([
        VALID_FILTER,
        {...VALID_FILTER, text: "another-filter", slow: true}
      ]);
    });

    it("disable an existing filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "disable", [VALID_FILTER_TEXT]);

      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([{...VALID_FILTER, enabled: false}]);
    });

    it("enables an existing filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "disable", [VALID_FILTER_TEXT]);
      await callMethod(["filters"], "enable", [VALID_FILTER_TEXT]);

      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([VALID_FILTER]);
    });

    it("enables a filter that is already enabled.", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "enable", [VALID_FILTER_TEXT]);

      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([VALID_FILTER]);
    });

    it("removes a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "remove", [VALID_FILTER_TEXT]);

      expect(await callMethod(["filters"], "getUserFilters")).toEqual([]);
    });

    it("normalizes a filter internally", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);

      let PADDED_FILTER_TEXT = " " + VALID_FILTER_TEXT;
      await addFilter(PADDED_FILTER_TEXT);
      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([VALID_FILTER]);

      await callMethod(["filters"], "disable", [PADDED_FILTER_TEXT]);
      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([{...VALID_FILTER, enabled: false}]);

      await callMethod(["filters"], "enable", [PADDED_FILTER_TEXT]);
      expect(await callMethod(["filters"], "getUserFilters"))
        .toEqual([VALID_FILTER]);

      await callMethod(["filters"], "remove", [PADDED_FILTER_TEXT]);
      expect(await callMethod(["filters"], "getUserFilters")).toEqual([]);
    });

    it("validates a valid filter", async() =>
    {
      expect(await callMethod(["filters"], "validate", [VALID_FILTER_TEXT]))
        .toBeNull();
    });

    it("validates a filter with unknown option", async() =>
    {
      let result = await callMethod(["filters"], "validate",
                                    ["@@||example.com^$foo"]);
      expect(result).toEqual("FilterError: {\"type\":\"invalid_filter\"," +
                             "\"reason\":\"filter_unknown_option\"," +
                             "\"option\":\"foo\"}");
    });

    it("validates a filter with an invalid domain", async() =>
    {
      let result = await callMethod(["filters"], "validate",
                                    ["/image.png$domain=http://foo"]);
      // eslint-disable-next-line max-len
      expect(result).toEqual("FilterError: {\"type\":\"invalid_domain\",\"reason\":\"http://foo\",\"option\":null}");
    });

    it("produces the correct slow state for a URL filter", async() =>
    {
      await addFilter("example##.site-panel");

      expect(await callMethod(["filters"], "getUserFilters")).toEqual([
        expect.objectContaining({slow: false})
      ]);
    });

    it("has a selector property", async() =>
    {
      await addFilter("example##.site-panel");

      expect(await callMethod(["filters"], "getUserFilters")).toEqual([
        expect.objectContaining({selector: ".site-panel"})
      ]);
    });

    it("has a csp property", async() =>
    {
      await addFilter(`|${TEST_PAGES_URL}$csp=img-src 'none'`);

      expect(await callMethod(["filters"], "getUserFilters")).toEqual([
        expect.objectContaining({csp: "img-src 'none'"})
      ]);
    });

    it("listens to onAdded events", async() =>
    {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onAdded"});
      await addFilter(VALID_FILTER_TEXT);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", async() =>
    {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onChanged"});
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "disable", [VALID_FILTER_TEXT]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
      expect(fake.lastArg).toEqual("enabled");

      // This is a workaround and should be removed once https://gitlab.com/eyeo/webext/webext-sdk/-/issues/122 is fixed.
      await callMethod(["filters"], "enable", [VALID_FILTER_TEXT]);
    });

    it("listens to onRemoved events", async() =>
    {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onRemoved"});
      await addFilter(VALID_FILTER_TEXT);
      await callMethod(["filters"], "remove", [VALID_FILTER_TEXT]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    describe("Allowlisting", () =>
    {
      const ALLOWING_IMAGE_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/image.html^$document`;
      const ALLOWING_IFRAME_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/iframe.html^$document`;

      it("returns filters for allowlisted tabs", async() =>
      {
        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let tabId = await new Page("image.html").loaded();
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
      });

      it("returns filters for allowlisted tabs after page load", async() =>
      {
        let tabId = await new Page("image.html").loaded();

        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
      });

      async function loadTabWithFrame(path = "iframe.html")
      {
        let tabId = await new Page(path).loaded();
        let frames = await browser.webNavigation.getAllFrames({tabId});
        let {frameId} = frames.find(({url}) => url.endsWith("/image.html"));
        return {tabId, frameId};
      }

      it("returns filters for allowlisted frames", async() =>
      {
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let {tabId, frameId} = await loadTabWithFrame();
        expect(await callMethod(["filters"], "getAllowingFilters",
                                [tabId, {frameId}]))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([]);

        await addFilter(ALLOWING_IFRAME_DOC_FILTER);

        ({tabId, frameId} = await loadTabWithFrame());
        expect(await callMethod(["filters"], "getAllowingFilters",
                                [tabId, {frameId}]))
          .toEqual(expect.arrayContaining([ALLOWING_IMAGE_DOC_FILTER,
                                           ALLOWING_IFRAME_DOC_FILTER]));
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns filters for allowlisted parent frames", async() =>
      {
        let {tabId, frameId} = await loadTabWithFrame();

        await addFilter(ALLOWING_IFRAME_DOC_FILTER);
        expect(await callMethod(["filters"], "getAllowingFilters",
                                [tabId, {frameId}]))
          .toEqual([ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns element-hiding filters for allowlisted tabs", async() =>
      {
        let filter = `@@|${TEST_PAGES_URL}/*.html$elemhide`;

        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);
        await addFilter(filter);

        let tabId = await new Page("image.html").loaded();
        let opts = {types: ["elemhide"]};
        expect(await callMethod(["filters"], "getAllowingFilters",
                                [tabId, opts])).toEqual([filter]);
      });

      it("doesn't return filters for non-allowlisted tabs", async() =>
      {
        let tabId = await new Page("image.html").loaded();
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([]);
      });

      it("doesn't return filters for non-allowlisted frames", async() =>
      {
        let {tabId, frameId} = await loadTabWithFrame();
        expect(await callMethod(["filters"], "getAllowingFilters",
                                [tabId, {frameId}])).toEqual([]);
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([]);
      });

      it("handles empty tabs", async() =>
      {
        let tabId = await new Page("about:blank", true).loaded();
        expect(await callMethod(["filters"], "getAllowingFilters", [tabId]))
          .toEqual([]);
      });

      it("returns whether a resource is allowlisted", async() =>
      {
        let url = `${TEST_PAGES_URL}/image.png`;

        await addFilter(`|${url}^`);
        await addFilter("@@*$image");

        let tabId = await new Page("image.html").loaded();
        expect(await callMethod(["filters"], "isResourceAllowlisted",
                                [url, "image", tabId])).toEqual(true);
      });

      it("returns whether a frame resource is allowlisted", async() =>
      {
        let url = `${TEST_PAGES_URL}/image.html`;
        await addFilter(`|${url}^`);
        await addFilter(`@@||${TEST_PAGES_DOMAIN}^$document`);

        let {tabId, frameId} = await loadTabWithFrame();

        expect(await callMethod(
          ["filters"], "isResourceAllowlisted", [url, "document", tabId]
        )).toEqual(true);
        expect(await callMethod(
          ["filters"],
          "isResourceAllowlisted",
          [url, "document", tabId, frameId]
        )).toEqual(true);
      });

      it("returns whether a resource inside a frame is allowlisted", async() =>
      {
        let url = `${TEST_PAGES_URL}/image.png`;
        await addFilter(`|${url}^`);
        await addFilter("@@*$image,domain=127.0.0.1");

        let {tabId, frameId} = await loadTabWithFrame("iframe-resource.html");

        expect(await callMethod(
          ["filters"], "isResourceAllowlisted", [url, "image", tabId]
        )).toEqual(false);
        expect(await callMethod(
          ["filters"], "isResourceAllowlisted", [url, "image", tabId, frameId]
        )).toEqual(true);
      });
    });
  });

  describe("Initialization", () =>
  {
    after(async() =>
    {
      await browser.runtime.sendMessage(
        {type: "ewe-test:deleteUiLanguageOverride"});
    });

    for (let [language, subscriptionUrl] of [
      ["en", "https://easylist-downloads.adblockplus.org/easylist.txt"],
      ["de", "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"]
    ])
    {
      it(`configures default subscriptions for ${language}`, async function()
      {
        setMinTimeout(this, 3000);

        await browser.runtime.sendMessage(
          {type: "ewe-test:setLanguageAndStart", args: [language]});

        let subs = await callMethod(["subscriptions"], "getDownloadable");
        let urls = [
          subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
          "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
        ];

        expect(subs).toEqual(expect.arrayContaining(urls.map(
          url => expect.objectContaining({url, enabled: true})
        )));

        for (let subscription of subs)
        {
          expect(urls).toContain(subscription.url);
          expect(subscription.downloading ||
                 subscription.lastDownload).toBeTruthy();
        }
      });
    }

    it("informs when the filter engine runs for the first time", async() =>
    {
      let result = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "callMethod", arg: "start"},
        {op: "await"}
      ]);
      expect(result).toEqual({foundStorage: false,
                              foundSubscriptions: false});

      result = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "callMethod", arg: "start"},
        {op: "await"}
      ]);
      expect(result).toEqual({foundStorage: false,
                              foundSubscriptions: true});
    });
  });

  describe("Reporting", () =>
  {
    let allowingItems = {includeElementHiding: false,
                         includeUnmatched: false,
                         filterType: "allowing"};
    let allItemsWithoutEH = {includeElementHiding: false,
                             includeUnmatched: true,
                             filterType: "all"};

    it("exposes a mapping between content types and ResourceTypes", async() =>
    {
      expect(await callMethod(["reporting", "contentTypesMap"],
                              "get", ["font"])).toEqual("font");
      expect(await callMethod(["reporting", "contentTypesMap"],
                              "get", ["beacon"])).toEqual("ping");
    });

    describe("Analytics", () =>
    {
      it("gets the first version", async() =>
      {
        let today = new Date().toISOString().substring(0, 10).replace(/-/g, "");

        await wait(
          async() => await callMethod(["reporting"], "getFirstVersion") != "0",
          1000,
          "No resource has been downloaded yet."
        );
        expect(await callMethod(["reporting"], "getFirstVersion")).toBe(today);
      });
    });


    describe("Diagnostics", () =>
    {
      async function checkLogging(filter, callback, eventOptions,
                                  matchInfo = {}, checkUrl = true)
      {
        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem",
                                          eventOptions});

        await addFilter(filter.text);

        try
        {
          await callback();
        }
        finally
        {
          await callMethod(["filters"], "remove", [filter.text]);
        }

        expect(fake.called).toBeTruthy();

        if (checkUrl)
        {
          expect(fake.firstArg.request).toEqual(
            expect.objectContaining({url: expect.any(String)})
          );
        }

        expect(fake.firstArg).toEqual({
          request: expect.objectContaining({
            tabId: expect.any(Number),
            frameId: expect.any(Number)
          }),
          filter: expect.objectContaining(filter),
          matchInfo: expect.objectContaining({
            docDomain: "localhost",
            ...matchInfo
          })
        });
      }

      function checkRequestLogging(page, filter, matchInfo, eventOptions)
      {
        return checkLogging(filter, () => new Page(page).loaded(),
                            eventOptions, matchInfo);
      }

      async function checkUnmatchedLogging(callback, requests, eventOptions)
      {
        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem",
                                          eventOptions});

        await callback();
        expect(fake.called).toBeTruthy();

        let firstArgs = fake.args.map(args => args[0]);
        expect(firstArgs).toEqual(expect.arrayContaining(requests));
      }

      it("it does not log removed items", async() =>
      {
        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem"});

        await addFilter("/image.png^$image");
        let page = new Page("image.html");
        await page.loaded();
        expect(fake.called).toBeTruthy();

        let {callCount} = fake;
        await removeFakeListeners();
        await new Page("image.html").loaded();
        expect(fake.callCount).toEqual(callCount);
      });

      it("logs blocking request filter", async() =>
      {
        await checkRequestLogging("image.html", {
          text: "/image.png^$image",
          slow: false,
          enabled: true,
          type: "blocking",
          thirdParty: null
        }, {method: "request"});
      });

      it("logs third-party requests", async() =>
      {
        await checkRequestLogging("third-party.html", {
          text: "/image.png$third-party",
          thirdParty: true
        });
      });

      it("logs allowlisting request filter", async() =>
      {
        await addFilter("/image.png^$image");
        await checkRequestLogging("image.html", {
          text: `@@|${TEST_PAGES_URL}$image`,
          type: "allowing"
        }, {
          specificOnly: false,
          method: "header"
        }, allowingItems);
      });

      it("logs rewrite filter", async() =>
      {
        await checkRequestLogging(
          "script.html",
          {text: "*.js$rewrite=abp-resource:blank-js,domain=localhost"},
          {
            rewrittenUrl: "data:application/javascript,",
            specificOnly: false
          });
      });

      it("logs blocking $header filter", async() =>
      {
        await checkRequestLogging(
          "header.html",
          {text: `|${TEST_PAGES_URL}$header=x-header=whatever`},
          {method: "header"});
      });

      it("logs allowlisting $header filter", async() =>
      {
        await addFilter(`|${TEST_PAGES_URL}$header=x-header=whatever`);
        await checkRequestLogging("header.html",
                                  {text: `@@|${TEST_PAGES_URL}$header`}, null,
                                  allowingItems);
      });

      it("logs blocking $csp filter", async() =>
      {
        await checkRequestLogging(
          "csp.html",
          {text: `|${TEST_PAGES_URL}$csp=img-src 'none'`},
          {method: "csp"});
      });

      it("logs allowlisting $csp filter", async() =>
      {
        await addFilter(`|${TEST_PAGES_URL}$csp=img-src 'none'`);
        await checkRequestLogging("csp.html",
                                  {text: `@@|${TEST_PAGES_URL}$csp`},
                                  {method: "csp"},
                                  allowingItems);
      });

      for (let option of ["$document", "$elemhide",
                          "$genericblock", "$generichide"])
      {
        it(`logs allowlisting ${option} filter`, () => checkRequestLogging(
          "image.html",
          {text: `@@|${TEST_PAGES_URL}${option}`},
          {method: "allowing", allowingReason: option.substring(1)},
          allowingItems
        ));
      }

      it("logs allowlisting for different domain iframe", async() =>
      {
        let url = "http://127.0.0.1:3000/iframe.html";
        await checkLogging({text: `@@|${TEST_PAGES_URL}/image.html^$document`},
                           () => new Page(url, true).loaded(),
                           allowingItems,
                           {method: "allowing",
                            docDomain: "127.0.0.1"});
      });

      it("logs element hiding filter", async() =>
      {
        await checkLogging({text: "###elem-hide"}, async() =>
        {
          let tabId = await new Page("element-hiding.html").loaded();
          await waitForInvisibleElement(tabId, "elem-hide");
        }, {includeElementHiding: true,
            includeUnmatched: false,
            filterType: "all"}, {method: "elemhide"}
        );
      });

      it("logs element hiding filter for a given tab", async() =>
      {
        let page = new Page("element-hiding.html");
        let tabId = await page.created;

        await checkLogging({text: "###elem-hide"}, async() =>
        {
          await page.loaded();
          await waitForInvisibleElement(tabId, "elem-hide");
        }, {includeElementHiding: true,
            includeUnmatched: false,
            filterType: "all",
            tabId}, {method: "elemhide"}
        );
      });

      let allItemsRequests = [{
        request: expect.objectContaining({
          tabId: expect.any(Number),
          frameId: expect.any(Number),
          url: `${TEST_PAGES_URL}/element-hiding.html`,
          type: "main_frame"
        }),
        filter: null,
        matchInfo: expect.objectContaining({
          docDomain: TEST_PAGES_DOMAIN,
          method: "csp"
        })
      }, {
        request: expect.objectContaining({
          tabId: expect.any(Number),
          frameId: expect.any(Number),
          url: `${TEST_PAGES_URL}/image.png`,
          type: "image"
        }),
        filter: expect.objectContaining({text: VALID_FILTER_TEXT}),
        matchInfo: expect.objectContaining({
          docDomain: TEST_PAGES_DOMAIN,
          method: "request"
        })
      }, {
        request: expect.objectContaining({
          tabId: expect.any(Number),
          frameId: expect.any(Number),
          url: `${TEST_PAGES_URL}/element-hiding.html`
        }),
        filter: expect.objectContaining({text: "###elem-hide"}),
        matchInfo: expect.objectContaining({
          docDomain: TEST_PAGES_DOMAIN,
          method: "elemhide"
        })
      }];

      it("logs all items", async() =>
      {
        await addFilter("###elem-hide");
        await addFilter(VALID_FILTER_TEXT);

        await checkUnmatchedLogging(async() =>
        {
          let tabId = await new Page("element-hiding.html").loaded();
          await waitForInvisibleElement(tabId, "elem-hide");
        }, allItemsRequests, {includeElementHiding: true,
                              includeUnmatched: true,
                              filterType: "all"});
      });

      it("logs for the requested tab", async() =>
      {
        await addFilter(VALID_FILTER_TEXT);

        let page = new Page("image.html");
        let tabId = await page.created;

        let [fake1, fake2] = await Promise.all(
          [tabId, tabId + 1].map(
            id => addFakeListener({namespace: "reporting",
                                   eventName: "onBlockableItem",
                                   eventOptions: {tabId: id}})
          )
        );

        await page.loaded();

        expect(fake1.called).toBeTruthy();
        expect(fake2.called).toBeFalsy();
      });

      it("logs snippets filter", async() =>
      {
        let snippet = "do";

        await setTestSnippets(snippet);
        try
        {
          await checkLogging({text: `${TEST_PAGES_DOMAIN}#$#${snippet}`},
                             () => new Page("image.html").loaded(),
                             {includeElementHiding: false,
                              includeUnmatched: false,
                              filterType: "blocking"},
                             {method: "snippet"}, false);
        }
        finally
        {
          await setTestSnippets(null);
        }
      });

      function checkPopupLogging(text, filterType)
      {
        return checkLogging({text}, () =>
          new Popup("link", new Page("popup-opener.html")).blocked,
                            {includeElementHiding: false,
                             includeUnmatched: false,
                             filterType},
                            {method: "popup"}
        );
      }

      it("logs blocking popup filter", async() =>
      {
        await checkPopupLogging("*popup.html^$popup", "blocking");
      });

      it("logs allowlisting popup filter", async() =>
      {
        await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
        await checkPopupLogging(`@@|${TEST_PAGES_URL}$popup`, "allowing");
      });

      describe("Unmatched requests", () =>
      {
        it("logs unmatched image requests", async() =>
        {
          await checkUnmatchedLogging(() => new Page("image.html").loaded(), [{
            request: expect.objectContaining({
              tabId: expect.any(Number),
              frameId: expect.any(Number),
              url: `${TEST_PAGES_URL}/image.png`,
              type: "image"
            }),
            filter: null,
            matchInfo: expect.objectContaining({
              docDomain: TEST_PAGES_DOMAIN,
              method: "request",
              specificOnly: false
            })
          }], allItemsWithoutEH);
        });

        it("logs unmatched requests for the requested tab", async() =>
        {
          let page = new Page("image.html");
          let tabId = await page.created;

          let [fake1, fake2] = await Promise.all(
            [tabId, tabId + 1].map(
              id => addFakeListener({namespace: "reporting",
                                     eventName: "onBlockableItem",
                                     eventOptions: {includeUnmatched: true,
                                                    tabId: id}})
            )
          );

          await page.loaded();

          expect(fake1.called).toBeTruthy();
          expect(fake2.called).toBeFalsy();

          let firstArgs = fake1.args.map(args => args[0]);
          expect(firstArgs).toEqual(expect.arrayContaining([{
            request: expect.objectContaining({
              tabId: expect.any(Number),
              frameId: expect.any(Number),
              url: `${TEST_PAGES_URL}/image.png`,
              type: "image"
            }),
            filter: null,
            matchInfo: expect.objectContaining({
              docDomain: TEST_PAGES_DOMAIN,
              method: "request",
              specificOnly: false
            })
          }]));
        });

        it("logs unmatched document requests", async() =>
        {
          await checkUnmatchedLogging(() => new Page("image.html").loaded(), [{
            request: expect.objectContaining({
              tabId: expect.any(Number),
              frameId: expect.any(Number),
              url: `${TEST_PAGES_URL}/image.html`,
              type: "main_frame"
            }),
            filter: null,
            matchInfo: expect.objectContaining({
              docDomain: TEST_PAGES_DOMAIN,
              method: "csp",
              specificOnly: false
            })
          }], allItemsWithoutEH);
        });

        it("logs unmatched iframe requests", async() =>
        {
          await checkUnmatchedLogging(() => new Page("iframe.html").loaded(), [
            {
              request: expect.objectContaining({
                tabId: expect.any(Number),
                frameId: expect.any(Number),
                url: `${TEST_PAGES_URL}/image.html`,
                type: "sub_frame"
              }),
              filter: null,
              matchInfo: expect.objectContaining({
                docDomain: TEST_PAGES_DOMAIN,
                method: "csp",
                specificOnly: false
              })
            },
            {
              request: expect.objectContaining({
                tabId: expect.any(Number),
                frameId: expect.any(Number),
                url: `${TEST_PAGES_URL}/image.png`,
                type: "image"
              }),
              filter: null,
              matchInfo: expect.objectContaining({
                docDomain: TEST_PAGES_DOMAIN,
                method: "request",
                specificOnly: false
              })
            }
          ], allItemsWithoutEH);
        });

        it("logs unmatched allowlisted iframe requests", async() =>
        {
          await addFilter(`@@|${TEST_PAGES_URL}/image.html$document`);


          await checkUnmatchedLogging(() =>
            new Page("iframe.html").loaded(), [
            {
              request: expect.objectContaining({
                tabId: expect.any(Number),
                frameId: expect.any(Number),
                url: `${TEST_PAGES_URL}/image.html`,
                type: "sub_frame"
              }),
              filter: null,
              matchInfo: {
                docDomain: TEST_PAGES_DOMAIN,
                specificOnly: false
              }
            },
            {
              request: expect.objectContaining({
                frameId: expect.any(Number),
                tabId: expect.any(Number),
                url: `${TEST_PAGES_URL}/image.html`
              }),
              filter: expect.objectContaining({
                enabled: true,
                text: `@@|${TEST_PAGES_URL}/image.html$document`,
                type: "allowing"
              }),
              matchInfo: expect.objectContaining({
                allowingReason: "document",
                method: "allowing"
              })
            }
          ], allItemsWithoutEH);
        });
      });
    });

    describe("Notifications", () =>
    {
      it("supports notifications", async() =>
      {
        let notification = {id: "test"};

        await callMethod(["notifications"], "start");
        await callMethod(["notifications"], "addNotification", [notification]);

        let fake = await addFakeListener({namespace: "notifications",
                                          method: "addShowListener",
                                          removeMethod: "removeShowListener"});
        await callMethod(["notifications"], "showNext");
        await callMethod(["notifications"], "removeNotification",
                         [notification]);

        await callMethod(["notifications"], "stop");

        expect(fake.callCount).toBe(1);
        expect(fake.firstArg).toEqual(notification);
      });
    });
  });

  describe("Debugging", async() =>
  {
    function getBackgroundColor()
    {
      let elem = document.getElementById("elem-hide");
      return window.getComputedStyle(elem)["background-color"];
    }

    async function waitForHighlightedStyle()
    {
      let tabId = await new Page("element-hiding.html").loaded();
      let style;
      await wait(async() =>
      {
        style = await executeScript(tabId, getBackgroundColor);
        return style != "rgba(0, 0, 0, 0)";
      }, 500, "Style is not highlighted");

      return style;
    }

    it("highlights an element", async() =>
    {
      await callMethod(["debugging"], "setElementHidingDebugMode", [true]);
      await addFilter("###elem-hide");
      let style = await waitForHighlightedStyle();
      await callMethod(["debugging"], "setElementHidingDebugMode", [false]);

      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async() =>
    {
      await callMethod(["debugging"], "setElementHidingDebugMode", [true]);
      await callMethod(["debugging"], "setElementHidingDebugMode", [false]);
      await addFilter("###elem-hide");
      let tabId = await new Page("element-hiding.html").loaded();
      let style = await executeScript(tabId, getBackgroundColor);

      expect(style).toBe("rgba(0, 0, 0, 0)");
    });

    it("highlights an element with a custom style", async() =>
    {
      await callMethod(["debugging"], "setElementHidingDebugMode", [true]);
      await callMethod(["debugging"], "setElementHidingDebugStyle",
                       [[["background", "pink"]]]);
      await addFilter("###elem-hide");
      let style = await waitForHighlightedStyle();
      await callMethod(["debugging"], "setElementHidingDebugMode", [false]);

      expect(style).toBe("rgb(255, 192, 203)");
    });
  });
});
