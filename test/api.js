/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Page, Popup, setMinTimeout, waitForInvisibleElement,
        waitForSnippetBlocked, wait, TEST_PAGES_URL,
        TEST_PAGES_DOMAIN} from "./utils.js";

const VALID_SUBSCRIPTION_URL = "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt";
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_FILTER_TEXT = "$image";
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: true,
  type: "blocking",
  thirdParty: null
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
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getDownloadable();
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

      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL, {title, homepage});

      let subscriptions = ABP.subscriptions.getDownloadable();
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
      expect(() => ABP.subscriptions.add(INVALID_SUBSCRIPTION_URL))
        .toThrowError("Invalid subscription URL");
    });

    it("adds multiple subscriptions", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL + "?2");

      let subscriptions = ABP.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("gets subscriptions for a filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);

      expect(ABP.subscriptions.getForFilter(VALID_FILTER_TEXT)).toEqual([
        expect.objectContaining({downloadable: false})
      ]);
    });

    it("gets filters from a subscription", async() =>
    {
      expect(ABP.subscriptions.getFilters(VALID_SUBSCRIPTION_URL)).toEqual([]);

      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let filters;
      await wait(() =>
      {
        filters = ABP.subscriptions.getFilters(VALID_SUBSCRIPTION_URL);
        return filters.length > 0;
      }, 4000);

      expect(filters).toEqual(expect.arrayContaining([expect.objectContaining(
        {text: "||testpages.adblockplus.org/testfiles/image/static/$image"}
      )]));
    });

    it("checks if a subscription has been added", () =>
    {
      expect(ABP.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBeFalsy();
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      expect(ABP.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBeTruthy();
    });

    it("disables an existing subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("enables a subscription that is already enabled.", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getDownloadable();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("fails enabling/disabling a nonexistent subscription", () =>
    {
      expect(
        () => ABP.subscriptions.enable("DoesNotExist")
      ).toThrowError("Subscription does not exist");

      expect(
        () => ABP.subscriptions.disable("DoesNotExist")
      ).toThrowError("Subscription does not exist");
    });

    it("removes a subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.remove(VALID_SUBSCRIPTION_URL);

      expect(ABP.subscriptions.getDownloadable()).toEqual([]);
    });

    it("gets recommendations", () =>
    {
      let recommendations = ABP.subscriptions.getRecommendations();

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

      ABP.subscriptions.onAdded.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onAdded.removeListener(fake);

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

      ABP.subscriptions.onChanged.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      ABP.subscriptions.onRemoved.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.remove(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onRemoved.removeListener(fake);

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

      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);

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
              ABP.subscriptions.sync(VALID_SUBSCRIPTION_URL);
            }
            else if (!syncedAll)
            {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              ABP.subscriptions.sync();
            }
            else
            {
              ABP.subscriptions.onChanged.removeListener(onChanged);
              resolve();
            }
          }
          catch (err)
          {
            ABP.subscriptions.onChanged.removeListener(onChanged);
            reject(err);
          }
        }

        ABP.subscriptions.onChanged.addListener(onChanged);
      });
    });
  });

  describe("Filters", () =>
  {
    it("adds a filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("does not add an invalid filter", () =>
    {
      expect(() => ABP.filters.add(INVALID_FILTER_TEXT)).toThrowError(
        JSON.stringify({
          type: "invalid_filter",
          reason: "filter_invalid_rewrite",
          option: null
        })
      );
    });

    it("adds multiple filters", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.add("another-filter");

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([
        VALID_FILTER,
        {...VALID_FILTER, text: "another-filter"}
      ]);
    });

    it("disable an existing filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);
    });

    it("enables an existing filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);
      ABP.filters.enable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("enables a filter that is already enabled.", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.enable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("removes a filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.remove(VALID_FILTER_TEXT);

      expect(ABP.filters.getAll()).toEqual([]);
    });

    it("validates a valid filter", () =>
    {
      expect(ABP.filters.validate(VALID_FILTER_TEXT)).toBeNull();
    });

    it("validates a filter with unknown option", () =>
    {
      let props = {
        type: "invalid_filter",
        reason: "filter_unknown_option",
        option: "foo"
      };

      let error = ABP.filters.validate("@@||example.com^$foo");
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

      let error = ABP.filters.validate("/image.png$domain=http://foo");
      expect(error).toEqual(expect.objectContaining(props));
      expect(error.toString()).toEqual(`FilterError: ${JSON.stringify(props)}`);
    });

    it("produces the correct slow state for a URL filter", () =>
    {
      ABP.filters.add("example##.site-panel");

      expect(ABP.filters.getAll()).toEqual([
        expect.objectContaining({slow: false})
      ]);
    });

    it("listens to onAdded events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onAdded.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.onAdded.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onChanged.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);
      ABP.filters.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onRemoved.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.remove(VALID_FILTER_TEXT);
      ABP.filters.onRemoved.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
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

        await ABP.start();

        let subscriptions = ABP.subscriptions.getDownloadable();
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
  });

  describe("Reporting", () =>
  {
    it("exposes content types", () =>
    {
      expect(ABP.reporting.contentTypes).toEqual(expect.objectContaining({
        OTHER: expect.any(Number)
      }));
    });

    describe("Analytics", () =>
    {
      it("gets the first version", async() =>
      {
        let today = new Date().toISOString().substring(0, 10).replace(/-/g, "");

        await wait(() => ABP.reporting.getFirstVersion() != "0", 1000,
                   "No resource has been downloaded yet.");
        expect(ABP.reporting.getFirstVersion()).toBe(today);
      });
    });

    describe("Allowlisting", () =>
    {
      it("detects allowlisted tabs", async() =>
      {
        ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
        ABP.filters.add(`@@|${TEST_PAGES_URL}/image.html^$document`);

        let tabId = await new Page("image.html").loaded();
        expect(ABP.reporting.isAllowlisted(tabId)).toBeTruthy();
      });

      it("detects non-allowlisted tabs", async() =>
      {
        let tabId = await new Page("image.html").loaded();
        expect(ABP.reporting.isAllowlisted(tabId)).toBeFalsy();
      });
    });

    describe("Diagnostics", () =>
    {
      async function checkLogging(filter, callback, info = {})
      {
        let fake = sinon.fake();

        ABP.reporting.onFilterMatch.addListener(fake);
        ABP.filters.add(filter.text);

        try
        {
          await callback();
        }
        finally
        {
          ABP.reporting.onFilterMatch.removeListener(fake);
        }

        expect(fake.called).toBeTruthy();
        expect(fake.firstArg).toEqual({
          details: expect.any(Object),
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
        ABP.filters.add("/image.png^$image");
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
        ABP.filters.add("*$header=x-header=whatever");
        await checkRequestLogging("header.html", {text: "@@$header"});
      });

      it("logs blocking $csp filter", async() =>
      {
        await checkRequestLogging("csp.html", {text: "*$csp=img-src 'none'"});
      });

      it("logs allowlisting $csp filter", async() =>
      {
        ABP.filters.add("*$csp=img-src 'none'");
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
        ABP.filters.add("*popup.html^$popup");
        await checkPopupLogging("@@$popup");
      });
    });

    describe("Notifications", () =>
    {
      it("supports notifications", () =>
      {
        let notification = {id: "test"};
        let fake = sinon.fake();

        ABP.notifications.addNotification(notification);
        ABP.notifications.addShowListener(fake);
        ABP.notifications.showNext();
        ABP.notifications.removeShowListener(fake);
        ABP.notifications.removeNotification(notification);

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
      ABP.debugging.setElementHidingDebugMode(true);
      ABP.filters.add("###elem-hide");

      let tabId = await new Page("element-hiding.html").loaded();
      let code = `window.getComputedStyle(
        document.getElementById('elem-hide'))['background-color']`;

      let style;
      await wait(async() =>
      {
        style = (await browser.tabs.executeScript(tabId, {code}))[0];
        return style != "rgba(0, 0, 0, 0)";
      }, 100);

      ABP.debugging.setElementHidingDebugMode(false);
      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async() =>
    {
      ABP.debugging.setElementHidingDebugMode(true);
      ABP.debugging.setElementHidingDebugMode(false);

      ABP.filters.add("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      expect(style).toBe("rgba(0, 0, 0, 0)");
    });

    it("highlights an element with a custom style", async() =>
    {
      ABP.debugging.setElementHidingDebugMode(true);
      ABP.debugging.setElementHidingDebugStyle([["background", "pink"]]);
      ABP.filters.add("###elem-hide");
      let style = await getElementStyle("elem-hide", "background-color");
      ABP.debugging.setElementHidingDebugMode(false);
      expect(style).toBe("rgb(255, 192, 203)");
    });

    it("applies the debugging stylesheet for hiding element snippet", async() =>
    {
      let snippet = "hide-if-contains";
      ABP.filters.add(`${TEST_PAGES_DOMAIN}#$#${snippet} Target div`);

      ABP.debugging.setElementHidingDebugMode(true);
      let {tabId} = await waitForSnippetBlocked("snippets-hiding.html");
      ABP.debugging.setElementHidingDebugMode(false);

      let code = `let el = document.getElementById("hide-if-contains");
                  let styles = window.getComputedStyle(el);
                  styles["outline-color"]`;
      let color = (await browser.tabs.executeScript(tabId, {code}))[0];
      expect(color).toEqual("rgb(255, 0, 0)");
    });

    it("applies a custom debugging stylesheet for hiding element snippets",
       async() =>
       {
         let snippet = "hide-if-contains";
         ABP.filters.add(`${TEST_PAGES_DOMAIN}#$#${snippet} Target div`);

         ABP.debugging.setElementHidingDebugMode(true);
         ABP.debugging.setElementHidingDebugStyle(null,
                                                  [["background-color", "pink"]]
         );
         let {tabId} = await waitForSnippetBlocked("snippets-hiding.html");
         ABP.debugging.setElementHidingDebugMode(false);

         let code = `let el = document.getElementById("hide-if-contains");
                  let styles = window.getComputedStyle(el);
                  styles["background-color"]`;
         let color = (await browser.tabs.executeScript(tabId, {code}))[0];
         expect(color).toEqual("rgb(255, 192, 203)");
       });
  });
});
