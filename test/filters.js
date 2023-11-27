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

import {Page, setMinTimeout, waitForAssertion, isFirefox, isEdge, SITEKEY,
        TEST_PAGES_URL, TEST_PAGES_DOMAIN, CROSS_DOMAIN, setEndpointResponse,
        waitForSubscriptionsToDownload} from "./utils.js";
import {addFilter, EWE, getTestEvents, clearTestEvents, expectTestEvents}
  from "./messaging.js";
import {VALID_FILTER_TEXT, COMMENT_FILTER_TEXT, SECOND_VALID_FILTER_TEXT,
        subCircumvention} from "./api-fixtures.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

const WEBBUNDLE_FILTER_TEXT = `|${TEST_PAGES_URL}$webbundle`;
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

describe("Filters", function() {
  it("adds a single filter [fuzz]", async function() {
    await addFilter(VALID_FILTER_TEXT);
    expect(await EWE.filters.getUserFilters())
      .toEqual([VALID_FILTER]);
  });

  it("adds multiple filters", async function() {
    await EWE.filters.add([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([
      VALID_FILTER,
      SECOND_VALID_FILTER
    ]);
  });

  it("adds and removes a single filter as a string", async function() {
    await EWE.filters.add(VALID_FILTER_TEXT);
    expect(await EWE.filters.getUserFilters()).toEqual([VALID_FILTER]);

    await EWE.filters.remove(VALID_FILTER_TEXT);
    expect(await EWE.filters.getUserFilters()).toEqual([]);
  });

  it("adds comment filter", async function() {
    await EWE.filters.add([COMMENT_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([COMMENT_FILTER]);
  });

  it("adds a webbundle filter", async function() {
    await EWE.filters.add([WEBBUNDLE_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters())
      .toEqual([{...VALID_FILTER, text: WEBBUNDLE_FILTER_TEXT}]);
  });

  it("adds a single filter with wildcards", async function() {
    await addFilter("||foo^$domain=example.*");
    expect(await EWE.filters.getUserFilters())
      .toEqual([expect.objectContaining(
        {text: "||foo^$domain=example.*"})]);
  });

  it("adds a single filter with multiple wildcards", async function() {
    await addFilter("||foo^$domain=example.*|google.*");
    expect(await EWE.filters.getUserFilters())
      .toEqual([expect.objectContaining(
        {text: "||foo^$domain=example.*|google.*"})]);
  });

  it("rejects to adds a single filter with invalid wildcards", async function() {
    await expect(addFilter("||foo^$domain=*oogle.*"))
        .rejects.toThrow("FilterError: {\"type\":\"invalid_filter\",\"reason\":\"filter_invalid_wildcard\",\"option\":null}");
    await expect(addFilter("||foo^$domain=google.???"))
      .rejects.toThrow("FilterError: {\"type\":\"invalid_filter\",\"reason\":\"filter_invalid_wildcard\",\"option\":null}");
  });

  it("adds an allowing filter with sitekey option", async function() {
    const SITEKEY_ELEMHIDE_FILTER = `@@$elemhide,sitekey=${SITEKEY}`;
    await EWE.filters.add([SITEKEY_ELEMHIDE_FILTER]);
    expect(await EWE.filters.getUserFilters()).toEqual(expect.arrayContaining([
      expect.objectContaining({text: SITEKEY_ELEMHIDE_FILTER})
    ]));
  });

  it("adds filter that is already on subscription", async function() {
    const filter = "/image-from-custom-filter.png^$image";
    let updatedReply = [
      "[Adblock Plus]",
      filter
    ].join("\n");
    await setEndpointResponse("/anti-cv-subscription.txt", updatedReply);
    await EWE.subscriptions.add(subCircumvention.url);
    await waitForSubscriptionsToDownload();

    await EWE.filters.add([filter]);
    let userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toMatchObject({
      csp: null,
      enabled: true,
      selector: null,
      slow: false,
      text: filter,
      thirdParty: null,
      type: "blocking"
    });
    await new Page("image-from-custom-filter.html").expectResource("image-from-custom-filter.png").toBeBlocked();
  });

  it("remove custom filter that is already on subscription as a custom filter only", async function() {
    const UPDATABLE_SUBSCRIPTION_URL =
      "http://localhost:3003/updatable_subscription.txt";

    await EWE.subscriptions.add(UPDATABLE_SUBSCRIPTION_URL);
    await waitForSubscriptionsToDownload();

    // this filter is already in the subscription
    const filter = "/image-from-subscription.png^$image";
    await EWE.filters.add(filter);
    let userFilters = await EWE.filters.getUserFilters();
    expect(userFilters[0]).toMatchObject({
      csp: null,
      enabled: true,
      selector: null,
      slow: false,
      text: filter,
      thirdParty: null,
      type: "blocking"
    });

    await EWE.filters.remove(filter);
    userFilters = await EWE.filters.getUserFilters();
    expect(userFilters.length).toEqual(0);

    await new Page("image-from-subscription.html")
          .expectResource("image-from-subscription.png")
          .toBeBlocked();
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

    it("adds a string [fuzz]", async function() {
      await assertAddMetadata({owner: "owner"});
    });

    it("adds a bool", async function() {
      await assertAddMetadata({user_data: true});
    });

    it("adds for multiple filters", async function() {
      let filters = [VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT];
      let metadata = {created: 123};
      await EWE.filters.add(filters, metadata);
      for (let filter of filters) {
        expect(await EWE.filters.getMetadata(filter)).toEqual(metadata);
      }
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
      await expect(await EWE.filters.getMetadata(filterText)).toEqual(metadata);
    });

    it("throws if adding with metadata for added without metadata", async function() {
      let filters = [filterText];
      let metadata = {created: 123};
      await EWE.filters.add(filters);
      await expect(EWE.filters.add(filters, metadata))
        .rejects.toThrow("FilterError");
    });

    it("returns null metadata for a fitler which does not exist", async function() {
      await expect(await EWE.filters.getMetadata(filterText)).toEqual(null);
    });

    it("returns null metadata for a filter added without metadata", async function() {
      await EWE.filters.add(filterText);
      await expect(await EWE.filters.getMetadata(filterText)).toEqual(null);
    });
  });

  it("does not add invalid filters", async function() {
    return expect(addFilter(INVALID_FILTER_TEXT)).rejects.toThrow("FilterError");
  });

  it("disables existing filters [fuzz]", async function() {
    await addFilter(VALID_FILTER_TEXT);
    await addFilter(SECOND_VALID_FILTER_TEXT);

    await EWE.filters.disable([VALID_FILTER_TEXT, SECOND_VALID_FILTER_TEXT]);

    expect(await EWE.filters.getUserFilters())
      .toEqual([{...VALID_FILTER, enabled: false},
                {...SECOND_VALID_FILTER, enabled: false}]);
  });

  it("enables existing filters [fuzz]", async function() {
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

    expect(await EWE.filters.getUserFilters()).toEqual([VALID_FILTER]);
  });

  it("disables and enables a single filter as a string", async function() {
    await EWE.filters.add(VALID_FILTER_TEXT);
    await EWE.filters.disable(VALID_FILTER_TEXT);

    expect(await EWE.filters.getUserFilters())
      .toEqual([{...VALID_FILTER, enabled: false}]);

    await EWE.filters.enable(VALID_FILTER_TEXT);

    expect(await EWE.filters.getUserFilters()).toEqual([VALID_FILTER]);
  });

  it("does not enable nor add an unexisting filter", async function() {
    await EWE.filters.enable([VALID_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([]);
  });

  it("removes a single filter [fuzz]", async function() {
    await addFilter(VALID_FILTER_TEXT);
    await EWE.filters.remove([VALID_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([]);
  });

  it("adds a previously disabled rule without metadata as enabled", async function() {
    await EWE.filters.add(VALID_FILTER_TEXT);
    await EWE.filters.disable(VALID_FILTER_TEXT);
    await EWE.filters.remove(VALID_FILTER_TEXT);
    await EWE.filters.add(VALID_FILTER_TEXT);
    let filters = await EWE.filters.getUserFilters();
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({
      text: VALID_FILTER_TEXT,
      enabled: true
    })]));
  });

  it("adds a previously disabled rule with metadata as enabled", async function() {
    let metaData = {a: 1};
    await EWE.filters.add(VALID_FILTER_TEXT, metaData);
    await EWE.filters.disable(VALID_FILTER_TEXT);
    await EWE.filters.remove(VALID_FILTER_TEXT);
    await EWE.filters.add(VALID_FILTER_TEXT, metaData);
    let filters = await EWE.filters.getUserFilters();
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({
      text: VALID_FILTER_TEXT,
      enabled: true
    })]));
  });

  it("adds a previously disabled rule with metadata as enabled to new SpecialSubscription", async function() {
    let metaData = {a: 1};
    await EWE.filters.add(VALID_FILTER_TEXT, metaData);
    await EWE.filters.disable(VALID_FILTER_TEXT);
    await EWE.filters.remove(VALID_FILTER_TEXT);
    await EWE.filters.add(VALID_FILTER_TEXT);
    let filters = await EWE.filters.getUserFilters();
    expect(filters).toEqual(expect.arrayContaining([expect.objectContaining({
      text: VALID_FILTER_TEXT,
      enabled: true
    })]));
  });

  it("normalizes a filter internally", async function() {
    await addFilter(VALID_FILTER_TEXT);

    let PADDED_FILTER_TEXT = " " + VALID_FILTER_TEXT;
    await expect(addFilter(PADDED_FILTER_TEXT))
      .rejects.toThrow("FilterError");

    expect(await EWE.filters.getUserFilters()).toEqual([VALID_FILTER]);

    await EWE.filters.disable([PADDED_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters())
      .toEqual([{...VALID_FILTER, enabled: false}]);

    await EWE.filters.enable([PADDED_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([VALID_FILTER]);

    await EWE.filters.remove([PADDED_FILTER_TEXT]);
    expect(await EWE.filters.getUserFilters()).toEqual([]);
  });

  it("validates a valid filter", async function() {
    expect(await EWE.filters.validate(VALID_FILTER_TEXT)).toBeNull();
  });

  it("validates a filter with unknown option [fuzz]", async function() {
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

  it("has a third-party property", async function() {
    await addFilter(`|${TEST_PAGES_URL}$third-party`);

    expect(await EWE.filters.getUserFilters()).toEqual([
      expect.objectContaining({thirdParty: true})
    ]);
  });

  it("has a ~third-party property", async function() {
    await addFilter(`|${TEST_PAGES_URL}$~third-party`);

    expect(await EWE.filters.getUserFilters()).toEqual([
      expect.objectContaining({thirdParty: false})
    ]);
  });

  describe("Filter events [fuzz]", function() {
    it("listens to onAdded events", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await expectTestEvents("filters.onAdded", [[VALID_FILTER]]);
    });

    it("listens to onChanged events", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.disable([VALID_FILTER_TEXT]);

      await expectTestEvents("filters.onChanged", [[
        {...VALID_FILTER, enabled: false}, "enabled"
      ]]);

      // This is a workaround and should be removed once https://gitlab.com/eyeo/webext/webext-sdk/-/issues/122 is fixed.
      await EWE.filters.enable([VALID_FILTER_TEXT]);
    });

    it("listens to onChanged metadata events", async function() {
      await EWE.filters.add(VALID_FILTER_TEXT);
      const META1 = {a: "1"};
      await EWE.filters.setMetadata(VALID_FILTER_TEXT, META1);
      let EVENT = "filters.onChanged";
      await expectTestEvents(EVENT, [[expect.objectContaining({
        text: VALID_FILTER_TEXT, metadata: META1
      }), "metadata"]]);
      const META2 = {a: "2"};
      clearTestEvents(EVENT);
      await EWE.filters.setMetadata(VALID_FILTER_TEXT, META2);
      await expectTestEvents(EVENT, [[expect.objectContaining({
        text: VALID_FILTER_TEXT, oldMetadata: META1, metadata: META2
      }), "metadata"]]);
    });

    it("listens to onRemoved events", async function() {
      await addFilter(VALID_FILTER_TEXT);
      await EWE.filters.remove([VALID_FILTER_TEXT]);
      await expectTestEvents("filters.onRemoved", [[VALID_FILTER]]);
    });
  });

  describe("Allowlisting", function() {
    const ALLOWING_IMAGE_DOC_FILTER =
      `@@|${TEST_PAGES_URL}/image.html^$document`;
    const ALLOWING_IFRAME_DOC_FILTER =
      `@@|${TEST_PAGES_URL}/iframe.html^$document`;

    it("returns filters for allowlisted tabs [fuzz]", async function() {
      await addFilter(`|${TEST_PAGES_URL}/image.png^`);
      await addFilter(ALLOWING_IMAGE_DOC_FILTER);

      let tabId = await new Page("image.html").loaded;
      expect(await EWE.filters.getAllowingFilters(tabId))
        .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
    });

    it("returns filters for allowlisted tabs after page load [fuzz]", async function() {
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
      setMinTimeout(this, 5000);
      await addFilter(ALLOWING_IMAGE_DOC_FILTER);

      let {tabId, frameId} = await loadTabWithFrame();
      expect(await EWE.filters.getAllowingFilters(tabId, {frameId}))
        .toEqual([ALLOWING_IMAGE_DOC_FILTER]);
      expect(await EWE.filters.getAllowingFilters([tabId])).toEqual([]);

      await addFilter(ALLOWING_IFRAME_DOC_FILTER);

      ({tabId, frameId} = await loadTabWithFrame());
      expect(await EWE.filters.getAllowingFilters(tabId, {frameId}))
        .toEqual(expect.arrayContaining([ALLOWING_IMAGE_DOC_FILTER,
                                         ALLOWING_IFRAME_DOC_FILTER]));
      expect(await EWE.filters.getAllowingFilters(tabId))
        .toEqual([ALLOWING_IFRAME_DOC_FILTER]);
    });

    it("returns filters for allowlisted parent frames [fuzz]", async function() {
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
      expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([]);
    });

    it("doesn't return filters for non-allowlisted frames", async function() {
      let {tabId, frameId} = await loadTabWithFrame();
      expect(await EWE.filters.getAllowingFilters(
        tabId, {frameId})).toEqual([]);
      expect(await EWE.filters.getAllowingFilters([tabId])).toEqual([]);
    });

    it("returns filters for allowlisted domains", async function() {
      let filter = `@@*$document,domain=${TEST_PAGES_DOMAIN}`;

      await addFilter(filter);
      let tabId = await new Page("image.html").loaded;
      expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([filter]);
    });

    it("doesn't return filters for non-allowlisted domains", async function() {
      await addFilter(`@@*$document,domain=~${TEST_PAGES_DOMAIN}`);
      let tabId = await new Page("image.html").loaded;
      expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([]);
    });

    it("handles empty tabs", async function() {
      let tabId = await new Page("about:blank", true).loaded;
      expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([]);
    });

    it("returns whether a resource is allowlisted [fuzz]", async function() {
      await addFilter("@@*$image");

      let tabId = await new Page("image.html").loaded;
      expect(await EWE.filters.isResourceAllowlisted(
        `${TEST_PAGES_URL}/image.png`, "image", tabId)).toEqual(true);
    });

    it("returns whether a resource is allowlisted when loading in existing frame", async function() {
      await EWE.filters.add([`@@|${TEST_PAGES_URL}/image.html^$document`]);

      await browser.runtime.sendMessage({
        type: "ewe-test:subscribeTabsOnUpdated"});

      try {
        let page = new Page("image.html");
        await page.loaded;
        let isImagePageAllowlisted = await browser.runtime.sendMessage({
          type: "ewe-test:isResourceAllowlisted",
          url: `${TEST_PAGES_URL}/image.html`,
          status: "loading"
        });
        expect(isImagePageAllowlisted).toEqual(true);

        await page.load("header.html");
        let isHeaderPageAllowlisted = await browser.runtime.sendMessage({
          type: "ewe-test:isResourceAllowlisted",
          url: `${TEST_PAGES_URL}/header.html`,
          status: "loading"
        });
        expect(isHeaderPageAllowlisted).toEqual(false);
      }
      finally {
        await browser.runtime.sendMessage({
          type: "ewe-test:unsubscribeTabsOnUpdated"
        });
      }
    });

    it("returns whether a resource is allowlisted for excluded domains", async function() {
      await EWE.filters.add(["@@*$document,domain=~localhost"]);

      await browser.runtime.sendMessage({
        type: "ewe-test:subscribeTabsOnUpdated"
      });

      try {
        let url = `${TEST_PAGES_URL}/image.html`;
        let tabId = await new Page(url, true).loaded;
        expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([]);
        expect(await EWE.filters.isResourceAllowlisted(
          url, "document", tabId)).toEqual(false);

        // "complete" status event can be delayed
        await new Promise(r => setTimeout(r, 1000));

        let wasAllowlistedOnComplete = await browser.runtime.sendMessage({
          type: "ewe-test:isResourceAllowlisted",
          url,
          status: "complete"
        });
        expect(wasAllowlistedOnComplete).toEqual(false);
      }
      finally {
        await browser.runtime.sendMessage({
          type: "ewe-test:unsubscribeTabsOnUpdated"
        });
      }
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

      let {tabId, frameId} = await loadTabWithFrame("iframe-cross-domain.html");
      let url = `${TEST_PAGES_URL}/image.png`;

      expect(await EWE.filters.isResourceAllowlisted(
        url, "image", tabId)).toEqual(false);
      expect(await EWE.filters.isResourceAllowlisted(
        url, "image", tabId, frameId)).toEqual(true);
    });

    it("returns whether a resource is allowlisted by $document [fuzz]", async function() {
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
      setMinTimeout(this, 10000);

      let url = isFirefox() ? "about:blank" :
          isEdge() ? "edge://newtab/" : "chrome://newtab/";

      // On Chromium 77, "chrome://newtab/" status keeps stuck at
      // "loading", that's why Page is not awaited on `loaded` here,
      // but we need to wait a bit longer than just `created` for
      // the tab updated event to have happened.
      let tabId = await new Page(url, true).created;
      let timeout = isFuzzingServiceWorker() ? 80000 : 6000;

      await waitForAssertion(() => {
        let events = getTestEvents("ewe-test.newTabAllowlisted")
          .filter(event => event[0].tabId == tabId);
        expect(events[0]).toEqual([{tabId, url, isResourceAllowlisted: false}]);
      }, timeout);
    });

    it("adds 'hide-if-classifies' snippet without domains limitation", async function() {
      await expect(EWE.filters.add("#$#hide-if-classifies .selector"))
        .resolves.not.toThrow();

      await expect(EWE.filters.add("#$#some-snippet .selector"))
        .rejects.toThrow("FilterError: {\"type\":\"invalid_filter\",\"reason\":\"filter_snippet_nodomain\",\"option\":null}");

      await expect(EWE.filters.add("#?#:-abp-properties(foo)"))
        .rejects.toThrow("FilterError: {\"type\":\"invalid_filter\",\"reason\":\"filter_elemhideemulation_nodomain\",\"option\":null}");
    });
  });
});

describe("Filters limit [mv3-only]", function() {
  it("does not allow adding more than 5000 filters", async function() {
    let timeout = isFuzzingServiceWorker() ? 60000 : 30000;
    setMinTimeout(this, timeout);
    let fiveThousandFilters = Array.from(
      {length: 5000},
      (_, x) => ("filter_" + x)
    );
    await expect(EWE.filters.add(fiveThousandFilters))
      .resolves.not.toThrow();

    await expect(EWE.filters.add("filter_5001")).rejects.toThrow(
      "FilterError: {\"type\":\"too_many_filters\",\"option\":null}");
  });
});
