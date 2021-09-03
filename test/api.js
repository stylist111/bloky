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
        TEST_PAGES_URL, TEST_PAGES_DOMAIN} from "./utils.js";
import {addFilter, runInBackgroundPage, addFakeListener} from "./messaging.js";

const VALID_SUBSCRIPTION_URL = "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt";
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_FILTER_TEXT = "$image";
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: true,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};
const INVALID_FILTER_TEXT = "/foo/$rewrite=";

let subscriptionsProp = [
  {op: "getGlobal", arg: "EWE"},
  {op: "getProp", arg: "subscriptions"}
];
let filtersProp = [
  {op: "getGlobal", arg: "EWE"},
  {op: "getProp", arg: "filters"}
];

function addSubscription(subscription)
{
  return runInBackgroundPage([
    ...subscriptionsProp,
    {op: "pushArg", arg: subscription},
    {op: "callMethod", arg: "add"}
  ]);
}

function disableSubscription(subscription)
{
  return runInBackgroundPage([
    ...subscriptionsProp,
    {op: "pushArg", arg: subscription},
    {op: "callMethod", arg: "disable"}
  ]);
}

function enableSubscription(subscription)
{
  return runInBackgroundPage([
    ...subscriptionsProp,
    {op: "pushArg", arg: subscription},
    {op: "callMethod", arg: "enable"}
  ]);
}

function removeSubscription(subscription)
{
  return runInBackgroundPage([
    ...subscriptionsProp,
    {op: "pushArg", arg: subscription},
    {op: "callMethod", arg: "remove"}
  ]);
}

function getDownloadable()
{
  return runInBackgroundPage([
    ...subscriptionsProp,
    {op: "callMethod", arg: "getDownloadable"}
  ]);
}

function getAllFilters()
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "callMethod", arg: "getAll"}
  ]);
}

function disableFilter(filter)
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "pushArg", arg: filter},
    {op: "callMethod", arg: "disable"}
  ]);
}

function enableFilter(filter)
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "pushArg", arg: filter},
    {op: "callMethod", arg: "enable"}
  ]);
}

function removeFilter(filter)
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "pushArg", arg: filter},
    {op: "callMethod", arg: "remove"}
  ]);
}

function validateFilter(filter)
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "pushArg", arg: filter},
    {op: "callMethod", arg: "validate"}
  ]);
}

function getAllowingFilters(tabId, opts)
{
  return runInBackgroundPage([
    ...filtersProp,
    {op: "pushArg", arg: tabId},
    {op: "pushArg", arg: opts},
    {op: "callMethod", arg: "getAllowingFilters"}
  ]);
}

function setElementHidingDebugMode(enabled)
{
  return runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "debugging"},
    {op: "pushArg", arg: enabled},
    {op: "callMethod", arg: "setElementHidingDebugMode"}
  ]);
}

function setElementHidingDebugStyle(cssProperties, cssSnippetProperties)
{
  return runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "debugging"},
    {op: "pushArg", arg: cssProperties},
    {op: "pushArg", arg: cssSnippetProperties},
    {op: "callMethod", arg: "setElementHidingDebugStyle"}
  ]);
}

function getFirstVersion()
{
  return runInBackgroundPage([
    {op: "getGlobal", arg: "EWE"},
    {op: "getProp", arg: "reporting"},
    {op: "callMethod", arg: "getFirstVersion"}
  ]);
}

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
      await addSubscription(VALID_SUBSCRIPTION_URL);

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
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

      await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
        {op: "pushArg", arg: {title, homepage}},
        {op: "callMethod", arg: "add"}
      ]);

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title,
        homepage,
        downloadable: true
      })]);
    });

    it("does not add an invalid subscription", () =>
      expect(addSubscription(INVALID_SUBSCRIPTION_URL)).rejects.toThrow(
        "Error: Invalid subscription URL provided: invalidUrl"
      )
    );

    it("adds multiple subscriptions", async() =>
    {
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await addSubscription(VALID_SUBSCRIPTION_URL + "?2");

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("gets subscriptions for a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);

      let result = await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "pushArg", arg: VALID_FILTER_TEXT},
        {op: "callMethod", arg: "getForFilter"}
      ]);

      expect(result).toEqual([
        expect.objectContaining({downloadable: false})
      ]);
    });

    it("gets filters from a subscription", async() =>
    {
      let result = await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
        {op: "callMethod", arg: "getFilters"}
      ]);

      expect(result).toEqual([]);

      await addSubscription(VALID_SUBSCRIPTION_URL);

      await wait(async() =>
      {
        result = await runInBackgroundPage([
          ...subscriptionsProp,
          {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
          {op: "callMethod", arg: "getFilters"}
        ]);

        return result.length > 0;
      }, 4000);

      expect(result).toEqual(expect.arrayContaining([expect.objectContaining(
        {text: "||testpages.adblockplus.org/testfiles/image/static/$image"}
      )]));
    });

    it("checks if a subscription has been added", async() =>
    {
      let result = await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
        {op: "callMethod", arg: "has"}
      ]);
      expect(result).toBe(false);
      await addSubscription(VALID_SUBSCRIPTION_URL);

      result = await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
        {op: "callMethod", arg: "has"}
      ]);
      expect(result).toBe(true);
    });

    it("disables an existing subscription", async() =>
    {
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await disableSubscription(VALID_SUBSCRIPTION_URL);

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", async() =>
    {
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await disableSubscription(VALID_SUBSCRIPTION_URL);
      await enableSubscription(VALID_SUBSCRIPTION_URL);

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("enables a subscription that is already enabled.", async() =>
    {
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await enableSubscription(VALID_SUBSCRIPTION_URL);

      let subscriptions = await getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("fails enabling/disabling a nonexistent subscription", async() =>
    {
      let errorMessage = "Error: Subscription does not exist: DoesNotExist";
      await expect(enableSubscription("DoesNotExist"))
        .rejects.toThrow(errorMessage);
      await expect(disableSubscription("DoesNotExist"))
        .rejects.toThrow(errorMessage);
    });

    it("removes a subscription", async() =>
    {
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await removeSubscription(VALID_SUBSCRIPTION_URL);

      expect(await getDownloadable()).toEqual([]);
    });

    it("gets recommendations", async() =>
    {
      let result = await runInBackgroundPage([
        ...subscriptionsProp,
        {op: "callMethod", arg: "getRecommendations"}
      ]);

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
      let fake = await addFakeListener("subscriptions", "onAdded");
      await addSubscription(VALID_SUBSCRIPTION_URL);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL
      }));
    });

    it("listens to onChanged events", async() =>
    {
      let fake = await addFakeListener("subscriptions", "onChanged");
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await disableSubscription(VALID_SUBSCRIPTION_URL);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
    });

    it("listens to onRemoved events", async() =>
    {
      let fake = await addFakeListener("subscriptions", "onRemoved");
      await addSubscription(VALID_SUBSCRIPTION_URL);
      await removeSubscription(VALID_SUBSCRIPTION_URL);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      );
    });

    it("syncs subscriptions", async function()
    {
      setMinTimeout(this, 5000);

      await new Promise((resolve, reject) =>
      {
        let previousDownload = 0;
        let syncedOne = false;
        let syncedAll = false;

        async function onChanged(subscription)
        {
          try
          {
            if (subscription.url != VALID_SUBSCRIPTION_URL)
              return;

            expect(subscription.lastDownload).toBeGreaterThan(previousDownload);
            previousDownload = subscription.lastDownload;

            if (!syncedOne)
            {
              syncedOne = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              await runInBackgroundPage([
                ...subscriptionsProp,
                {op: "pushArg", arg: VALID_SUBSCRIPTION_URL},
                {op: "callMethod", arg: "sync"}
              ]);
            }
            else if (!syncedAll)
            {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              await runInBackgroundPage([
                ...subscriptionsProp,
                {op: "callMethod", arg: "sync"}
              ]);
            }
            else
            {
              resolve();
            }
          }
          catch (err)
          {
            reject(err);
          }
        }

        addFakeListener("subscriptions", "onChanged",
                        void 0, void 0, onChanged)
          .then(() => addSubscription(VALID_SUBSCRIPTION_URL))
          .catch(reject);
      });
    });
  });

  describe("Filters", () =>
  {
    it("adds a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);

      let filters = await getAllFilters();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("does not add an invalid filter", () =>
      expect(addFilter(INVALID_FILTER_TEXT)).rejects.toThrow("FilterError")
    );

    it("adds multiple filters", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await addFilter("another-filter");

      let filters = await getAllFilters();
      expect(filters).toEqual([
        VALID_FILTER,
        {...VALID_FILTER, text: "another-filter"}
      ]);
    });

    it("disable an existing filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await disableFilter(VALID_FILTER_TEXT);

      let filters = await getAllFilters();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);
    });

    it("enables an existing filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await disableFilter(VALID_FILTER_TEXT);
      await enableFilter(VALID_FILTER_TEXT);

      let filters = await getAllFilters();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("enables a filter that is already enabled.", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await enableFilter(VALID_FILTER_TEXT);

      let filters = await getAllFilters();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("removes a filter", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);
      await removeFilter(VALID_FILTER_TEXT);

      expect(await getAllFilters()).toEqual([]);
    });

    it("normalizes a filter internally", async() =>
    {
      await addFilter(VALID_FILTER_TEXT);

      let PADDED_FILTER_TEXT = " " + VALID_FILTER_TEXT;
      await addFilter(PADDED_FILTER_TEXT);
      expect(await getAllFilters()).toEqual([VALID_FILTER]);

      await disableFilter(PADDED_FILTER_TEXT);
      let filters = await getAllFilters();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);

      await enableFilter(PADDED_FILTER_TEXT);
      expect(await getAllFilters()).toEqual([VALID_FILTER]);

      await removeFilter(PADDED_FILTER_TEXT);
      expect(await getAllFilters()).toEqual([]);
    });

    it("validates a valid filter", async() =>
    {
      let result = await validateFilter(VALID_FILTER_TEXT);
      expect(result).toBeNull();
    });

    it("validates a filter with unknown option", async() =>
    {
      let result = await validateFilter("@@||example.com^$foo");
      expect(result).toEqual("FilterError: {\"type\":\"invalid_filter\"," +
                             "\"reason\":\"filter_unknown_option\"," +
                             "\"option\":\"foo\"}");
    });

    it("validates a filter with an invalid domain", async() =>
    {
      let result = await validateFilter("/image.png$domain=http://foo");
      // eslint-disable-next-line max-len
      expect(result).toEqual("FilterError: {\"type\":\"invalid_domain\",\"reason\":\"http://foo\",\"option\":null}");
    });

    it("produces the correct slow state for a URL filter", async() =>
    {
      await addFilter("example##.site-panel");

      expect(await getAllFilters()).toEqual([
        expect.objectContaining({slow: false})
      ]);
    });

    it("has a selector property", async() =>
    {
      await addFilter("example##.site-panel");

      expect(await getAllFilters()).toEqual([
        expect.objectContaining({selector: ".site-panel"})
      ]);
    });

    it("has a csp property", async() =>
    {
      await addFilter("*$csp=img-src 'none'");

      expect(await getAllFilters()).toEqual([
        expect.objectContaining({csp: "img-src 'none'"})
      ]);
    });

    it("listens to onAdded events", async() =>
    {
      let fake = await addFakeListener("filters", "onAdded");
      await addFilter(VALID_FILTER_TEXT);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", async() =>
    {
      let fake = await addFakeListener("filters", "onChanged");
      await addFilter(VALID_FILTER_TEXT);
      await disableFilter(VALID_FILTER_TEXT);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    it("listens to onRemoved events", async() =>
    {
      let fake = await addFakeListener("filters", "onRemoved");
      await addFilter(VALID_FILTER_TEXT);
      await removeFilter(VALID_FILTER_TEXT);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    describe("Allowlisting", () =>
    {
      const ALLOWING_IMAGE_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/image.html^$document`;

      it("returns filters for allowlisted tabs", async() =>
      {
        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let tabId = await new Page("image.html").loaded();
        expect(await getAllowingFilters(tabId)).toEqual(
          [ALLOWING_IMAGE_DOC_FILTER]);
      });

      async function loadTabWithFrame()
      {
        let tabId = await new Page("iframe.html").loaded();
        let frames = await browser.webNavigation.getAllFrames({tabId});
        let {frameId} = frames.find(({url}) =>
          url == `${TEST_PAGES_URL}/image.html`);
        return {tabId, frameId};
      }

      it("returns filters for allowlisted frames", async() =>
      {
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let {tabId, frameId} = await loadTabWithFrame();
        expect(await getAllowingFilters(tabId, {frameId})).toEqual(
          [ALLOWING_IMAGE_DOC_FILTER]);
        expect(await getAllowingFilters(tabId)).toEqual([]);

        await addFilter(`@@|${TEST_PAGES_URL}/iframe.html^$document`);

        ({tabId, frameId} = await loadTabWithFrame());

        const ALLOWING_IFRAME_DOC_FILTER =
          `@@|${TEST_PAGES_URL}/iframe.html^$document`;

        expect(await getAllowingFilters(tabId, {frameId})).toEqual([
          ALLOWING_IFRAME_DOC_FILTER, ALLOWING_IMAGE_DOC_FILTER]);
        expect(await getAllowingFilters(tabId)).toEqual([
          ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns element-hiding filters for allowlisted tabs", async() =>
      {
        let filter = `@@|${TEST_PAGES_URL}/*.html$elemhide`;

        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);
        await addFilter(filter);

        let tabId = await new Page("image.html").loaded();
        let opts = {types: ["elemhide"]};
        expect(await getAllowingFilters(tabId, opts)).toEqual([filter]);
      });

      it("doesn't return filters for non-allowlisted tabs", async() =>
      {
        let tabId = await new Page("image.html").loaded();
        expect(await getAllowingFilters(tabId)).toEqual([]);
      });

      it("doesn't return filters for non-allowlisted frames", async() =>
      {
        let {tabId, frameId} = await loadTabWithFrame();
        expect(await getAllowingFilters(tabId, {frameId})).toEqual([]);
        expect(await getAllowingFilters(tabId)).toEqual([]);
      });

      it("handles empty tabs", async() =>
      {
        let tabId = await new Page("about:blank", true).loaded();
        expect(await getAllowingFilters(tabId)).toEqual([]);
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
      it(`configures default subscriptions for ${language}`, async() =>
      {
        await browser.runtime.sendMessage(
          {type: "ewe-test:setLanguageAndStart", args: [language]});

        let subscriptions = await getDownloadable();
        let urls = [
          subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
          "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
        ];

        expect(subscriptions).toEqual(expect.arrayContaining(urls.map(
          url => expect.objectContaining({url, enabled: true})
        )));

        for (let subscription of subscriptions)
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
      expect(result).toEqual({storageFirstRun: true,
                              subscriptionsFirstRun: true});

      result = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "callMethod", arg: "start"},
        {op: "await"}
      ]);
      expect(result).toEqual({storageFirstRun: true,
                              subscriptionsFirstRun: false});
    });
  });

  describe("Reporting", () =>
  {
    describe("Analytics", () =>
    {
      it("gets the first version", async() =>
      {
        let today = new Date().toISOString().substring(0, 10).replace(/-/g, "");

        await wait(async() => await getFirstVersion() != "0", 1000,
                   "No resource has been downloaded yet.");
        expect(await getFirstVersion()).toBe(today);
      });
    });

    describe("Diagnostics", () =>
    {
      async function checkLogging(filter, callback, info = {}, checkUrl = true)
      {
        let fake = await addFakeListener("reporting", "onFilterMatch");
        await addFilter(filter.text);

        try
        {
          await callback();
        }
        finally
        {
          await removeFilter(filter.text);
        }

        expect(fake.called).toBeTruthy();

        if (checkUrl)
        {
          expect(fake.firstArg.details).toEqual(
            expect.objectContaining({url: expect.any(String)})
          );
        }

        expect(fake.firstArg).toEqual({
          details: expect.objectContaining({
            tabId: expect.any(Number),
            frameId: expect.any(Number)
          }),
          filter: expect.objectContaining(filter),
          info: expect.objectContaining(info)
        });
      }

      function checkRequestLogging(page, filter, info)
      {
        return checkLogging(filter, () => new Page(page).loaded(), info);
      }

      it("logs blocking request filter", async() =>
      {
        await checkRequestLogging("image.html", {
          text: "/image.png^$image",
          slow: false,
          enabled: true,
          type: "blocking",
          thirdParty: null
        }, {matchingMethod: "request"});
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
          text: "@@$image",
          type: "allowing"
        }, {
          docDomain: "localhost",
          specificOnly: false,
          matchingMethod: "header"
        });
      });

      it("logs rewrite filter", async() =>
      {
        await checkRequestLogging(
          "script.html",
          {text: "*.js$rewrite=abp-resource:blank-js,domain=localhost"},
          {
            docDomain: "localhost",
            rewrittenUrl: "data:application/javascript,",
            specificOnly: false
          });
      });

      it("logs blocking $header filter", async() =>
      {
        await checkRequestLogging("header.html",
                                  {text: "*$header=x-header=whatever"},
                                  {matchingMethod: "header"});
      });

      it("logs allowlisting $header filter", async() =>
      {
        await addFilter("*$header=x-header=whatever");
        await checkRequestLogging("header.html", {text: "@@$header"});
      });

      it("logs blocking $csp filter", async() =>
      {
        await checkRequestLogging("csp.html", {text: "*$csp=img-src 'none'"},
                                  {matchingMethod: "csp"});
      });

      it("logs allowlisting $csp filter", async() =>
      {
        await addFilter("*$csp=img-src 'none'");
        await checkRequestLogging("csp.html", {text: "@@$csp"},
                                  {matchingMethod: "csp"});
      });

      for (let option of ["$document", "$elemhide",
                          "$genericblock", "$generichide"])
      {
        it(`logs allowlisting ${option} filter`, () =>
          checkRequestLogging("image.html", {text: `@@${option}`},
                              {matchingMethod: "allowing"})
        );
      }

      it("logs element hiding filter", async() =>
      {
        await checkLogging({text: "###elem-hide"}, async() =>
        {
          let tabId = await new Page("element-hiding.html").loaded();
          await waitForInvisibleElement(tabId, "elem-hide");
        }, {matchingMethod: "elemhide"});
      });

      it("logs snippets filter", () =>
        checkLogging({text: `${TEST_PAGES_DOMAIN}#$#do`},
                     () => new Page("image.html").loaded(),
                     {matchingMethod: "snippet"}, false)
      );

      function checkPopupLogging(text)
      {
        return checkLogging({text}, () =>
          new Popup("link", new Page("popup-opener.html")).blocked,
                            {matchingMethod: "popup"}
        );
      }

      it("logs blocking popup filter", async() =>
      {
        await checkPopupLogging("*popup.html^$popup");
      });

      it("logs allowlisting popup filter", async() =>
      {
        await addFilter("*popup.html^$popup");
        await checkPopupLogging("@@$popup");
      });
    });

    describe("Notifications", () =>
    {
      it("supports notifications", async() =>
      {
        let notification = {id: "test"};

        await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "notifications"},
          {op: "pushArg", arg: notification},
          {op: "callMethod", arg: "addNotification"}
        ]);

        let fake = await addFakeListener("notifications", null,
                                         "addShowListener",
                                         "removeShowListener");
        await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "notifications"},
          {op: "callMethod", arg: "showNext"}
        ]);

        await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "notifications"},
          {op: "pushArg", arg: notification},
          {op: "callMethod", arg: "removeNotification"}
        ]);

        expect(fake.callCount).toBe(1);
        expect(fake.firstArg).toEqual(notification);
      });
    });
  });

  describe("Debugging", async() =>
  {
    async function getElementStyle(id, property)
    {
      let tabId = await new Page("element-hiding.html").loaded();
      let code = `let el = document.getElementById("${id}");
                  let styles = window.getComputedStyle(el);
                  styles["${property}"]`;
      return (await browser.tabs.executeScript(tabId, {code}))[0];
    }

    it("highlights an element", async() =>
    {
      await setElementHidingDebugMode(true);
      await addFilter("###elem-hide");

      let tabId = await new Page("element-hiding.html").loaded();
      let code = `window.getComputedStyle(
        document.getElementById('elem-hide'))['background-color']`;

      let style;
      await wait(async() =>
      {
        style = (await browser.tabs.executeScript(tabId, {code}))[0];
        return style != "rgba(0, 0, 0, 0)";
      }, 500);

      await setElementHidingDebugMode(false);
      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async() =>
    {
      await setElementHidingDebugMode(true);
      await setElementHidingDebugMode(false);

      await addFilter("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      expect(style).toBe("rgba(0, 0, 0, 0)");
    });

    it("highlights an element with a custom style", async() =>
    {
      await setElementHidingDebugMode(true);
      await setElementHidingDebugStyle([["background", "pink"]]);
      await addFilter("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      await setElementHidingDebugMode(false);
      expect(style).toBe("rgb(255, 192, 203)");
    });
  });
});
