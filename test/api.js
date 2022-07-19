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

import {Page, Popup, setMinTimeout, wait, executeScript, isFirefox, isEdge,
        getVisibleElement, isMV3, TEST_PAGES_URL,
        TEST_PAGES_DOMAIN, CROSS_DOMAIN_URL, CROSS_DOMAIN,
        isCustomSubsExtension} from "./utils.js";
import {addFilter, EWE, runInBackgroundPage, addFakeListener,
        removeFakeListeners, setTestSnippets}
  from "./messaging.js";

const VALID_SUBSCRIPTION_URL = `${TEST_PAGES_URL}/subscription.txt`;
const ANOTHER_VALID_SUBSCRIPTION_URL =
  `${TEST_PAGES_URL}/subscription-empty.txt`;
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
const COMMENT_FILTER_TEXT = "!comment";
const SECOND_VALID_FILTER_TEXT = "another-filter";
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: false,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};
const SECOND_VALID_FILTER = {
  text: SECOND_VALID_FILTER_TEXT,
  enabled: true,
  slow: true,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};
const COMMENT_FILTER = {
  text: COMMENT_FILTER_TEXT,
  enabled: null,
  slow: false,
  type: "comment",
  thirdParty: null,
  selector: null,
  csp: null
};
const INVALID_FILTER_TEXT = "/foo/$rewrite=";
const ADDON_NAME = "foo";
const ADDON_VERSION = "2.1";

describe("API", function() {
  describe("Subscriptions", function() {
    before(function() {
      if (isMV3())
        this.skip();
    });

    it("adds a subscription", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let subs = await EWE.subscriptions.getDownloadable();
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL,
        homepage: null,
        downloadable: true
      })]);
    });

    it("adds a subscription with properties", async function() {
      let title = "testTitle";
      let homepage = "testHomePage";

      await EWE.subscriptions.add(
        VALID_SUBSCRIPTION_URL, {title, homepage});

      let subs = await EWE.subscriptions.getDownloadable();
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title,
        homepage,
        downloadable: true
      })]);
    });

    it("does not add an invalid subscription", function() {
      expect(EWE.subscriptions.add(INVALID_SUBSCRIPTION_URL))
        .rejects.toThrow("Error: Invalid subscription URL provided: invalidUrl");
    });

    it("adds multiple subscriptions", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL + "?2");

      let subs = await EWE.subscriptions.getDownloadable();
      expect(subs).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("gets subscriptions for a filter", async function() {
      await addFilter(VALID_FILTER_TEXT);
      expect(await EWE.subscriptions.getForFilter(VALID_FILTER_TEXT)).toEqual([
        expect.objectContaining({downloadable: false})
      ]);
    });

    it("gets filters from a subscription", async function() {
      expect(await EWE.subscriptions.getFilters(
        VALID_SUBSCRIPTION_URL)).toEqual([]);

      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let result;
      await wait(async() => {
        result = await EWE.subscriptions.getFilters(VALID_SUBSCRIPTION_URL);
        return result.length > 0;
      }, 4000);

      expect(result).toEqual(expect.arrayContaining([expect.objectContaining(
        {text: "/image.png^$image"}
      )]));
    });

    it("checks if a subscription has been added", async function() {
      expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(false);

      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      expect(await EWE.subscriptions.has(VALID_SUBSCRIPTION_URL)).toBe(true);
    });

    it("disables an existing subscription", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);

      let subs = await EWE.subscriptions.getDownloadable();
      expect(subs).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", async function() {
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

    it("removes a subscription", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);

      expect(await EWE.subscriptions.getDownloadable())
        .toEqual([]);
    });

    it("gets adblockpluscore recommendations", async function() {
      if (isCustomSubsExtension())
        this.skip();

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

    it("gets custom recommendations", async function() {
      if (!isCustomSubsExtension())
        this.skip();

      let result = await EWE.subscriptions.getRecommendations();

      // keep in-sync with `test/custom-subscriptions.json`
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({
          languages: ["test"],
          title: "TestSubscription",
          type: "test",
          url: "TestUrl"
        })
      ]));
    });

    it("listens to onAdded events", async function() {
      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onAdded"});
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL
      }));
    });

    it("listens to onChanged events", async function() {
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onChanged"});
      await EWE.subscriptions.disable(VALID_SUBSCRIPTION_URL);

      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
      expect(fake.lastArg).toEqual("enabled");
    });

    it("listens to onRemoved events", async function() {
      let fake = await addFakeListener({namespace: "subscriptions",
                                        eventName: "onRemoved"});
      await EWE.subscriptions.add(VALID_SUBSCRIPTION_URL);
      await EWE.subscriptions.remove(VALID_SUBSCRIPTION_URL);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      );
    });

    it("syncs subscriptions", async function() {
      setMinTimeout(this, 3000);

      await new Promise((resolve, reject) => {
        let previousDownload = 0;
        let syncedOne = false;
        let syncedAll = false;
        let sawGeneric = false;
        let sawDownloading = false;

        async function onChanged(subscription, property) {
          try {
            if (subscription.url != ANOTHER_VALID_SUBSCRIPTION_URL)
              return;

            if (property == "downloading") {
              expect(subscription.downloading).toEqual(true);
              sawDownloading = true;
              return;
            }

            if (property == null) {
              sawGeneric = true;
              return;
            }

            if (property != "lastDownload")
              return;

            expect(subscription.lastDownload).toBeGreaterThan(previousDownload);
            previousDownload = subscription.lastDownload;

            if (!syncedOne) {
              syncedOne = true;
              await new Promise(elapsed => setTimeout(elapsed, 1050));
              await EWE.subscriptions.sync(ANOTHER_VALID_SUBSCRIPTION_URL);
            }
            else if (!syncedAll) {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1050));
              await EWE.subscriptions.sync();
            }
            else {
              expect(sawDownloading).toEqual(true);
              expect(sawGeneric).toEqual(true);
              resolve();
            }
          }
          catch (err) {
            reject(err);
          }
        }

        addFakeListener({namespace: "subscriptions",
                         eventName: "onChanged",
                         callback: onChanged})
          .then(() => EWE.subscriptions.add(ANOTHER_VALID_SUBSCRIPTION_URL))
          .catch(reject);
      });
    });
  });

  describe("Filters", function() {
    it("adds a single filter", async function() {
      await addFilter(VALID_FILTER_TEXT);
      expect(await EWE.filters.getUserFilters())
        .toEqual([VALID_FILTER]);
    });

    it("adds multiple filters", async function() {
      await EWE.filters.add([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters()).toEqual([
        VALID_FILTER,
        {...SECOND_VALID_FILTER}
      ]);
    });

    it("adds comment filter", async function() {
      await EWE.filters.add([COMMENT_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters()).toEqual([COMMENT_FILTER]);
    });

    describe("Filters metadata", function() {
      const filterText = VALID_FILTER_TEXT;

      async function assertAddMetadata(metadata) {
        await EWE.filters.add([filterText], metadata);
        expect(await EWE.filters.getMetadata(filterText)).toEqual(metadata);
      }

      it("adds empty", async function() {
        await assertAddMetadata({});
      });

      it("adds a number", async function() {
        await assertAddMetadata({created: 123});
      });

      it("adds a string", async function() {
        await assertAddMetadata({owner: "owner"});
      });

      it("adds a bool", async function() {
        await assertAddMetadata({user_data: true});
      });

      it("adds for multiple filters", async function() {
        let filters = [
          VALID_FILTER_TEXT,
          SECOND_VALID_FILTER_TEXT
        ];
        let metadata = {created: 123};
        await EWE.filters.add(filters, metadata);
        for (let filter of filters)
          expect(await EWE.filters.getMetadata(filter)).toEqual(metadata);
      });

      it("skips adding same metadata for the filter in array", async function() {
        let filters = [
          filterText,
          filterText // to be skipped
        ];
        let metadata = {created: 123};
        await EWE.filters.add(filters, metadata);
        expect(await EWE.filters.getMetadata(filterText)).toEqual(metadata);
      });

      it("throws if adding same metadata for the filter", async function() {
        let filters = [filterText];
        let metadata = {created: 123};
        await EWE.filters.add(filters, metadata);
        await expect(EWE.filters.add(filters, metadata))
          .rejects.toThrow("FilterError");
      });

      it("throws if adding different metadata for the filter", async function() {
        let filters = [filterText];
        let metadata1 = {created: 123};
        let metadata2 = {owner: "user"};
        await EWE.filters.add(filters, metadata1);
        await expect(EWE.filters.add(filters, metadata2))
          .rejects.toThrow("FilterError");
      });

      it("throws if setting metadata for not added filter", async function() {
        let metadata = {created: 123};
        await expect(EWE.filters.setMetadata("not_added_filter", metadata))
          .rejects.toThrow("FilterError");
      });

      it("updates metadata for added filter with metadata", async function() {
        let filters = [filterText];
        let metadata1 = {created: 123};
        await EWE.filters.add(filters, metadata1);
        // filter must be added with metadata originally to update the metadata
        // due to "adblockpluscore" implementation details.
        expect(await EWE.filters.getMetadata(filterText)).toEqual(metadata1);
        let metadata2 = {created: 456};
        await EWE.filters.setMetadata(filterText, metadata2);
        await expect(await EWE.filters.getMetadata(filterText))
          .toEqual(metadata2);
      });

      it("updates metadata for added filter without metadata", async function() {
        let filters = [filterText];
        let metadata = {created: 123};
        await EWE.filters.add(filters);
        await EWE.filters.setMetadata(filterText, metadata);
        await expect(await EWE.filters.getMetadata(filterText))
          .toEqual(metadata);
      });

      it("throws if adding with metadata for added wo metadata", async function() {
        let filters = [filterText];
        let metadata = {created: 123};
        await EWE.filters.add(filters);
        await expect(EWE.filters.add(filters, metadata))
          .rejects.toThrow("FilterError");
      });
    });

    it("does not add invalid filters", async function() {
      return expect(addFilter(INVALID_FILTER_TEXT)).rejects.toThrow("FilterError");
    });

    it("disables existing filters", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await addFilter(SECOND_VALID_FILTER_TEXT);

      await EWE.filters.disable([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);

      expect(await EWE.filters.getUserFilters())
        .toEqual([{...VALID_FILTER, enabled: false},
                  {...SECOND_VALID_FILTER, enabled: false}]);
    });

    it("enables existing filters", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await addFilter(SECOND_VALID_FILTER_TEXT);

      await EWE.filters.disable([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);
      await EWE.filters.enable([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);

      expect(await EWE.filters.getUserFilters())
        .toEqual([VALID_FILTER, SECOND_VALID_FILTER]);
    });

    it("enables a filter that is already enabled", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.enable([VALID_FILTER_TEXT]);

      expect(await EWE.filters.getUserFilters())
        .toEqual([VALID_FILTER]);
    });

    it("does not enable nor add an unexisting filter", async function() {
      await EWE.filters.enable([VALID_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters()).toEqual([]);
    });

    it("removes a single filter", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.remove([VALID_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters()).toEqual([]);
    });

    it("normalizes a filter internally", async function() {
      await addFilter(VALID_FILTER_TEXT);

      let PADDED_FILTER_TEXT = " " + VALID_FILTER_TEXT;
      await expect(addFilter(PADDED_FILTER_TEXT))
        .rejects.toThrow("FilterError");

      expect(await EWE.filters.getUserFilters())
        .toEqual([VALID_FILTER]);

      await EWE.filters.disable([PADDED_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters())
        .toEqual([{...VALID_FILTER, enabled: false}]);

      await EWE.filters.enable([PADDED_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters())
        .toEqual([VALID_FILTER]);

      await EWE.filters.remove([PADDED_FILTER_TEXT]);
      expect(await EWE.filters.getUserFilters()).toEqual([]);
    });

    it("validates a valid filter", async function() {
      expect(await EWE.filters.validate(VALID_FILTER_TEXT))
        .toBeNull();
    });

    it("validates a filter with unknown option", async function() {
      let result = await EWE.filters.validate("@@||example.com^$foo");
      expect(result).toEqual("FilterError: {\"type\":\"invalid_filter\"," +
                             "\"reason\":\"filter_unknown_option\"," +
                             "\"option\":\"foo\"}");
    });

    it("validates a filter with an invalid domain", async function() {
      let result = await EWE.filters.validate("/image.png$domain=http://foo");
      // eslint-disable-next-line max-len
      expect(result).toEqual("FilterError: {\"type\":\"invalid_domain\",\"reason\":\"http://foo\",\"option\":null}");
    });

    it("produces the correct slow state for a URL filter", async function() {
      await addFilter("example##.site-panel");

      expect(await EWE.filters.getUserFilters()).toEqual([
        expect.objectContaining({slow: false})
      ]);
    });

    it("has a selector property", async function() {
      await addFilter("example##.site-panel");

      expect(await EWE.filters.getUserFilters()).toEqual([
        expect.objectContaining({selector: ".site-panel"})
      ]);
    });

    it("has a csp property", async function() {
      await addFilter(`|${TEST_PAGES_URL}$csp=img-src 'none'`);

      expect(await EWE.filters.getUserFilters()).toEqual([
        expect.objectContaining({csp: "img-src 'none'"})
      ]);
    });

    it("listens to onAdded events", async function() {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onAdded"});
      await addFilter(VALID_FILTER_TEXT);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", async function() {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onChanged"});
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.disable([VALID_FILTER_TEXT]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
      expect(fake.lastArg).toEqual("enabled");

      // This is a workaround and should be removed once https://gitlab.com/eyeo/webext/webext-sdk/-/issues/122 is fixed.
      await EWE.filters.enable([VALID_FILTER_TEXT]);
    });

    it("listens to onRemoved events", async function() {
      let fake = await addFakeListener({namespace: "filters",
                                        eventName: "onRemoved"});
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.remove([VALID_FILTER_TEXT]);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    describe("Allowlisting", function() {
      const ALLOWING_IMAGE_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/image.html^$document`;
      const ALLOWING_IFRAME_DOC_FILTER =
        `@@|${TEST_PAGES_URL}/iframe.html^$document`;

      it("returns filters for allowlisted tabs", async function() {
        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let tabId = await new Page("image.html").loaded;
        expect(await EWE.filters.getAllowingFilters(tabId))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
      });

      it("returns filters for allowlisted tabs after page load", async function() {
        let tabId = await new Page("image.html").loaded;

        await addFilter(`|${TEST_PAGES_URL}/image.png^`);
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);
        expect(await EWE.filters.getAllowingFilters(tabId))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
      });

      async function loadTabWithFrame(path = "iframe.html") {
        let tabId = await new Page(path).loaded;
        let frames = await browser.webNavigation.getAllFrames({tabId});
        let {frameId} = frames.find(({url}) => url.endsWith("/image.html"));
        return {tabId, frameId};
      }

      it("returns filters for allowlisted frames", async function() {
        await addFilter(ALLOWING_IMAGE_DOC_FILTER);

        let {tabId, frameId} = await loadTabWithFrame();
        expect(await EWE.filters.getAllowingFilters(tabId, {frameId}))
          .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
        expect(await EWE.filters.getAllowingFilters([tabId]))
          .toEqual([]);

        await addFilter(ALLOWING_IFRAME_DOC_FILTER);

        ({tabId, frameId} = await loadTabWithFrame());
        expect(await EWE.filters.getAllowingFilters(tabId, {frameId}))
          .toEqual(expect.arrayContaining([ALLOWING_IMAGE_DOC_FILTER,
                                           ALLOWING_IFRAME_DOC_FILTER]));
        expect(await EWE.filters.getAllowingFilters(tabId))
          .toEqual([ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns filters for allowlisted parent frames", async function() {
        let {tabId, frameId} = await loadTabWithFrame();

        await addFilter(ALLOWING_IFRAME_DOC_FILTER);
        expect(await EWE.filters.getAllowingFilters(tabId, {frameId}))
          .toEqual([ALLOWING_IFRAME_DOC_FILTER]);
      });

      it("returns element-hiding filters for allowlisted tabs", async function() {
        let filter = `@@|${TEST_PAGES_URL}/*.html$elemhide`;

        await addFilter(ALLOWING_IMAGE_DOC_FILTER);
        await addFilter(filter);

        let tabId = await new Page("image.html").loaded;
        let opts = {types: ["elemhide"]};
        expect(await EWE.filters.getAllowingFilters(tabId, opts))
          .toEqual([filter]);
      });

      it("doesn't return filters for non-allowlisted tabs", async function() {
        let tabId = await new Page("image.html").loaded;
        expect(await EWE.filters.getAllowingFilters(tabId))
          .toEqual([]);
      });

      it("doesn't return filters for non-allowlisted frames", async function() {
        let {tabId, frameId} = await loadTabWithFrame();
        expect(await EWE.filters.getAllowingFilters(
          tabId, {frameId})).toEqual([]);
        expect(await EWE.filters.getAllowingFilters([tabId]))
          .toEqual([]);
      });

      it("handles empty tabs", async function() {
        let tabId = await new Page("about:blank", true).loaded;
        expect(await EWE.filters.getAllowingFilters(tabId))
          .toEqual([]);
      });

      it("returns whether a resource is allowlisted", async function() {
        await addFilter("@@*$image");

        let tabId = await new Page("image.html").loaded;
        expect(await EWE.filters.isResourceAllowlisted(
          `${TEST_PAGES_URL}/image.png`, "image", tabId)).toEqual(true);
      });

      it("returns whether a frame resource is allowlisted", async function() {
        await addFilter(`@@||${TEST_PAGES_DOMAIN}^$document`);

        let {tabId, frameId} = await loadTabWithFrame();
        let url = `${TEST_PAGES_URL}/image.html`;

        expect(await EWE.filters.isResourceAllowlisted(
          url, "document", tabId)).toEqual(true);
        expect(await EWE.filters.isResourceAllowlisted(
          url, "document", tabId, frameId)).toEqual(true);
      });

      it("returns whether a cross domain resource is allowlisted", async function() {
        await addFilter(`@@*$image,domain=${CROSS_DOMAIN}`);

        let {tabId, frameId} =
          await loadTabWithFrame("iframe-cross-domain.html");
        let url = `${TEST_PAGES_URL}/image.png`;

        expect(await EWE.filters.isResourceAllowlisted(
          url, "image", tabId)).toEqual(false);
        expect(await EWE.filters.isResourceAllowlisted(
          url, "image", tabId, frameId)).toEqual(true);
      });

      it("returns whether a resource is allowlisted by $document", async function() {
        await addFilter(`@@|${TEST_PAGES_URL}/iframe.html^$document`);

        let {tabId, frameId} = await loadTabWithFrame();
        let url = `${TEST_PAGES_URL}/image.png`;

        expect(await EWE.filters.isResourceAllowlisted(
          url, "image", tabId)).toEqual(true);
        expect(await EWE.filters.isResourceAllowlisted(
          url, "image", tabId, frameId)).toEqual(true);
      });

      it("returns whether a resource is allowlisted by $elemhide", async function() {
        let url = `${TEST_PAGES_URL}/iframe-elemhide.html`;
        await addFilter(`@@|${url}^$elemhide`);

        let {tabId, frameId} = await loadTabWithFrame();

        expect(await EWE.filters.isResourceAllowlisted(
          url, "elemhide", tabId)).toEqual(true);
        expect(await EWE.filters.isResourceAllowlisted(
          url, "elemhide", tabId, frameId)).toEqual(true);
      });

      it("handles new tab allowlisting listener", async function() {
        let isNewTabAllowlisted = browser.runtime.sendMessage(
          {type: "ewe-test:isNewTabAllowlisted"});

        let pageUrl = isFirefox() ? "about:blank" :
                      isEdge() ? "edge://newtab/" : "chrome://newtab/";
        // On Chromium 77, "chrome://newtab/" status keeps stuck at "loading",
        // that's why Page is not awaited on `loaded` here.
        new Page(pageUrl, true);

        let {result, url, error} = await isNewTabAllowlisted;
        expect(error).toBeUndefined();
        expect(result).toEqual(false);
        expect(url).toBe(pageUrl);
      });
    });
  });

  describe("Filters limit", function() {
    before(function() {
      if (!isMV3())
        this.skip();
    });

    it("does not add more than 5000 dynamic filters", async function() {
      let fiveThousandAndOneFilters = Array.from(
        {length: 5001},
        (_, x) => (VALID_FILTER + "_" + x)
      );
      await expect(EWE.filters.add(fiveThousandAndOneFilters)).rejects.toThrow(
        "FilterError: {\"type\":\"too_many_filters\",\"option\":null}");
    });
  });

  describe("Initialization", function() {
    setMinTimeout(this, 3000);

    after(async function() {
      await browser.runtime.sendMessage(
        {type: "ewe-test:deleteUiLanguageOverride"});
    });

    for (let [language, subscriptionUrl] of [
      ["en", "https://easylist-downloads.adblockplus.org/easylist.txt"],
      ["de", "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"]
    ]) {
      it(`configures default subscriptions for ${language}`, async function() {
        if (isCustomSubsExtension())
          this.skip();

        setMinTimeout(this, 3000);

        await browser.runtime.sendMessage(
          {type: "ewe-test:setLanguageAndStart", args: [language]});

        let subs = await EWE.subscriptions.getDownloadable();
        let urls = [
          subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
          "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
        ];

        expect(subs).toEqual(expect.arrayContaining(urls.map(
          url => expect.objectContaining({url, enabled: true})
        )));

        for (let subscription of subs)
          expect(urls).toContain(subscription.url);
      });
    }

    it("informs when the filter engine runs for the first time", async function() {
      // This might work differently in MV3 with the service worker
      // starting / stopping, so this test currently fails.
      if (isMV3())
        this.skip();

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

    // This test is problematic in edge and oldest chromium.
    // see: https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/191
    it("ignores messages without a type property", async function() {
      this.skip();
      await expect(browser.runtime.sendMessage({a: "1"}))
        .resolves.not.toThrow();
    });

    it("starts with default addon info", async function() {
      let manifest = browser.runtime.getManifest();

      await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "callMethod", arg: "start"},
        {op: "await"}
      ]);

      let addonInfo = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "debugging"},
        {op: "getProp", arg: "addonInfo"}
      ]);

      expect(addonInfo).toEqual(
        expect.objectContaining({
          name: manifest.short_name || manifest.name,
          version: manifest.version
        })
      );
    });

    it(
      "starts with the addon info provided by the initial start call",
      async function() {
        await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "pushArg", arg: {name: ADDON_NAME, version: ADDON_VERSION}},
          {op: "callMethod", arg: "start"},
          {op: "await"}
        ]);

        let addonInfo = await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "debugging"},
          {op: "getProp", arg: "addonInfo"}
        ]);

        expect(addonInfo).toEqual(
          expect.objectContaining({name: ADDON_NAME, version: ADDON_VERSION})
        );
      }
    );
  });

  describe("Reporting", function() {
    let defaultEventOptions = {};
    let allowingEventOptions = {filterType: "allowing"};
    let elemhideEventOptions = {includeElementHiding: true};
    let unmatchedEventOptions = {includeUnmatched: true, filterType: "all"};
    let allEventOptions = {
      includeElementHiding: true,
      includeUnmatched: true,
      filterType: "all"
    };

    it("exposes a mapping between content types and ResourceTypes", async function() {
      let expected = {
        other: "other",
        script: "script",
        image: "image",
        stylesheet: "stylesheet",
        object: "object",
        subdocument: "subdocument",
        websocket: "websocket",
        webrtc: "webrtc",
        ping: "ping",
        xmlhttprequest: "xmlhttprequest",
        media: "media",
        font: "font",
        popup: "popup",
        csp: "csp",
        header: "header",
        document: "document",
        genericblock: "genericblock",
        elemhide: "elemhide",
        generichide: "generichide",
        background: "image",
        xbl: "other",
        dtd: "other",
        object_subrequest: "object",
        sub_frame: "subdocument",
        beacon: "ping",
        imageset: "image",
        main_frame: "document"
      };

      let result = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "reporting"},
        {op: "getProp", arg: "contentTypesMap"},
        {op: "stringifyMap"}
      ]);

      expect(JSON.parse(result)).toEqual(expected);
    });

    describe("Analytics", function() {
      it("gets the first version", async function() {
        let today = new Date().toISOString().substring(0, 10).replace(/-/g, "");

        await wait(
          async() => await EWE.reporting.getFirstVersion() != "0",
          1000,
          "No resource has been downloaded yet."
        );
        expect(await EWE.reporting.getFirstVersion()).toBe(today);
      });
    });


    describe("Diagnostics", function() {
      before(function() {
        if (isMV3())
          this.skip();
      });

      setMinTimeout(this, 4000);

      function expectedBlockingFilter(filterText) {
        return {
          text: filterText,
          enabled: true,
          slow: expect.any(Boolean),
          type: "blocking",
          thirdParty: expect.anyNullable("boolean"),
          selector: null,
          csp: expect.anyNullable("string")
        };
      }

      function expectedAllowingFilter(filterText) {
        return {
          csp: null,
          text: filterText,
          enabled: true,
          slow: expect.any(Boolean),
          type: "allowing",
          thirdParty: expect.anyNullable("boolean"),
          selector: null
        };
      }

      function expectedElemhideFilter(filterText) {
        return {
          csp: null,
          text: filterText,
          enabled: true,
          slow: false,
          thirdParty: null,
          type: "elemhide",
          selector: expect.any(String)
        };
      }

      let requestMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "request",
        specificOnly: false
      };

      let allowingMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "allowing"
      };

      let headerMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "header",
        specificOnly: false
      };

      let cspMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "csp",
        specificOnly: false
      };

      let elemhideMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "elemhide"
      };

      let popupMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "popup",
        specificOnly: false
      };
      let unmatchedMatchInfo = {
        docDomain: TEST_PAGES_DOMAIN,
        method: "unmatched",
        specificOnly: false
      };

      let unmatchedMainFrameMatchInfo = {
        docDomain: null,
        method: "unmatched",
        specificOnly: false
      };

      function expectRewriteMatchInfo(rewrittenUrl) {
        return {
          rewrittenUrl,
          ...requestMatchInfo
        };
      }

      function expectedRequestUrl(url) {
        return expect.objectContaining({
          url,
          frameId: expect.any(Number),
          tabId: expect.any(Number)
        });
      }

      function expectedRequestRelativeUrl(relativeUrl) {
        return expectedRequestUrl(`${TEST_PAGES_URL}/${relativeUrl}`);
      }

      async function expectLoggedMessages(getReceivedEvents, mandatoryEvents,
                                          optionalEvents = []) {
        // Some of the events we're checking for here may be emitted
        // after the page is done loading, like elemhide.
        let maxEventsLength = mandatoryEvents.length + optionalEvents.length;
        try {
          await wait(() => getReceivedEvents().length >= maxEventsLength,
                     1000, null, 50);
        }
        catch (e) {
          // Rather than fail in the catch, we're going to fail with
          // the assertions below. This will give better output with
          // highlighting which events were unmatched. Also, it lets
          // us not fail if the missing requests were the optional
          // ones.
        }
        // add a little wait here in case there are extra unexpected events
        await new Promise(r => setTimeout(r, 50));

        let receivedEvents = getReceivedEvents();
        expect(receivedEvents)
          .toBeArrayContainingExactly(mandatoryEvents, optionalEvents);
      }

      function compareMatchInfo(m1, m2) {
        let keys = [
          "docDomain",
          "rewrittenUrl",
          "specificOnly",
          "method",
          "allowingReason"
        ];
        return keys.every(key => m1[key] === m2[key]);
      }

      function getReceivedEventsFromFake(fake, tabId, filterToCurrentTab) {
        // Some legitimate events make it difficult to write
        // reliable tests. It's easier to just filter out these
        // requests, and assert based on requests on the test
        // pages themselves.
        return fake.args
            .map(args => args[0])
            .filter(event => {
              // Favicon request is difficult to sandbox or link to a
              // specific tab, since it's made and cached for a
              // domain.
              let url = event.request.url;
              let isFavicon = url && url.endsWith("/favicon.ico");
              return !isFavicon;
            })
            .filter(event => {
              // If the devtools are open, we might see requests to load
              // the dev tools.
              let isDevToolsRequest = event.request.url.endsWith(".html") &&
                  event.request.type == "other";
              return !isDevToolsRequest;
            })
            .filter(event => {
              // Some tests ran into issues with previous other tabs
              // being open, resulting in unexpected events. We filter
              // here rather than in eventOptions because we want to
              // capture all events for the tab, and don't know the
              // tabId to filter on until after we've opened it.
              let isCurrentTab = event.request.tabId == tabId;
              let isIrrelevantTab = filterToCurrentTab && !isCurrentTab;
              return !isIrrelevantTab;
            })
            .filter((event, index, allEvents) => {
              // Some browsers (mostly Firefox) sometimes retry blocked
              // requests. We get the same result the second time, so it
              // looks like a duplicate log, but it's for a different
              // requestId so it isn't actually a duplicate. For testing,
              // we'd rather just filter these duplicates out since they
              // aren't reliable.
              let previousEvents = allEvents.slice(0, index);
              let isRetryRequest = previousEvents.some(prev => {
                let filterMatches = (prev.filter && prev.filter.text) ==
                  (event.filter && event.filter.text);
                let matchInfoMatches = compareMatchInfo(
                  prev.matchInfo, event.matchInfo
                );
                let requestMatches =
                    prev.request.requestId != event.request.requestId &&
                    prev.request.tabId == event.request.tabId &&
                    prev.request.frameId == event.request.frameId &&
                    prev.request.url == event.request.url;

                return filterMatches &&
                  matchInfoMatches &&
                  requestMatches;
              });
              return !isRetryRequest;
            });
      }

      async function checkLogging(filters, eventOptions, callbackOrPage,
                                  mandatoryEvents, {
                                    filterToCurrentTab = true,
                                    optionalEvents = []
                                  } = {}) {
        let callback = callbackOrPage;
        if (typeof callbackOrPage == "string")
          callback = () => new Page(callbackOrPage).loaded;

        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem",
                                          eventOptions});

        if (filters)
          await EWE.filters.add(filters);

        let tabId = await callback();
        let getReceivedEvents =
          () => getReceivedEventsFromFake(fake, tabId, filterToCurrentTab);

        await expectLoggedMessages(
          getReceivedEvents, mandatoryEvents, optionalEvents
        );
      }

      it("does not log removed items", async function() {
        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem"});

        await addFilter("/image.png^$image");
        let page = new Page("image.html");
        await page.loaded;
        expect(fake.called).toBeTruthy();

        let {callCount} = fake;
        await removeFakeListeners();
        await page.reload();
        expect(fake.callCount).toEqual(callCount);
      });

      it("logs blocking request filter", async function() {
        await checkLogging(
          ["/image.png^$image"],
          allEventOptions,
          "image.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedBlockingFilter("/image.png^$image"),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]);
      });

      it("logs allowlisting request filter", async function() {
        await checkLogging(
          ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
          allEventOptions,
          "image.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$image`),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs third-party requests", async function() {
        await checkLogging(
          ["/image.png$third-party"],
          allEventOptions,
          "third-party.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("third-party.html")
          }, {
            filter: expectedBlockingFilter("/image.png$third-party"),
            matchInfo: requestMatchInfo,
            request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/image.png`)
          }]
        );
      });

      it("logs rewrite filter", async function() {
        await checkLogging(
          ["*.js$rewrite=abp-resource:blank-js,domain=localhost"],
          allEventOptions,
          "script.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("script.html")
          }, {
            filter: expectedBlockingFilter(
              "*.js$rewrite=abp-resource:blank-js,domain=localhost"
            ),
            matchInfo: expectRewriteMatchInfo("data:application/javascript,"),
            request: expectedRequestRelativeUrl("script.js")
          }]);
      });

      it("logs unmatched for invalid rewrite filter", async function() {
        // At time of writing, rewrite filters are not allowed to
        // redirect to arbitrary resources. It's only ever data urls
        // defined in core. This means when we redirect, we don't have
        // to deal with the redirected request, because it's a data
        // url. This test is meant to catch if this assumption is
        // broken in future and an arbitrary redirect is allowed.
        expect(addFilter(
          `*.js$rewrite=${TEST_PAGES_URL}/script.js,domain=localhost`
        )).rejects.toThrow("FilterError");
        await checkLogging(
          [],
          allEventOptions,
          "script.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("script.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("script.js")
          }]);
      });

      it("logs blocking $header filter", async function() {
        await checkLogging(
          [`|${TEST_PAGES_URL}$header=x-header=whatever`],
          allEventOptions,
          "header.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("header.html")
          }, {
            filter: expectedBlockingFilter(
              `|${TEST_PAGES_URL}$header=x-header=whatever`
            ),
            matchInfo: headerMatchInfo,
            request: expectedRequestRelativeUrl(
              "image.png?header-name=x-header&header-value=whatever"
            )
          }, {
            filter: expectedBlockingFilter(
              `|${TEST_PAGES_URL}$header=x-header=whatever`
            ),
            matchInfo: headerMatchInfo,
            request: expectedRequestRelativeUrl(
              "script.js?header-name=x-header&header-value=whatever"
            )
          }]);
      });

      it("logs allowlisting $header filter", async function() {
        await checkLogging(
          [
            `|${TEST_PAGES_URL}$header=x-header=whatever`,
            `@@|${TEST_PAGES_URL}$header`
          ],
          allEventOptions,
          "header.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("header.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}$header`
            ),
            matchInfo: headerMatchInfo,
            request: expectedRequestRelativeUrl(
              "image.png?header-name=x-header&header-value=whatever"
            )
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}$header`
            ),
            matchInfo: headerMatchInfo,
            request: expectedRequestRelativeUrl(
              "script.js?header-name=x-header&header-value=whatever"
            )
          }]);
      });

      it("logs $header filter allowlisted by non-header filter", async function() {
        await checkLogging(
          [
            `|${TEST_PAGES_URL}$header=x-header=whatever`,
            `@@|${TEST_PAGES_URL}`
          ],
          allEventOptions,
          "header.html",
          [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
            matchInfo: cspMatchInfo,
            request: expectedRequestRelativeUrl("header.html")
          }, {
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl(
              "image.png?header-name=x-header&header-value=whatever"
            )
          }, {
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl(
              "script.js?header-name=x-header&header-value=whatever"
            )
          }]);
      });

      it("logs blocking $csp filter", async function() {
        await checkLogging(
          [`|${TEST_PAGES_URL}$csp=img-src 'none'`],
          allEventOptions,
          "csp.html",
          [{
            filter: expectedBlockingFilter(
              `|${TEST_PAGES_URL}$csp=img-src 'none'`
            ),
            matchInfo: cspMatchInfo,
            request: expectedRequestRelativeUrl("csp.html")
          }]);
      });

      it("logs allowlisting $csp filter", async function() {
        await checkLogging(
          [`|${TEST_PAGES_URL}$csp=img-src 'none'`, `@@|${TEST_PAGES_URL}$csp`],
          allEventOptions,
          "csp.html",
          [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$csp`),
            matchInfo: cspMatchInfo,
            request: expectedRequestRelativeUrl("csp.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]);
      });

      it("logs allowlisting $document filter", async function() {
        await checkLogging(
          [`@@|${TEST_PAGES_URL}$document`],
          allEventOptions,
          "image.html",
          [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              allowingReason: "document"
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: null,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs allowlisting $document filter " +
         "after cross domain navigation", async function() {
        let fake = await addFakeListener({namespace: "reporting",
                                          eventName: "onBlockableItem",
                                          eventOptions: allEventOptions});

        await EWE.filters.add([`@@|${TEST_PAGES_URL}$document`,
                               `@@|${CROSS_DOMAIN_URL}$document`]);

        let page = new Page("cross-domain-navigation.html");
        let tabId = await page.loaded;

        let expectedLogs = [{
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            allowingReason: "document"
          },
          request: expectedRequestRelativeUrl("cross-domain-navigation.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("cross-domain-navigation.html")
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            allowingReason: "document"
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.html`,
            frameId: expect.any(Number),
            tabId: expect.any(Number)
          })
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.html`,
            frameId: expect.any(Number),
            tabId: expect.any(Number),
            type: "main_frame"
          })
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            specificOnly: false
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.png`,
            frameId: expect.any(Number),
            tabId: expect.any(Number),
            type: "image"
          })
        }];

        let getNextWaveOfReceivedEvents =
            () => getReceivedEventsFromFake(fake, tabId, true);

        await expectLoggedMessages(getNextWaveOfReceivedEvents, expectedLogs);
      });

      for (let option of ["$elemhide", "$genericblock", "$generichide"]) {
        it(`logs allowlisting ${option} filter`, async function() {
          let specificOnly = option == "$genericblock";
          await checkLogging(
            [`@@|${TEST_PAGES_URL}${option}`],
            allEventOptions,
            "image.html",
            [{
              filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}${option}`),
              matchInfo: {
                ...allowingMatchInfo,
                allowingReason: option.substring(1)
              },
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: {
                ...unmatchedMatchInfo,
                docDomain: null,
                specificOnly
              },
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: {
                ...unmatchedMatchInfo,
                specificOnly
              },
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });
      }

      it("logs allowlisting for different domain iframe", async function() {
        await checkLogging(
          [`@@|${TEST_PAGES_URL}/image.html^$document`],
          allowingEventOptions,
          () => new Page(`${CROSS_DOMAIN_URL}/iframe.html`, true).loaded,
          [{
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html^$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: CROSS_DOMAIN,
              allowingReason: "document"
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html^$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: TEST_PAGES_DOMAIN,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html^$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: TEST_PAGES_DOMAIN,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs allowlisting for nested iframe", async function() {
        await checkLogging(
          [`@@${TEST_PAGES_URL}/iframe.html$document`],
          allowingEventOptions,
          "nested-iframe.html",
          [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("iframe.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("iframe.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs allowlisting for contents of aborted iframe", async function() {
        await checkLogging(
          [`@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`],
          allowingEventOptions,
          "nested-iframe-aborted-request.html",
          [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("nested-iframe-aborted-request.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: null,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("nested-iframe-aborted-request.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.png")
          }],
          {
            // This event may appear depending on the order frames are
            // loaded and then committed. If it's committed first (eg
            // firefox), we correctly get this event before the frame
            // ultimately errors. If it would only be committed later
            // (eg chrome), we don't get this event. Blocking should
            // be the same either way.
            optionalEvents: [{
              filter: expectedAllowingFilter(
                `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
              ),
              matchInfo: {...allowingMatchInfo, specificOnly: false},
              request: expectedRequestRelativeUrl("iframe.html?delay=500")
            }]
          }
        );
      });

      it("does not use aborted iframe's url to add allowlisting filters", async function() {
        // This one is unusual in that the filter applies to the URL
        // which is aborted. So we might see the frame being committed
        // and the request for the frame, but we shouldn't see
        // allowlisting applied to the contents of the frame that are
        // injected with Javascript.
        await checkLogging(
          [`@@${TEST_PAGES_URL}/iframe.html$document`],
          allowingEventOptions,
          "nested-iframe-aborted-request.html",
          [],
          {
            optionalEvents: [{
              filter: expectedAllowingFilter(
                `@@${TEST_PAGES_URL}/iframe.html$document`
              ),
              matchInfo: {...allowingMatchInfo, allowingReason: "document"},
              request: expectedRequestRelativeUrl("iframe.html?delay=500")
            }, {
              filter: expectedAllowingFilter(
                `@@${TEST_PAGES_URL}/iframe.html$document`
              ),
              matchInfo: {...allowingMatchInfo, specificOnly: false},
              request: expectedRequestRelativeUrl("iframe.html?delay=500")
            }]
          }
        );
      });

      it("logs allowlisting for nested iframe when the inner frame is set by srcdoc", async function() {
        await checkLogging(
          [`@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`],
          allowingEventOptions,
          "nested-iframe-srcdoc.html",
          [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("nested-iframe-srcdoc.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: null,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("nested-iframe-srcdoc.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs allowlisting with $document filter", async function() {
        await checkLogging(
          [`@@${TEST_PAGES_URL}/image.html$document`],
          allowingEventOptions,
          "image.html",
          [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: null,
              specificOnly: false
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs element hiding filter", async function() {
        await checkLogging(
          ["###elem-hide"],
          elemhideEventOptions,
          "element-hiding.html",
          [{
            filter: expectedElemhideFilter("###elem-hide"),
            matchInfo: elemhideMatchInfo,
            request: expectedRequestRelativeUrl("element-hiding.html")
          }]
        );
      });

      it("receives ewe:content-hello message in background.js", async function() {
        await browser.runtime.sendMessage({type: "ewe-test:clearMessages"});
        await new Page("element-hiding.html").loaded;
        await new Promise(r => setTimeout(r, 200));
        let getMessage = {type: "ewe-test:getMessages"};
        let messages = await browser.runtime.sendMessage(getMessage);
        expect(messages).toEqual([
          // "ewe:content-hello" message sent from non-"about:blank" pages
          {type: "ewe:content-hello"},
          getMessage
        ]);
      });

      it("logs element hiding filter for a given tab", async function() {
        let page = new Page("element-hiding.html");
        let tabId = await page.created;
        await checkLogging(
          ["###elem-hide"],
          {
            tabId,
            ...elemhideEventOptions
          },
          () => page.loaded,
          [{
            filter: expectedElemhideFilter("###elem-hide"),
            matchInfo: elemhideMatchInfo,
            request: expectedRequestRelativeUrl("element-hiding.html")
          }],
          {filterToCurrentTab: false}
        );
      });

      it("logs element hiding filter dynamically", async function() {
        let text = `${TEST_PAGES_DOMAIN}###element-hiding-dyn`;
        await checkLogging(
          [text],
          elemhideEventOptions,
          async() => {
            let tabId = await new Page("image.html").loaded;
            await executeScript(tabId, async() => {
              let div = document.createElement("div");
              div.id = "element-hiding-dyn";
              div.style = "display: block !important;";
              div.innerHTML = "Target";
              document.body.appendChild(div);
            });
            await wait(
              async() =>
                await getVisibleElement(tabId, "element-hiding-dyn") == null,
              200,
              "Element is not visible"
            );
            await new Promise(r => setTimeout(r, 1500));
            return tabId;
          },
          [{
            filter: expectedElemhideFilter(text),
            matchInfo: elemhideMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }]
        );
      });

      it("logs element hiding emulation filter", async function() {
        setMinTimeout(this, 5000);

        let text = TEST_PAGES_DOMAIN +
          "#?#.child1:-abp-properties(background-color: blue)";
        await checkLogging(
          [text],
          elemhideEventOptions,
          async() => {
            let tabId = await new Page("element-hiding.html").loaded;
            await executeScript(tabId, async() => {
              document.getElementById("unhide1").parentElement.className = "";
            });
            await wait(
              async() => await getVisibleElement(tabId, "unhide1") != null,
              4000, "Element is not visible"
            );
            return tabId;
          },
          [{
            filter: {
              ...expectedElemhideFilter(text),
              type: "elemhideemulation"
            },
            matchInfo: elemhideMatchInfo,
            request: expectedRequestRelativeUrl("element-hiding.html")
          }]
        );
      });

      it("logs all items", async function() {
        await checkLogging(
          ["###elem-hide", VALID_FILTER_TEXT],
          {includeElementHiding: true, includeUnmatched: true},
          "element-hiding.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("element-hiding.html")
          }, {
            filter: expectedBlockingFilter(VALID_FILTER_TEXT),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }, {
            filter: expectedElemhideFilter("###elem-hide"),
            matchInfo: elemhideMatchInfo,
            request: expectedRequestRelativeUrl("element-hiding.html")
          }]
        );
      });

      it("logs for the requested tab", async function() {
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

        await page.loaded;

        expect(fake1.called).toBeTruthy();
        expect(fake2.called).toBeFalsy();
      });

      it("logs snippets filter", async function() {
        let snippet = "do";

        await setTestSnippets(snippet);
        try {
          await checkLogging(
            [`${TEST_PAGES_DOMAIN}#$#${snippet}`],
            defaultEventOptions,
            "image.html",
            [{
              filter: {
                csp: null,
                text: `${TEST_PAGES_DOMAIN}#$#${snippet}`,
                enabled: true,
                slow: false,
                thirdParty: null,
                type: "snippet",
                selector: null
              },
              matchInfo: {
                docDomain: TEST_PAGES_DOMAIN,
                method: "snippet"
              },
              request: expect.objectContaining({
                frameId: expect.any(Number),
                tabId: expect.any(Number),
                url: expect.any(String)
              })
            }]
          );
        }
        finally {
          await setTestSnippets(null);
        }
      });

      it("logs blocking popup filter", async function() {
        let opener = new Page("popup-opener.html");
        let sourceTabId = await opener.loaded;
        await checkLogging(
          ["*popup.html^$popup"],
          allEventOptions,
          async() => {
            let popup = new Popup("link", opener);
            await popup.blocked;
            return sourceTabId;
          },
          [{
            filter: expectedBlockingFilter("*popup.html^$popup"),
            matchInfo: popupMatchInfo,
            request: expectedRequestRelativeUrl("popup.html")
          }],
          {optionalEvents: [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("popup-opener.html")
          }]}
        );
      });

      it("logs allowlisting popup filter", async function() {
        let opener = new Page("popup-opener.html");
        let sourceTabId = await opener.loaded;
        await checkLogging(
          ["*popup.html^$popup", `@@|${TEST_PAGES_URL}/popup.html^$popup`],
          allEventOptions,
          async() => {
            let popup = new Popup("link", opener);
            await popup.blocked;
            return sourceTabId;
          },
          [{
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/popup.html^$popup`
            ),
            matchInfo: popupMatchInfo,
            request: expectedRequestRelativeUrl("popup.html")
          }],
          {optionalEvents: [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("popup-opener.html")
          }]}
        );
      });

      it("logs blocking third-party popup filter", async function() {
        let opener = new Page("popup-opener.html");
        let sourceTabId = await opener.loaded;
        await checkLogging(
          [`popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`],
          allEventOptions,
          async() => {
            let popup = new Popup("third-party-link", opener);
            await popup.blocked;
            return sourceTabId;
          },
          [{
            filter: expectedBlockingFilter(
              `popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`
            ),
            matchInfo: popupMatchInfo,
            request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/popup.html`)
          }],
          {optionalEvents: [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("popup-opener.html")
          }]}
        );
      });

      it("logs allowlisted third-party popup filter", async function() {
        let opener = new Page("popup-opener.html");
        let sourceTabId = await opener.loaded;
        await checkLogging(
          ["*popup.html^$popup", `@@|${CROSS_DOMAIN_URL}/popup.html^$popup`],
          allEventOptions,
          async() => {
            let popup = new Popup("third-party-link", opener);
            await popup.blocked;
            return sourceTabId;
          },
          [{
            filter: expectedAllowingFilter(
              `@@|${CROSS_DOMAIN_URL}/popup.html^$popup`
            ),
            matchInfo: popupMatchInfo,
            request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/popup.html`)
          }],
          {optionalEvents: [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("popup-opener.html")
          }]}
        );
      });

      it("logs requests sent by the extension", async function() {
        await checkLogging(
          [],
          allEventOptions,
          () => fetch(`${TEST_PAGES_URL}/image.png`),
          [{
            filter: null,
            matchInfo: {
              method: "allowing",
              allowingReason: "extensionInitiated"
            },
            request: expectedRequestRelativeUrl("image.png")
          }],
          {filterToCurrentTab: false}
        );
      });

      describe("Unmatched requests", function() {
        it("logs all unmatched requests on the image page", async function() {
          await checkLogging(
            [],
            unmatchedEventOptions,
            "image.html",
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });

        it("logs unmatched requests for the requested tab", async function() {
          let page = new Page("image.html");
          let tabId = await page.loaded;
          let otherTabFake = addFakeListener({
            namespace: "reporting",
            eventName: "onBlockableItem",
            eventOptions: {includeUnmatched: true, tabId: tabId + 1}
          });

          // small pause for unmatched events to finish coming through
          await new Promise(r => setTimeout(r, 50));

          await checkLogging(
            [],
            {...unmatchedEventOptions, tabId},
            () => page.reload(true),
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
          expect(otherTabFake.called).toBeFalsy();
        });

        it("logs unmatched iframe requests", async function() {
          await checkLogging(
            [],
            unmatchedEventOptions,
            "iframe.html",
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("iframe.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });

        it("logs unmatched third-party requests", async function() {
          await checkLogging(
            [],
            allEventOptions,
            "third-party.html",
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("third-party.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/image.png`)
            }]
          );
        });

        it("logs unmatched popup requests", async function() {
          let opener = new Page("popup-opener.html");
          await opener.loaded;
          await checkLogging(
            [],
            allEventOptions,
            async() => {
              let popup = new Popup("link", opener);
              await popup.blocked;
              return await popup.created;
            },
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("popup.html")
            }]
          );
        });

        it("logs unmatched allowlisted iframe requests", async function() {
          await checkLogging(
            [`@@|${TEST_PAGES_URL}/image.html$document`],
            unmatchedEventOptions,
            "iframe.html",
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestRelativeUrl("iframe.html")
            }, {
              filter: expectedAllowingFilter(
                `@@|${TEST_PAGES_URL}/image.html$document`
              ),
              matchInfo: {...allowingMatchInfo, allowingReason: "document"},
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: expectedAllowingFilter(
                `@@|${TEST_PAGES_URL}/image.html$document`
              ),
              matchInfo: {...allowingMatchInfo, specificOnly: false},
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: expectedAllowingFilter(
                `@@|${TEST_PAGES_URL}/image.html$document`
              ),
              matchInfo: {...allowingMatchInfo, specificOnly: false},
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });

        it("logs unmatched different domain iframe requests", async function() {
          let url = `${CROSS_DOMAIN_URL}/iframe.html`;
          await checkLogging(
            [],
            allEventOptions,
            () => new Page(url, true).loaded,
            [{
              filter: null,
              matchInfo: unmatchedMainFrameMatchInfo,
              request: expectedRequestUrl(url)
            }, {
              filter: null,
              matchInfo: {...unmatchedMatchInfo, docDomain: CROSS_DOMAIN},
              request: expectedRequestRelativeUrl("image.html")
            }, {
              filter: null,
              matchInfo: unmatchedMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });
      });

      describe("Event Options Filtering", function() {
        it("filters out unmatched requests with default options", async function() {
          await checkLogging(
            ["/image.png^$image"],
            defaultEventOptions,
            "image.html",
            [{
              filter: expectedBlockingFilter("/image.png^$image"),
              matchInfo: requestMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]);
        });

        it("filters out unmatched requests with allowing options", async function() {
          await checkLogging(
            ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
            allowingEventOptions,
            "image.html",
            [{
              filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$image`),
              matchInfo: requestMatchInfo,
              request: expectedRequestRelativeUrl("image.png")
            }]
          );
        });

        it("filters out allowing requests with default options", async function() {
          await checkLogging(
            ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
            defaultEventOptions,
            "image.html",
            []
          );
        });
      });
    });

    describe("Notifications", function() {
      it("supports notifications", async function() {
        let notification = {id: "test"};

        await EWE.notifications.start();
        await EWE.notifications.addNotification(notification);

        let fake = await addFakeListener({namespace: "notifications",
                                          method: "addShowListener",
                                          removeMethod: "removeShowListener"});
        await EWE.notifications.showNext();
        await EWE.notifications.removeNotification(notification);

        await EWE.notifications.stop();

        expect(fake.callCount).toBe(1);
        expect(fake.firstArg).toEqual(notification);
      });
    });
  });

  describe("Debugging", function() {
    setMinTimeout(this, 3000);

    function getBackgroundColor() {
      let elem = document.getElementById("elem-hide");
      return window.getComputedStyle(elem)["background-color"];
    }

    async function waitForHighlightedStyle() {
      let tabId = await new Page("element-hiding.html").loaded;
      let style;
      await wait(async() => {
        style = await executeScript(tabId, getBackgroundColor);
        return style != "rgba(0, 0, 0, 0)";
      }, 2000, "Style is not highlighted", 200);

      return style;
    }

    it("highlights an element", async function() {
      await EWE.debugging.setElementHidingDebugMode(true);
      await addFilter("###elem-hide");
      let style = await waitForHighlightedStyle();
      await EWE.debugging.setElementHidingDebugMode(false);

      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async function() {
      await EWE.debugging.setElementHidingDebugMode(true);
      await EWE.debugging.setElementHidingDebugMode(false);
      await addFilter("###elem-hide");
      let tabId = await new Page("element-hiding.html").loaded;
      let style = await executeScript(tabId, getBackgroundColor);

      expect(style).toBe("rgba(0, 0, 0, 0)");
    });

    it("highlights an element with a custom style", async function() {
      await EWE.debugging.setElementHidingDebugMode(true);
      await EWE.debugging.setElementHidingDebugStyle([["background", "pink"]]);
      await addFilter("###elem-hide");
      let style = await waitForHighlightedStyle();
      await EWE.debugging.setElementHidingDebugMode(false);

      expect(style).toBe("rgb(255, 192, 203)");
    });
  });
});
