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
import sinon from "sinon/pkg/sinon.js";

import {Page, Popup, setMinTimeout, waitForInvisibleElement, wait,
        TEST_PAGES_URL, TEST_PAGES_DOMAIN} from "./utils.js";

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

describe("API", () =>
{
  afterEach(() =>
  {
    Page.removeCurrent();
    Popup.removeCurrent();
  });

  describe("Subscriptions", () =>
  {
    it("adds a subscription", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL,
        homepage: null,
        downloadable: true
      })]);
    });

    it("adds a subscription with properties", () =>
    {
      let title = "testTitle";
      let homepage = "testHomePage";

      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL, {title, homepage});

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title,
        homepage,
        downloadable: true
      })]);
    });

    it("does not add an invalid subscription", () =>
    {
      expect(() => EWE.subscriptions.add(INVALID_SUBSCRIPTION_URL))
        .toThrowError("Invalid subscription URL");
    });

    it("adds multiple subscriptions", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL + "?2");

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("gets subscriptions for a filter", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);

      expect(EWE.subscriptions.getForFilter(VALID_FILTER_TEXT)).toEqual([
        expect.objectContaining({downloadable: false})
      ]);
    });

    it("gets filters from a subscription", async() =>
    {
      expect(EWE.subscriptions.getFilters(VALID_SUBSCRIPTION_URL)).toEqual([]);

      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let filters;
      await wait(() =>
      {
        filters = EWE.subscriptions.getFilters(VALID_SUBSCRIPTION_URL);
        return filters.length > 0;
      }, 4000);

      expect(filters).toEqual(expect.arrayContaining([expect.objectContaining(
        {text: "||testpages.adblockplus.org/testfiles/image/static/$image"}
      )]));
    });

    it("checks if a subscription has been added", () =>
    {
      expect(EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBeFalsy();
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      expect(EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBeTruthy();
    });

    it("disables an existing subscription", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("enables a subscription that is already enabled.", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = EWE.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("fails enabling/disabling a nonexistent subscription", () =>
    {
      expect(
        () => EWE.subscriptions.enable("DoesNotExist")
      ).toThrowError("Subscription does not exist");

      expect(
        () => EWE.subscriptions.disable("DoesNotExist")
      ).toThrowError("Subscription does not exist");
    });

    it("removes a subscription", () =>
    {
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);

      expect(EWE.subscriptions.getDownloadable()).toEqual([]);
    });

    it("gets recommendations", () =>
    {
      let recommendations = EWE.subscriptions.getRecommendations();

      expect(recommendations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          languages: ["en"],
          title: "EasyList",
          type: "ads",
          url: "https://easylist-downloads.adblockplus.org/easylist.txt"
        })
      ]));

      for (let item of recommendations)
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

    it("listens to onAdded events", () =>
    {
      let fake = sinon.fake();

      EWE.subscriptions.onAdded.addListener(fake);
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.onAdded.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL
      }));
    });

    it("listens to onChanged events", () =>
    {
      let fake = sinon.fake();

      EWE.subscriptions.onChanged.addListener(fake);
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      EWE.subscriptions.onRemoved.addListener(fake);
      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);
      EWE.subscriptions.onRemoved.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      );
    });

    it("syncs subscriptions", async function()
    {
      setMinTimeout(this, 5000);

      let previousDownload = 0;
      let syncedOne = false;
      let syncedAll = false;

      EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      await new Promise((resolve, reject) =>
      {
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
              EWE.subscriptions.sync(VALID_SUBSCRIPTION_URL);
            }
            else if (!syncedAll)
            {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              EWE.subscriptions.sync();
            }
            else
            {
              EWE.subscriptions.onChanged.removeListener(onChanged);
              resolve();
            }
          }
          catch (err)
          {
            EWE.subscriptions.onChanged.removeListener(onChanged);
            reject(err);
          }
        }

        EWE.subscriptions.onChanged.addListener(onChanged);
      });
    });
  });

  describe("Filters", () =>
  {
    it("adds a filter", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);

      let filters = EWE.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("does not add an invalid filter", () =>
    {
      expect(() => EWE.filters.add(INVALID_FILTER_TEXT)).toThrowError(
        JSON.stringify({
          type: "invalid_filter",
          reason: "filter_invalid_rewrite",
          option: null
        })
      );
    });

    it("adds multiple filters", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.add("another-filter");

      let filters = EWE.filters.getAll();
      expect(filters).toEqual([
        VALID_FILTER,
        {...VALID_FILTER, text: "another-filter"}
      ]);
    });

    it("disable an existing filter", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.disable(VALID_FILTER_TEXT);

      let filters = EWE.filters.getAll();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);
    });

    it("enables an existing filter", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.disable(VALID_FILTER_TEXT);
      EWE.filters.enable(VALID_FILTER_TEXT);

      let filters = EWE.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("enables a filter that is already enabled.", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.enable(VALID_FILTER_TEXT);

      let filters = EWE.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("removes a filter", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.remove(VALID_FILTER_TEXT);

      expect(EWE.filters.getAll()).toEqual([]);
    });

    it("normalizes a filter internally", () =>
    {
      EWE.filters.add(VALID_FILTER_TEXT);

      let PADDED_FILTER_TEXT = " " + VALID_FILTER_TEXT;
      EWE.filters.add(PADDED_FILTER_TEXT);
      expect(EWE.filters.getAll()).toEqual([VALID_FILTER]);

      EWE.filters.disable(PADDED_FILTER_TEXT);
      let filters = EWE.filters.getAll();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);

      EWE.filters.enable(PADDED_FILTER_TEXT);
      expect(EWE.filters.getAll()).toEqual([VALID_FILTER]);

      EWE.filters.remove(PADDED_FILTER_TEXT);
      expect(EWE.filters.getAll()).toEqual([]);
    });

    it("validates a valid filter", () =>
    {
      expect(EWE.filters.validate(VALID_FILTER_TEXT)).toBeNull();
    });

    it("validates a filter with unknown option", () =>
    {
      let props = {
        type: "invalid_filter",
        reason: "filter_unknown_option",
        option: "foo"
      };

      let error = EWE.filters.validate("@@||example.com^$foo");
      expect(error).toEqual(expect.objectContaining(props));
      expect(error.toString()).toEqual(`FilterError: ${JSON.stringify(props)}`);
    });

    it("validates a filter with an invalid domain", () =>
    {
      let props = {
        type: "invalid_domain",
        reason: "http://foo",
        option: null
      };

      let error = EWE.filters.validate("/image.png$domain=http://foo");
      expect(error).toEqual(expect.objectContaining(props));
      expect(error.toString()).toEqual(`FilterError: ${JSON.stringify(props)}`);
    });

    it("produces the correct slow state for a URL filter", () =>
    {
      EWE.filters.add("example##.site-panel");

      expect(EWE.filters.getAll()).toEqual([
        expect.objectContaining({slow: false})
      ]);
    });

    it("has a selector property", () =>
    {
      EWE.filters.add("example##.site-panel");

      expect(EWE.filters.getAll()).toEqual([
        expect.objectContaining({selector: ".site-panel"})
      ]);
    });

    it("has a csp property", () =>
    {
      EWE.filters.add("*$csp=img-src 'none'");

      expect(EWE.filters.getAll()).toEqual([
        expect.objectContaining({csp: "img-src 'none'"})
      ]);
    });

    it("listens to onAdded events", () =>
    {
      let fake = sinon.fake();

      EWE.filters.onAdded.addListener(fake);
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.onAdded.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", () =>
    {
      let fake = sinon.fake();

      EWE.filters.onChanged.addListener(fake);
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.disable(VALID_FILTER_TEXT);
      EWE.filters.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      EWE.filters.onRemoved.addListener(fake);
      EWE.filters.add(VALID_FILTER_TEXT);
      EWE.filters.remove(VALID_FILTER_TEXT);
      EWE.filters.onRemoved.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    describe("Allowlisting", () =>
    {
      const ALLOWING_IMAGE_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/image.html^$document`;

      it("returns filters for allowlisted tabs", async() =>
      {
        EWE.filters.add(`|${TEST_PAGES_URL}/image.png^`);
        EWE.filters.add(ALLOWING_IMAGE_DOC_FILTER);

        let tabId = await new Page("image.html").loaded();
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual(
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
        EWE.filters.add(ALLOWING_IMAGE_DOC_FILTER);

        let {tabId, frameId} = await loadTabWithFrame();
        expect(EWE.filters.getAllowingFilters(tabId, {frameId})).toEqual(
          [ALLOWING_IMAGE_DOC_FILTER]);
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual([]);

        EWE.filters.add(`@@|${TEST_PAGES_URL}/iframe.html^$document`);

        ({tabId, frameId} = await loadTabWithFrame());

        const ALLOWING_IFRAME_DOC_FILTER =
          `@@|${TEST_PAGES_URL}/iframe.html^$document`;

        expect(EWE.filters.getAllowingFilters(tabId, {frameId})).toEqual([
          ALLOWING_IFRAME_DOC_FILTER, ALLOWING_IMAGE_DOC_FILTER]);
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual([
          ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns element-hiding filters for allowlisted tabs", async() =>
      {
        let filter = `@@|${TEST_PAGES_URL}/*.html$elemhide`;

        EWE.filters.add(`|${TEST_PAGES_URL}/image.png^`);
        EWE.filters.add(ALLOWING_IMAGE_DOC_FILTER);
        EWE.filters.add(filter);

        let tabId = await new Page("image.html").loaded();
        let opts = {types: ["elemhide"]};
        expect(EWE.filters.getAllowingFilters(tabId, opts)).toEqual([filter]);
      });

      it("doesn't return filters for non-allowlisted tabs", async() =>
      {
        let tabId = await new Page("image.html").loaded();
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual([]);
      });

      it("doesn't return filters for non-allowlisted frames", async() =>
      {
        let {tabId, frameId} = await loadTabWithFrame();
        expect(EWE.filters.getAllowingFilters(tabId, {frameId})).toEqual([]);
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual([]);
      });

      it("handles empty tabs", async() =>
      {
        let tabId = await new Page("about:blank", true).loaded();
        expect(EWE.filters.getAllowingFilters(tabId)).toEqual([]);
      });
    });
  });

  describe("Initialization", () =>
  {
    let background;

    before(async() =>
    {
      background = await browser.runtime.getBackgroundPage();
    });

    after(() =>
    {
      delete background.uiLanguageOverride;
    });

    for (let [language, subscriptionUrl] of [
      ["en", "https://easylist-downloads.adblockplus.org/easylist.txt"],
      ["de", "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"]
    ])
    {
      it(`configures default subscriptions for ${language}`, async() =>
      {
        background.uiLanguageOverride = language;

        await EWE.start();

        let subscriptions = EWE.subscriptions.getDownloadable();
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
      let firstRun = EWE.start();
      EWE.stop();
      expect(await firstRun).toBeNull();

      expect(await EWE.start()).toEqual(
        {storageFirstRun: true, subscriptionsFirstRun: true});

      EWE.stop();
      expect(await EWE.start()).toEqual(
        {storageFirstRun: true, subscriptionsFirstRun: false});
    });
  });

  describe("Reporting", () =>
  {
    describe("Analytics", () =>
    {
      it("gets the first version", async() =>
      {
        let today = new Date().toISOString().substring(0, 10).replace(/-/g, "");

        await wait(() => EWE.reporting.getFirstVersion() != "0", 1000,
                   "No resource has been downloaded yet.");
        expect(EWE.reporting.getFirstVersion()).toBe(today);
      });
    });

    describe("Diagnostics", () =>
    {
      async function checkLogging(filter, callback, info = {},
                                  checkUrl = true)
      {
        let fake = sinon.fake();

        EWE.reporting.onFilterMatch.addListener(fake);
        EWE.filters.add(filter.text);

        try
        {
          await callback();
        }
        finally
        {
          EWE.reporting.onFilterMatch.removeListener(fake);
          EWE.filters.remove(filter.text);
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
        });
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
        EWE.filters.add("/image.png^$image");
        await checkRequestLogging("image.html", {
          text: "@@$image",
          type: "allowing"
        }, {docDomain: "localhost", specificOnly: false});
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
                                  {text: "*$header=x-header=whatever"});
      });

      it("logs allowlisting $header filter", async() =>
      {
        EWE.filters.add("*$header=x-header=whatever");
        await checkRequestLogging("header.html", {text: "@@$header"});
      });

      it("logs blocking $csp filter", async() =>
      {
        await checkRequestLogging("csp.html", {text: "*$csp=img-src 'none'"});
      });

      it("logs allowlisting $csp filter", async() =>
      {
        EWE.filters.add("*$csp=img-src 'none'");
        await checkRequestLogging("csp.html", {text: "@@$csp"});
      });

      for (let option of ["$document", "$elemhide",
                          "$genericblock", "$generichide"])
      {
        it(`logs allowlisting ${option} filter`, () =>
          checkRequestLogging("image.html", {text: `@@${option}`})
        );
      }

      it("logs element hiding filter", async() =>
      {
        await checkLogging({text: "###elem-hide"}, async() =>
        {
          let tabId = await new Page("element-hiding.html").loaded();
          await waitForInvisibleElement(tabId, "elem-hide");
        });
      });

      it("logs snippets filter", () =>
        checkLogging({text: `${TEST_PAGES_DOMAIN}#$#do`},
                     () => new Page("image.html").loaded(),
                     {}, false)
      );

      function checkPopupLogging(text)
      {
        return checkLogging({text}, () =>
          new Popup("link", new Page("popup-opener.html")).blocked
        );
      }

      it("logs blocking popup filter", async() =>
      {
        await checkPopupLogging("*popup.html^$popup");
      });

      it("logs allowlisting popup filter", async() =>
      {
        EWE.filters.add("*popup.html^$popup");
        await checkPopupLogging("@@$popup");
      });
    });

    describe("Notifications", () =>
    {
      it("supports notifications", () =>
      {
        let notification = {id: "test"};
        let fake = sinon.fake();

        EWE.notifications.addNotification(notification);
        EWE.notifications.addShowListener(fake);
        EWE.notifications.showNext();
        EWE.notifications.removeShowListener(fake);
        EWE.notifications.removeNotification(notification);

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
      EWE.debugging.setElementHidingDebugMode(true);
      EWE.filters.add("###elem-hide");

      let tabId = await new Page("element-hiding.html").loaded();
      let code = `window.getComputedStyle(
        document.getElementById('elem-hide'))['background-color']`;

      let style;
      await wait(async() =>
      {
        style = (await browser.tabs.executeScript(tabId, {code}))[0];
        return style != "rgba(0, 0, 0, 0)";
      }, 500);

      EWE.debugging.setElementHidingDebugMode(false);
      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async() =>
    {
      EWE.debugging.setElementHidingDebugMode(true);
      EWE.debugging.setElementHidingDebugMode(false);

      EWE.filters.add("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      expect(style).toBe("rgba(0, 0, 0, 0)");
    });

    it("highlights an element with a custom style", async() =>
    {
      EWE.debugging.setElementHidingDebugMode(true);
      EWE.debugging.setElementHidingDebugStyle([["background", "pink"]]);
      EWE.filters.add("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      EWE.debugging.setElementHidingDebugMode(false);
      expect(style).toBe("rgb(255, 192, 203)");
    });
  });
});
