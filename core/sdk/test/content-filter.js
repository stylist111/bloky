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

import expect from "expect";
import browser from "webextension-polyfill";

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN, SITEKEY, TEST_ADMIN_PAGES_URL}
  from "@eyeo/test-utils/sdk-urls";
import {
  Page, waitForInvisibleElement, executeScript, setMinTimeout,
  getVisibleElement, getVisibleElementInFrame, expectElemHideHidden,
  expectElemHideVisible, isFirefox, firefoxVersion,
  UNHIDDENTIMEOUT, HIDETIMEOUT, waitForHighlightedStyle, isEdge,
  edgeVersion, waitForSubscriptionsToDownload, chromiumVersion,
  isChromiumBased, setEndpointResponse, expectElemHideRemoved,
  expectElementToHaveInlineStyle, checkElementsHidden, sleep
}
  from "./utils.js";
import {subTestCustom1, subAntiCVLocal} from "./fixtures/subscriptions.js";
import {wait} from "./polling.js";
import {addFilter, addFilters, EWE} from "./messaging.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";
import {CACHED_FILTERS_CONFIG_KEY} from "../src/content/shared/constants.js";
import {restartWithTestArgs as restartWithTelemetryTestArgs} from "./fixtures/telemetry-server-logger.js";

let hideTimeout = isFuzzingServiceWorker() ? 15000 : 1000;
let collapseTimeout = 2000;
let elemhideEmulationUpdateTimeout = 4000;
let unhiddenTimeout = isFuzzingServiceWorker() ? 1000 : 200;

describe("Element Hiding", function() {
  it("hides an element [fuzz]", async function() {
    await addFilter("###elem-hide");
    await expectElemHideHidden();
  });

  it("removes a DOM element with a {remove: true;} filter", async function() {
    await addFilter("###elem-hide {remove: true;}");
    await expectElemHideRemoved();
  });

  it("hides an element for the domain with wildcard", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addFilter("webext.*###elem-hide");
    await expectElemHideHidden({
      url: "http://webext.com:3000/element-hiding.html"
    });
  });

  it("hides an element for the domain with wildcard with attribute selector", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addFilter("webext.*##div[width=\"100\"]");
    await expectElemHideHidden({
      url: "http://webext.com:3000/element-hiding.html",
      elemId: "elem-hide-wildcard"
    });
  });

  it("hides an element for the domain with port and filter with wildcard and style attribute selector", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addFilter("webext.*##div[style=\"width: 200px\"]");
    await expectElemHideHidden({
      url: "http://webext.com:3000/element-hiding.html",
      elemId: "elem-hide-wildcard-style"
    });
  });

  it("handled invalid selectors", async function() {
    await addFilter("####.wj-header-usercookies"); // invalid selector
    await addFilter("###elem-hide");
    await expectElemHideHidden();
  });

  it("saves and loads the sitekeys [mv3-only] [fuzz-skip]", async function() {
    await EWE.testing.clearAllSitekeys(false);

    try {
      await EWE.testing._setSitekey(1, 1, "http://url1.com", "sitekey1", "sig1");
      await EWE.testing._setSitekey(1, 1, "http://url2.com", "sitekey2", "sig2");
      await EWE.testing._setSitekey(1, 2, "http://url3.com", "sitekey3", "sig3");
      await EWE.testing._setSitekey(2, 3, "http://url4.com", "sitekey4", "sig4");
      await EWE.testing._setSitekey(4, 5, "http://url5.com", null, null);

      await EWE.testing._doSaveSitekeys();
      await EWE.testing._awaitSavingComplete();
      await EWE.testing.clearAllSitekeys(false);
      await EWE.testing._loadSitekeys(false);

      expect(await EWE.testing.getSitekey(1, 1, "http://url1.com")).toEqual("sitekey1");
      expect(await EWE.testing._getSitekeySignature(1, 1, "http://url1.com")).toEqual("sig1");
      expect(await EWE.testing.getSitekey(1, 1, "http://url2.com")).toEqual("sitekey2");
      expect(await EWE.testing._getSitekeySignature(1, 1, "http://url2.com")).toEqual("sig2");
      expect(await EWE.testing.getSitekey(1, 2, "http://url3.com")).toEqual("sitekey3");
      expect(await EWE.testing._getSitekeySignature(1, 2, "http://url3.com")).toEqual("sig3");
      expect(await EWE.testing.getSitekey(2, 3, "http://url4.com")).toEqual("sitekey4");
      expect(await EWE.testing._getSitekeySignature(2, 3, "http://url4.com")).toEqual("sig4");
      expect(await EWE.testing.getSitekey(4, 5, "http://url5.com")).toBeNull();
    }
    finally {
      await EWE.testing.clearAllSitekeys();
    }
  });

  it("verifies the sitekeys loaded from the storage [mv3-only] [fuzz-skip]", async function() {
    await EWE.testing.clearAllSitekeys(false);

    try {
      let url = "element-hiding.html?sitekey=1";
      let page = new Page(url);
      let tabId = await page.loaded;

      await EWE.testing._doSaveSitekeys();
      await EWE.testing._awaitSavingComplete();

      // simulate a fake signature injection
      let key = "ewe:sitekeys";
      let data = await browser.storage.local.get(key);
      data = data[key];
      expect(data).not.toBeNull();
      expect(data[tabId]).not.toBeNull(); // valid sitekey
      let fakeTabId = 7;
      let fakeFrameId = 8;
      let fakeUrl = "http://someFakeDomain.com";
      let fakeUrlMap = {};
      fakeUrlMap[fakeUrl] = {sitekey: SITEKEY, signature: "fakeSignature"};
      let fakeFrameIdMap = {};
      fakeFrameIdMap[fakeFrameId] = fakeUrlMap;
      data[fakeTabId] = fakeFrameIdMap;
      let obj = {};
      obj[key] = data;
      await browser.storage.local.set(obj);

      await EWE.testing.clearAllSitekeys(false);

      await EWE.testing._loadSitekeys(true); // with verification

      expect(await EWE.testing.getSitekey(tabId, 0, TEST_PAGES_URL + "/" + url))
        .not.toBeNull();
      expect(await EWE.testing.getSitekey(fakeTabId, fakeFrameId, fakeUrl))
        .toBeNull();
    }
    finally {
      await EWE.testing.clearAllSitekeys();
    }
  });

  it("hides an element using subscriptions [fuzz]", async function() {
    await EWE.subscriptions.add(subTestCustom1.url);
    await waitForSubscriptionsToDownload();

    await expectElemHideHidden();
  });

  it("does not hide an element using subscriptions with filter with wildcards [mv2-only]", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    const validFilter = "webext.*#@##elem-hide"; // exception
    const invalidFilter = "webext.**#@##elem-hide"; // exception
    let updatedReply = [
      "[Adblock Plus]",
      invalidFilter,
      validFilter
    ].join("\n");
    await setEndpointResponse(subAntiCVLocal.url, updatedReply);
    await EWE.subscriptions.add(subAntiCVLocal.url);
    await waitForSubscriptionsToDownload();

    await expectElemHideVisible({
      url: "http://webext.com:3000/element-hiding.html"
    });
  });

  it("does not hide an allowlisted element", async function() {
    await addFilter("###elem-hide");
    await addFilter("#@##elem-hide");
    await expectElemHideVisible();
  });

  it("does not remove an allowlisted element", async function() {
    await addFilter("###elem-hide {remove: true;}");
    await addFilter("#@##elem-hide");
    await expectElemHideVisible();
  });

  for (let type of ["$document", "$elemhide"]) {
    it(`does not hide elements in document allowlisted ${type} [fuzz]`, async function() {
      setMinTimeout(this, 12000);

      await addFilter("###elem-hide");
      await expectElemHideHidden();

      await addFilter(`@@|${TEST_PAGES_URL}/*.html${type}`);
      await expectElemHideVisible();
    });

    it(`does not hide frame elements allowlisted by ${type}`, async function() {
      setMinTimeout(this, 8000);

      await addFilter("###elem-hide");
      await expectElemHideHidden({
        url: "iframe-elemhide.html",
        elemId: "elem-hide",
        frameIds: ["elem-hide-frame"]
      });

      await addFilter(`@@|${TEST_PAGES_URL}/iframe-elemhide.html^${type}`);
      await expectElemHideVisible({
        url: "iframe-elemhide.html",
        elemId: "elem-hide",
        frameIds: ["elem-hide-frame"]
      });
    });

    for (let nestedFrameTestCase of [
      {name: "nested iframe", file: "nested-iframe-elemhide.html"},
      {name: "nested iframe using srcdoc", file: "nested-iframe-elemhide-srcdoc.html"},
      {name: "nested iframe where the request is aborted", file: "nested-iframe-elemhide-aborted-request.html"}
    ]) {
      it(`does not hide element allowlisted by ${type} in a ${nestedFrameTestCase.name} if the top iframe is allowlisted`, async function() {
        setMinTimeout(this, 8000);

        await addFilter("###elem-hide");
        await expectElemHideHidden({
          url: nestedFrameTestCase.file,
          elemId: "elem-hide",
          frameIds: ["elem-hide-parent-frame", "elem-hide-frame"]
        });

        await addFilter(`@@|${TEST_PAGES_URL}/${nestedFrameTestCase.file}^${type}`);
        await expectElemHideVisible({
          url: nestedFrameTestCase.file,
          elemId: "elem-hide",
          frameIds: ["elem-hide-parent-frame", "elem-hide-frame"]
        });
      });
    }
  }

  it("does not hide elements in document allowlisted for domain", async function() {
    await addFilter("###elem-hide");
    await addFilter(
      `@@|${TEST_PAGES_URL}/*.html$elemhide,domain=${TEST_PAGES_DOMAIN}`);
    await expectElemHideVisible();
  });

  it("does not hide elements in document allowlisted for domain with wildcard", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addFilter("webext.*###elem-hide");
    await addFilter("webext.*#@##elem-hide"); // exception

    await expectElemHideVisible({
      url: "http://webext.com:3000/element-hiding.html"
    });
  });

  it("does not hide elements through generic filter in documents allowlisted by $generichide", async function() {
    await addFilter("###elem-hide");
    await addFilter(`${TEST_PAGES_DOMAIN}###elem-hide-specific`);
    await addFilter(`@@|${TEST_PAGES_URL}$generichide`);

    let tabId = await new Page("element-hiding.html").loaded;
    await wait(
      async() => {
        expect(await getVisibleElement(tabId, "elem-hide")).not.toBeNull();
        return await getVisibleElement(tabId, "elem-hide-specific") == null;
      },
      hideTimeout,
      "Expected element \"elem-hide-specific\" to be hidden, but it was visible."
    );
  });

  describe("Element Hiding Emulation", function() {
    afterEach(async function() {
      await EWE.testing.clearKnownFiltersCache();
    });

    it("hides abp-properties elements [fuzz]", async function() {
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);
      await expectElemHideHidden({elemId: "elem-hide-emulation-props"});
    });

    it("hides abp-properties elements after unhide", async function() {
      setMinTimeout(this, 14000);

      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#.child1:-abp-properties(background-color: blue)`
      );
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#.child2:-abp-properties(background-color: lime)`
      );

      let tabId = await new Page("element-hiding.html").loaded;
      let elem1;
      let elem2;

      await wait(
        async() => {
          elem1 = await getVisibleElement(tabId, "unhide1");
          elem2 = await getVisibleElement(tabId, "unhide2");
          return elem1 == null && elem2 == null;
        }, hideTimeout, "Elements were not hidden initially"
      );

      await executeScript(tabId, async() => {
        document.getElementById("unhide1").parentElement.className = "";
        document.getElementById("unhide2").parentElement.className = "";
      });
      await wait(async() => {
        elem1 = await getVisibleElement(tabId, "unhide1");
        elem2 = await getVisibleElement(tabId, "unhide2");
        return elem1 != null && elem2 != null;
      }, elemhideEmulationUpdateTimeout, "Element is not visible");
      expect(elem1).toContain("unhide1");
      expect(elem2).toContain("unhide2");

      await executeScript(tabId, async() => {
        document.getElementById("unhide1").parentElement.className = "parent1";
        document.getElementById("unhide2").parentElement.className = "parent2";
      });
      await wait(async() => {
        elem1 = await getVisibleElement(tabId, "unhide1");
        elem2 = await getVisibleElement(tabId, "unhide2");
        return elem1 == null && elem2 == null;
      }, elemhideEmulationUpdateTimeout, "Element is visible");
    });

    it("hides abp-has elements", async function() {
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-has(>span#elem-hide-emulation-has)`);
      await expectElemHideHidden({elemId: "elem-hide-emulation-has"});
    });

    it("removes a DOM element with a {remove: true;} filter", async function() {
      const elemId = "remove-id";

      await expectElemHideVisible({elemId});
      await addFilter(`${TEST_PAGES_DOMAIN}#?##${elemId} {remove: true;}`);
      await expectElemHideRemoved({elemId});
    });

    it("applies inline CSS to element", async function() {
      const elemId = "inline-css-div";

      await expectElementToHaveInlineStyle(elemId, "");
      await expectElementToHaveInlineStyle("inline-css-div-2", "");

      await addFilter(`${TEST_PAGES_DOMAIN}#?##${elemId} {margin-bottom: 0px; margin-top: 0px}`);

      await expectElementToHaveInlineStyle(elemId, "margin-bottom: 0px !important; margin-top: 0px !important;");
      await expectElementToHaveInlineStyle("inline-css-div-2", "");
    });

    it("does not remove a DOM element with a {remove: true;} filter if it is allowlisted", async function() {
      const elemId = "remove-id";

      await expectElemHideVisible({elemId});
      await addFilter(`${TEST_PAGES_DOMAIN}#?##${elemId} {remove: true;}`);
      await addFilter(`${TEST_PAGES_DOMAIN}#@##${elemId}`);
      await expectElemHideVisible({elemId});
    });

    it("hides abp-contains elements", async function() {
      await addFilter(`${TEST_PAGES_DOMAIN}#?#span` +
                      ":-abp-contains(elem-hide-emulation-contain-target)");
      await expectElemHideHidden({elemId: "elem-hide-emulation-contain"});
    });

    it("hides abp-contains elements with wildcards", async function() {
      // DNS mapping webext.com to 127.0.0.1 is configured
      // for all Chromium-based browsers during the tests.
      if (!isChromiumBased()) {
        this.skip();
      }

      await addFilter("webext.*#?#span:-abp-contains(elem-hide-emulation-contain-target)");
      await expectElemHideHidden({
        url: "http://webext.com:3000/element-hiding.html",
        elemId: "elem-hide-emulation-contain"
      });
    });

    it("hides the img element of a blocked request in element-hiding-aboutblank", async function() {
      setMinTimeout(this, 5000);
      await addFilter("##img");

      await expectElemHideHidden({
        elemId: "aboutblank-img",
        url: "element-hiding-aboutblank.html",
        frameIds: ["aboutblank-iframe"]
      });
    });

    it("hides the img element in element-hiding-aboutblank with specific rule", async function() {
      setMinTimeout(this, 5000);
      await addFilter("localhost##img"); // specific for "localhost"

      await expectElemHideHidden({
        elemId: "aboutblank-img",
        url: "element-hiding-aboutblank.html",
        frameIds: ["aboutblank-iframe"]
      });
    });

    it("hides an element on history.pushState with previous URL allowlisted", async function() {
      setMinTimeout(this, 6000);

      await addFilter(`@@|${TEST_PAGES_URL}/history.html^$document`);
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);

      await expectElemHideHidden({
        url: "history.html",
        elemId: "elem-hide-emulation-props",
        timeout: 4 * HIDETIMEOUT
      });
    });

    it("calculates the selectors diff within reasonable time [mv2-only]", async function() {
      setMinTimeout(this, 6000);

      let response = [
        "[Adblock Plus]",
        ""
      ];

      let i = 0;
      while (i++ < 30000) {
        response.push("###elementHidingFilter" + i);
      }
      await setEndpointResponse("/large-subscription.txt", response.join("\n"));
      await EWE.subscriptions.add(`${TEST_ADMIN_PAGES_URL}/large-subscription.txt`);
      await waitForSubscriptionsToDownload();

      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);

      await expectElemHideHidden({
        url: "history.html",
        elemId: "elem-hide-emulation-props",
        timeout: 4 * HIDETIMEOUT
      });
    });

    it("does not hide an element on history.pushState with new URL allowlisted", async function() {
      setMinTimeout(this, 6000);

      await addFilter(`@@|${TEST_PAGES_URL}/history-after-pushState.html^$document`);
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);

      await expectElemHideVisible({
        url: "history.html",
        elemId: "elem-hide-emulation-props",
        timeout: 4 * UNHIDDENTIMEOUT
      });
    });
  });

  describe("Element collapsing", function() {
    const forceBg = isFirefox() && firefoxVersion() >= 97;

    it("hides the img element of a blocked request [fuzz]", async function() {
      await addFilter("/image.png^$image");

      let tabId = await new Page("element-hiding.html", forceBg).loaded;
      await waitForInvisibleElement(tabId, "elem-hide-img-request");
    });

    it("hides the img element of a blocked request on multiple slow requests", async function() {
      // Two matching filters are added to test that sendMessage() in
      // content-message-deferrer.js is called more than once
      await EWE.filters.add([
        "||abptestpages.org/testfiles/blocking/full-path.png",
        "/testfiles/blocking/partial-path/"]);

      // The page from abptestpages somehow provides the slow request conditions
      let tabId = await new Page("https://abptestpages.org/en/filters/blocking",
                                 forceBg).loaded;
      await waitForInvisibleElement(tabId, "partial-path-fail-1");
    });

    for (let [testcase, frameIds] of [
      ["element-hiding-aboutblank", ["aboutblank-iframe"]],
      ["element-hiding-aboutblank-deep", ["aboutblank-iframe-outer",
                                          "aboutblank-iframe"]]
    ]) {
      it(`hides the img element of a blocked request in ${testcase} iframe`,
         async function() {
           setMinTimeout(this, 5000);

           await addFilter("/image.png^$image");

           let tabId = await new Page(`${testcase}.html`).loaded;
           await wait(async() => {
             let visible = await getVisibleElementInFrame(
               tabId, "aboutblank-img", frameIds);
             return visible === null;
           }, collapseTimeout, "The image element is still visible");
         });
    }
  });

  describe("Debugging", function() {
    beforeEach(async function() {
      await EWE.debugging.setElementHidingDebugMode(true);
      await addFilter("###elem-hide");
    });

    afterEach(async function() {
      await EWE.debugging.clearDebugOptions();
    });

    it("highlights an element [fuzz]", async function() {
      let style = await waitForHighlightedStyle(hideTimeout);
      expect(style).toBe("rgb(230, 115, 112)");
    });

    it("doesn't highlight an element when disabled", async function() {
      await EWE.debugging.setElementHidingDebugMode(false);
      await expectElemHideHidden();
    });

    it("highlights an element with a custom style", async function() {
      await EWE.debugging.setElementHidingDebugStyle([["background", "pink"]]);
      let style = await waitForHighlightedStyle(hideTimeout);
      expect(style).toBe("rgb(255, 192, 203)");
    });
  });

  describe("Sitekey allowlisting", function() {
    it("has no effect on pages without the sitekey", async function() {
      await addFilter("###elem-hide");
      await addFilter(`@@$elemhide,sitekey=${SITEKEY}`);
      await expectElemHideHidden();
    });

    it("does not hide an element on a sitekey allowlisted page [fuzz]", async function() {
      setMinTimeout(this, 5000);

      await addFilter("###elem-hide");
      await addFilter(`@@$elemhide,sitekey=${SITEKEY}`);

      // Wait to ensure that adding the filters has completed
      await new Promise(r => setTimeout(r, 2000));

      await expectElemHideVisible({url: "element-hiding.html?sitekey=1"});
    });

    it("does not hide an element on a sitekey allowlisted page after reload", async function() {
      await addFilter("###elem-hide");
      await addFilter(`@@$elemhide,sitekey=${SITEKEY}`);

      let page = new Page("element-hiding.html?sitekey=1");
      let tabId = await page.loaded;
      await page.reload();
      // hiding elements may take a few ms on CI
      await new Promise(r => setTimeout(r, unhiddenTimeout));
      expect(await getVisibleElement(tabId, "elem-hide")).not.toBeNull();
    });
  });

  it("hides an element on history.pushState with previous URL allowlisted",
     async function() {
       setMinTimeout(this, 6000);

       await addFilter(`@@|${TEST_PAGES_URL}/history.html^$document`);
       await addFilter("###elem-hide");

       await expectElemHideHidden({
         url: "history.html",
         elemId: "elem-hide",
         timeout: 4 * HIDETIMEOUT
       });
     });

  it("does not hide an element on history.pushState with new URL allowlisted",
     async function() {
       setMinTimeout(this, 6000);

       if ((isChromiumBased() && (chromiumVersion()[0] < 87)) ||
           (isEdge() && (edgeVersion()[0] < 87))) {
         this.skip(); // no "removeCSS" API available
       }

       await addFilter(`@@|${TEST_PAGES_URL}/history-after-pushState.html^$document`);
       await addFilter("###elem-hide");

       await expectElemHideVisible({
         url: "history.html",
         elemId: "elem-hide",
         timeout: 4 * UNHIDDENTIMEOUT
       });
     });
});

describe("Snippets", function() {
  const forceBg = isFirefox() && firefoxVersion() >= 97;

  it("applies a main snippet for domain with port and wildcard", async function() {
    if (!isChromiumBased()) {
      this.skip();
    }
    await addFilters([
      "webext.*#$#override-property-read overridePropertyRead.fp false"
    ]);

    const tabId = await new Page("http://webext.com:3000/snippet-override-property-read.html", forceBg).loaded;
    await checkElementsHidden(tabId, "[data-expectedresult='fail']");
  });

  it("applies a main snippet [fuzz]", async function() {
    await addFilters([
      `${TEST_PAGES_DOMAIN}#$#json-prune 'data-expectedresult jsonprune aria-label'`,
      `${TEST_PAGES_DOMAIN}#$#json-prune toBeDeletedIfStackNeedle '' callstack`,
      `${TEST_PAGES_DOMAIN}#$#json-prune array.[].target-data`,
      `${TEST_PAGES_DOMAIN}#$#json-prune object.{}.target-data`,
      `${TEST_PAGES_DOMAIN}#$#json-prune arrayWithRemoval.[-].shouldRemove`,
      `${TEST_PAGES_DOMAIN}#$#json-prune objectWithRemoval.{-}.shouldRemove`
    ]);

    const tabId = await new Page("snippet-json-prune.html", forceBg).loaded;
    await checkElementsHidden(tabId, "#json-prune[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#json-stack-needle[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#json-prune-array[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#json-prune-object[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#json-prune-array-remove[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#json-prune-object-remove[data-expectedresult='fail']");
  });

  it("applies an isolated snippet", async function() {
    await addFilters([
      `${TEST_PAGES_DOMAIN}#$#hide-if-contains 'hic-basic-static' div[id]`,
      `${TEST_PAGES_DOMAIN}#$#hide-if-contains 'hic-basic-dynamic' div[id]`,
      `${TEST_PAGES_DOMAIN}#$#hide-if-contains 'hic-search' div[id] .hic-target`,
      `${TEST_PAGES_DOMAIN}#$#hide-if-contains /hic-regex-[2-3]/ div[id]`,
      `${TEST_PAGES_DOMAIN}#$#hide-if-contains hidden span#frame-target`
    ]);

    // Navigate to the test page
    const tabId = await new Page("snippet-hide-if-contains.html", forceBg).loaded;

    // Check that elements indicating failure are hidden
    await checkElementsHidden(tabId, "#awaiting[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#hic-static[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#hic-dynamic-id[data-expectedresult='fail']");
    await checkElementsHidden(tabId, ".hic-target[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#hic-regex-2[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#hic-regex-3[data-expectedresult='fail']");
    const frameElement = await getVisibleElementInFrame(tabId, "frame-target", ["hic-iframe"]);
    expect(frameElement).toBeNull();
  });

  it("applies an isolated snippet with dependency", async function() {
    await addFilters([
      // eslint-disable-next-line quotes
      `${TEST_PAGES_DOMAIN}#$#hide-if-matches-xpath3 '//*[name()="div" and matches(@class,"Spon(.+)sored")]'`,
      // eslint-disable-next-line quotes
      `${TEST_PAGES_DOMAIN}#$#hide-if-matches-xpath3 '//div[div/span[string-join((normalize-space(), following-sibling::span[1]/normalize-space()), " ") = "Failed. Element is not hidden."]]'`,
      // eslint-disable-next-line quotes
      `${TEST_PAGES_DOMAIN}#$#hide-if-matches-xpath3 '//*[name()="div" and xs:decimal(@data-num) > 2.5 ]'`
    ]);

    // Navigate to the test page
    const tabId = await new Page("snippet-hide-if-matches-xpath3", forceBg).loaded;

    // Check that elements indicating failure are hidden
    await checkElementsHidden(tabId, "#xpath-filter1[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#xpath-filter2[data-expectedresult='fail']");
    await checkElementsHidden(tabId, "#xpath-filter3[data-expectedresult='fail']");
  });

  it("does not restart the snippets on history.pushState", async function() {
    setMinTimeout(this, 6000);
    // This snippet tries to override a read-only property "myVar"
    await addFilter("localhost#$#override-property-read myVar 1 false");

    // The test page "history.html" has a window.onerror and looks for how
    // many times "Cannot redefine property: myVar" is thrown and increments
    // a counter stored in "document.body.dataset.myVarDefinitionCounter"
    // At the end of the test, we make a history.pushState to simulate SPA
    // navigation and ensure that the snippet is not re-executed
    const tabId = await new Page("history.html").loaded;

    // Snippet is expected to be called only once (EE-507):
    // only when "history.html" is loaded and not called
    // on History event pushed
    await wait(async() => {
      const result = await executeScript(tabId, () => {
        // This is false by default and is set to true when
        // "Cannot redefine property: myVar" is thrown
        // e.g. snippet is called again
        return document.body.dataset.myVarDefinitionCounter;
      });

      // Ensure there is exactly one definition (aka counter == "1")
      return result === "1";
    }, 4 * HIDETIMEOUT, "Snippet was not called exactly once");
  });

  it("does not run snippets from unprivileged subscription", async function() {
    await EWE.subscriptions.add(subTestCustom1.url);
    await waitForSubscriptionsToDownload();

    // Navigate to the test page
    const tabId = await new Page("snippet-override-property-read.html", forceBg).loaded;

    // Check that it fails to hide elements
    await expect(
      checkElementsHidden(tabId, "[data-expectedresult='fail']")
    ).rejects.toThrow(/Wait timed out|are still visible/);
  });

  it("runs a snippet in a privileged subscription", async function() {
    // subscription with injected-snippet
    await EWE.subscriptions.add(subTestCustom1.url, {privileged: true});
    await waitForSubscriptionsToDownload();

    // Navigate to the test page
    const tabId = await new Page("snippet-override-property-read.html", forceBg).loaded;

    // Check that elements indicating failure are hidden
    await checkElementsHidden(tabId, "[data-expectedresult='fail']");
  });

  describe("Storage tampering detection", function() {
    let tabId;

    beforeEach(async function() {
      await EWE.experiments.overrideFlag("zero-delay-snippet-domains", ["localhost"]);

      await addFilter(
        `${TEST_PAGES_DOMAIN}#$#json-prune 'data-expectedresult jsonprune aria-label'`
      );
      tabId = await new Page("snippet-json-prune.html", forceBg).loaded;
      await sleep(100);
    });

    it("does not detect that the snippets are stored in Storage", async function() {
      const getItemResultLocal = await executeScript(tabId, key => {
        return localStorage.getItem(key);
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");
      expect(getItemResultLocal).toBeNull();

      const getItemResultSession = await executeScript(tabId, key => {
        return sessionStorage.getItem(key);
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");
      expect(getItemResultSession).toBeNull();
    });

    it("does not detect that the snippets are stored in Storage using property accessor", async function() {
      const getItemResultLocal = await executeScript(tabId, key => {
        return localStorage[key];
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");
      expect(getItemResultLocal).toBeNull();

      const getItemResultSession = await executeScript(tabId, key => {
        return sessionStorage[key];
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");
      expect(getItemResultSession).toBeNull();
    });

    it("allows calling Storage.setItem for the key used for snippets", async function() {
      const expectedValue = "test-website-value";

      const getItemResultLocal = await executeScript(tabId, (key, value) => {
        localStorage.setItem(key, value);
        return localStorage.getItem(key);
      }, [CACHED_FILTERS_CONFIG_KEY, expectedValue], "MAIN");

      expect(getItemResultLocal).toBe(expectedValue);

      const getItemResultSession = await executeScript(tabId, (key, value) => {
        sessionStorage.setItem(key, value);
        return sessionStorage.getItem(key);
      }, [CACHED_FILTERS_CONFIG_KEY, expectedValue], "MAIN");

      expect(getItemResultSession).toBe(expectedValue);
    });

    it("allows calling Storage.setItem for a normal key", async function() {
      const otherKey = "other-key";
      const expectedValue = "test-other-value";

      const getItemResultLocal = await executeScript(tabId, (key, value) => {
        localStorage.setItem(key, value);
        return localStorage.getItem(key);
      }, [otherKey, expectedValue], "MAIN");

      expect(getItemResultLocal).toBe(expectedValue);

      const getItemResultSession = await executeScript(tabId, (key, value) => {
        sessionStorage.setItem(key, value);
        return sessionStorage.getItem(key);
      }, [otherKey, expectedValue], "MAIN");

      expect(getItemResultSession).toBe(expectedValue);
    });

    it("allows using the key used for snippets as a property", async function() {
      const expectedValue = "test-website-value";

      const getItemResultLocal = await executeScript(tabId, (key, value) => {
        localStorage[key] = value;
        return localStorage[key];
      }, [CACHED_FILTERS_CONFIG_KEY, expectedValue], "MAIN");

      expect(getItemResultLocal).toBe(expectedValue);

      const getItemResultSession = await executeScript(tabId, (key, value) => {
        sessionStorage[key] = value;
        return sessionStorage[key];
      }, [CACHED_FILTERS_CONFIG_KEY, expectedValue], "MAIN");

      expect(getItemResultSession).toBe(expectedValue);
    });

    it("allows using the key used for a normal key as a property", async function() {
      const otherKey = "other-key";
      const expectedValue = "test-other-value";

      const getItemResultLocal = await executeScript(tabId, (key, value) => {
        localStorage[key] = value;
        return localStorage[key];
      }, [otherKey, expectedValue], "MAIN");

      expect(getItemResultLocal).toBe(expectedValue);

      const getItemResultSession = await executeScript(tabId, (key, value) => {
        sessionStorage[key] = value;
        return sessionStorage[key];
      }, [otherKey, expectedValue], "MAIN");

      expect(getItemResultSession).toBe(expectedValue);
    });

    it("has the correct toString values for localStorage functions", async function() {
      const getToStringResults = () => [
        localStorage.getItem.toString(),
        Function.prototype.toString.call(localStorage.getItem),
        localStorage.setItem.toString(),
        Function.prototype.toString.call(localStorage.setItem),
        localStorage.removeItem.toString(),
        Function.prototype.toString.call(localStorage.removeItem),
        localStorage.clear.toString(),
        Function.prototype.toString.call(localStorage.clear),
        Function.prototype.toString.toString(),
        Function.prototype.toString.call(Function.prototype.toString)
      ];

      const mainResults = await executeScript(tabId, getToStringResults, [], "MAIN");
      const isolatedResults = await executeScript(tabId, getToStringResults, [], "ISOLATED");

      for (const result of mainResults) {
        // Check that the result looks at least a little like we expect. If
        // there's something wrong with our toString code, or how we inject it
        // into the page, it could return something like 'null' or 'undefined'
        // for both main and isolated worlds.
        expect(result).toContain("[native code]");
      }
      // The isolated world has the normal non-shimmed version, so if our
      // hiding is correct this should be identical.
      expect(mainResults).toEqual(isolatedResults);
    });

    it("has the correct toString values for localStorage objects", async function() {
      const expressions = [
        () => localStorage.toString(),
        () => Object.prototype.toString.call(localStorage),
        () => Object.prototype.toString.call(localStorage.getItem)
      ];

      for (const expression of expressions) {
        let mainResult = await executeScript(tabId, expression, [], "MAIN");
        let isolatedResult = await executeScript(tabId, expression, [], "ISOLATED");

        // Check that the result looks at least a little like we expect. If
        // there's something wrong with our toString code, or how we inject it
        // into the page, it could return something like 'null' or 'undefined'
        // for both main and isolated worlds.
        expect(mainResult).toContain("[object");

        // The isolated world has the normal non-shimmed version, so if our
        // hiding is correct this should be identical.
        expect(mainResult).toBe(isolatedResult);
      }
    });

    it("has the correct toString values for sessionStorage functions", async function() {
      const getToStringResults = () => [
        sessionStorage.getItem.toString(),
        Function.prototype.toString.call(sessionStorage.getItem),
        sessionStorage.setItem.toString(),
        Function.prototype.toString.call(sessionStorage.setItem),
        sessionStorage.removeItem.toString(),
        Function.prototype.toString.call(sessionStorage.removeItem),
        sessionStorage.clear.toString(),
        Function.prototype.toString.call(sessionStorage.clear)
      ];

      const mainResults = await executeScript(tabId, getToStringResults, [], "MAIN");
      const isolatedResults = await executeScript(tabId, getToStringResults, [], "ISOLATED");

      for (const result of mainResults) {
        // Check that the result looks at least a little like we expect. If
        // there's something wrong with our toString code, or how we inject it
        // into the page, it could return something like 'null' or 'undefined'
        // for both main and isolated worlds.
        expect(result).toContain("[native code]");
      }
      // The isolated world has the normal non-shimmed version, so if our
      // hiding is correct this should be identical.
      expect(mainResults).toEqual(isolatedResults);
    });

    it("has the correct toString values for sessionStorage objects", async function() {
      const expressions = [
        () => sessionStorage.toString(),
        () => Object.prototype.toString.call(sessionStorage),
        () => Object.prototype.toString.call(sessionStorage.getItem)
      ];

      for (const expression of expressions) {
        let mainResult = await executeScript(tabId, expression, [], "MAIN");
        let isolatedResult = await executeScript(tabId, expression, [], "ISOLATED");

        // Check that the result looks at least a little like we expect. If
        // there's something wrong with our toString code, or how we inject it
        // into the page, it could return something like 'null' or 'undefined'
        // for both main and isolated worlds.
        expect(mainResult).toContain("[object");

        // The isolated world has the normal non-shimmed version, so if our
        // hiding is correct this should be identical.
        expect(mainResult).toBe(isolatedResult);
      }
    });

    it("allows calling Storage.removeItem for the key used for snippets", async function() {
      const value = "test-website-value";

      const getItemResultLocal = await executeScript(tabId, (key, val) => {
        localStorage.setItem(key, val);
        const valueAfterSet = localStorage.getItem(key);
        localStorage.removeItem(key);
        const valueAfterRemove = localStorage.getItem(key);
        return {valueAfterSet, valueAfterRemove};
      }, [CACHED_FILTERS_CONFIG_KEY, value], "MAIN");

      expect(getItemResultLocal.valueAfterSet).toBe(value);
      expect(getItemResultLocal.valueAfterRemove).toBeNull();

      const getItemResultSession = await executeScript(tabId, (key, val) => {
        sessionStorage.setItem(key, val);
        const valueAfterSet = sessionStorage.getItem(key);
        sessionStorage.removeItem(key);
        const valueAfterRemove = sessionStorage.getItem(key);
        return {valueAfterSet, valueAfterRemove};
      }, [CACHED_FILTERS_CONFIG_KEY, value], "MAIN");

      expect(getItemResultSession.valueAfterSet).toBe(value);
      expect(getItemResultSession.valueAfterRemove).toBeNull();
    });

    it("allows calling Storage.clear", async function() {
      const value = "test-website-value";

      const getItemResultLocal = await executeScript(tabId, (key, val) => {
        localStorage.setItem(key, val);
        const valueAfterSet = localStorage.getItem(key);
        localStorage.clear();
        const valueAfterClear = localStorage.getItem(key);
        return {valueAfterSet, valueAfterClear};
      }, [CACHED_FILTERS_CONFIG_KEY, value], "MAIN");

      expect(getItemResultLocal.valueAfterSet).toBe(value);
      expect(getItemResultLocal.valueAfterClear).toBeNull();

      const getItemResultSession = await executeScript(tabId, (key, val) => {
        sessionStorage.setItem(key, val);
        const valueAfterSet = sessionStorage.getItem(key);
        sessionStorage.clear();
        const valueAfterClear = sessionStorage.getItem(key);
        return {valueAfterSet, valueAfterClear};
      }, [CACHED_FILTERS_CONFIG_KEY, value], "MAIN");

      expect(getItemResultSession.valueAfterSet).toBe(value);
      expect(getItemResultSession.valueAfterClear).toBeNull();
    });

    it("localStorage.length works as expected", async function() {
      const result = await executeScript(tabId, key => {
        localStorage.clear();
        const lengthAfterClear = localStorage.length;

        localStorage.setItem(key, "website-value");
        const lengthAfterSet = localStorage.length;

        localStorage.setItem("regular-key", "regular-value");
        const lengthAfterRegular = localStorage.length;

        localStorage.removeItem(key);
        const lengthAfterRemove = localStorage.length;

        return {
          lengthAfterClear,
          lengthAfterSet,
          lengthAfterRegular,
          lengthAfterRemove
        };
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.lengthAfterClear).toBe(0);
      expect(result.lengthAfterSet).toBe(1);
      expect(result.lengthAfterRegular).toBe(2);
      expect(result.lengthAfterRemove).toBe(1);
    });

    it("sessionStorage.length works as expected", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        const lengthAfterClear = sessionStorage.length;

        sessionStorage.setItem(key, "website-value");
        const lengthAfterSet = sessionStorage.length;

        sessionStorage.setItem("regular-key", "regular-value");
        const lengthAfterRegular = sessionStorage.length;

        sessionStorage.removeItem(key);
        const lengthAfterRemove = sessionStorage.length;

        return {
          lengthAfterClear,
          lengthAfterSet,
          lengthAfterRegular,
          lengthAfterRemove
        };
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.lengthAfterClear).toBe(0);
      expect(result.lengthAfterSet).toBe(1);
      expect(result.lengthAfterRegular).toBe(2);
      expect(result.lengthAfterRemove).toBe(1);
    });

    it("hides the config key when using .key when website value is not set", async function() {
      const dummyKey = "foo";
      const result = await executeScript(tabId, (cacheKey, otherKey) => {
        sessionStorage.clear();

        sessionStorage.setItem(cacheKey, "bar");
        sessionStorage.setItem(otherKey, "baz");
        let foundKeys = [];
        for (let i = 0; i < sessionStorage.length + 1; i++) {
          foundKeys.push(sessionStorage.key(i));
        }
        return foundKeys;
      }, [CACHED_FILTERS_CONFIG_KEY, dummyKey], "MAIN");

      expect(result).toBeArrayContainingExactly(
        [CACHED_FILTERS_CONFIG_KEY, dummyKey, null]
      );
    });

    it("shows the config key when using .key when website has set that value", async function() {
      const dummyKey = "foo";
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();

        sessionStorage.setItem(key, "bar");
        let foundKeys = [];
        for (let i = 0; i < sessionStorage.length + 1; i++) {
          foundKeys.push(sessionStorage.key(i));
        }
        return foundKeys;
      }, [dummyKey], "MAIN");

      expect(result).toBeArrayContainingExactly(
        [dummyKey, null]
      );
    });

    it("hides the config key when using spread operator", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const spread = {...sessionStorage};
        const hasConfigKey = key in spread;
        const hasVisibleKey = "visible-key" in spread;
        const keys = Object.keys(spread);
        return {hasConfigKey, hasVisibleKey, keys};
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.hasConfigKey).toBe(false);
      expect(result.hasVisibleKey).toBe(true);
      expect(result.keys).not.toContain(CACHED_FILTERS_CONFIG_KEY);
      expect(result.keys).toContain("visible-key");
    });

    it("hides the config key from Object.keys", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const keys = Object.keys(sessionStorage);
        return {keys, hasConfigKey: keys.includes(key)};
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.hasConfigKey).toBe(false);
      expect(result.keys).toContain("visible-key");
      expect(result.keys).not.toContain(CACHED_FILTERS_CONFIG_KEY);
    });

    it("hides the config key from Object.values", async function() {
      const result = await executeScript(tabId, () => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const values = Object.values(sessionStorage);
        return {values};
      }, [], "MAIN");

      expect(result.values).toContain("visible-value");
      expect(result.values.length).toBe(1);
    });

    it("hides the config key from Object.entries", async function() {
      const result = await executeScript(tabId, () => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const entries = Object.entries(sessionStorage);
        const keys = entries.map(e => e[0]);
        return {entries, keys};
      }, [], "MAIN");

      expect(result.keys).toContain("visible-key");
      expect(result.keys).not.toContain(CACHED_FILTERS_CONFIG_KEY);
      expect(result.entries.length).toBe(1);
    });

    it("hides the config key from for...in iteration", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const keys = [];
        for (const k in sessionStorage) {
          if (Object.prototype.hasOwnProperty.call(sessionStorage, k)) {
            keys.push(k);
          }
        }
        return {keys, hasConfigKey: keys.includes(key)};
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.hasConfigKey).toBe(false);
      expect(result.keys).toContain("visible-key");
      expect(result.keys).not.toContain(CACHED_FILTERS_CONFIG_KEY);
    });

    it("hides the config key from 'in' operator", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const configKeyIn = key in sessionStorage;
        const visibleKeyIn = "visible-key" in sessionStorage;
        return {configKeyIn, visibleKeyIn};
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.configKeyIn).toBe(false);
      expect(result.visibleKeyIn).toBe(true);
    });

    it("hides the config key from JSON.stringify", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem("visible-key", "visible-value");
        const json = JSON.stringify(sessionStorage);
        const parsed = JSON.parse(json);
        return {
          json,
          hasConfigKey: key in parsed,
          hasVisibleKey: "visible-key" in parsed
        };
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.hasConfigKey).toBe(false);
      expect(result.hasVisibleKey).toBe(true);
    });

    it("shows the config key when website sets a value for it", async function() {
      const result = await executeScript(tabId, key => {
        sessionStorage.clear();
        sessionStorage.setItem(key, "website-value");
        sessionStorage.setItem("visible-key", "visible-value");

        const keys = Object.keys(sessionStorage);
        const spread = {...sessionStorage};
        const inOperator = key in sessionStorage;

        return {
          keys,
          spreadKeys: Object.keys(spread),
          spreadValue: spread[key],
          inOperator
        };
      }, [CACHED_FILTERS_CONFIG_KEY], "MAIN");

      expect(result.keys).toContain(CACHED_FILTERS_CONFIG_KEY);
      expect(result.spreadKeys).toContain(CACHED_FILTERS_CONFIG_KEY);
      expect(result.spreadValue).toBe("website-value");
      expect(result.inOperator).toBe(true);
    });
  });

  describe("Context Tampering", function() {
    async function clearExperimentData() {
      await EWE.testing.resetRemoteConfig();
      await EWE.testing.resetExperimentData();
      await EWE.experiments.sync();
    }

    afterEach(async function() {
      await clearExperimentData();
      await EWE.testing.setSentrySampleRate(null);
    });

    it("is possible on regular snippets", async function() {
      // Skip this test on firefox as sometimes the SW is responding very fast
      // so the website is not able to tamper with the context
      // before the snippets run
      if (!isChromiumBased()) {
        this.skip();
      }

      await addFilters([
        `${TEST_PAGES_DOMAIN}#$#json-prune object.{}.target-data`
      ]);

      // Start the telemetry logging
      await restartWithTelemetryTestArgs();
      await EWE.testing.clearBehaviourLoggingState();

      // Start Sentry
      await EWE.testing.setSentrySampleRate(1); // 100% sample rate
      await EWE.sentry.start("test-snippets", "test-env", "1.0");

      const tabId = await new Page("snippet-context-tampering.html", forceBg).loaded;
      // Check that it fails to hide elements
      await expect(
        checkElementsHidden(tabId, "#json-prune-object-tampering")
      ).rejects.toThrow(/Wait timed out|are still visible/);

      // check that telemetry event is being sent
      const behaviourState = await EWE.testing.getBehaviourLoggingState();
      expect(behaviourState).toEqual({
        "snippets:context_tampering": 1
      });
    });

    it("is not possible on lightning snippets", async function() {
      await EWE.experiments.overrideFlag("zero-delay-snippet-domains", ["localhost"]);
      await addFilters([
        `${TEST_PAGES_DOMAIN}#$#json-prune object.{}.target-data`
      ]);


      const tabId = await new Page("snippet-context-tampering.html", forceBg).loaded;
      await checkElementsHidden(tabId, "#json-prune-object-tampering");
    });
  });

  describe("filtersConfig experiment flags", function() {
    it("includes detectionEventEnabled when flag is set",
      async function() {
        await EWE.experiments.overrideFlag(
          "zero-delay-snippet-domains", ["localhost"]
        );
        await EWE.experiments.overrideFlag(
          "snippet-detection-event", true
        );
        await addFilter(
          `${TEST_PAGES_DOMAIN}#$#json-prune` +
          " 'data-expectedresult jsonprune aria-label'"
        );

        const tabId = await new Page(
          "snippet-json-prune.html", forceBg
        ).loaded;
        await sleep(100);

        const config = await executeScript(tabId, key => {
          const raw = sessionStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }, [CACHED_FILTERS_CONFIG_KEY]);

        expect(config).not.toBeNull();
        expect(config.detectionEventEnabled).toBe(true);
      }
    );

    it("detectionEventEnabled is false when flag is not set",
      async function() {
        await EWE.experiments.overrideFlag(
          "zero-delay-snippet-domains", ["localhost"]
        );
        await addFilter(
          `${TEST_PAGES_DOMAIN}#$#json-prune` +
          " 'data-expectedresult jsonprune aria-label'"
        );

        const tabId = await new Page(
          "snippet-json-prune.html", forceBg
        ).loaded;
        await sleep(100);

        const config = await executeScript(tabId, key => {
          const raw = sessionStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }, [CACHED_FILTERS_CONFIG_KEY]);

        expect(config).not.toBeNull();
        expect(config.detectionEventEnabled).toBe(false);
      }
    );
  });
});
