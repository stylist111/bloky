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
  from "./test-server-urls.js";
import {Page, waitForInvisibleElement, executeScript, setMinTimeout,
        getVisibleElement, getVisibleElementInFrame, expectElemHideHidden,
        expectElemHideVisible, isFirefox, firefoxVersion,
        UNHIDDENTIMEOUT, HIDETIMEOUT, waitForHighlightedStyle, isEdge,
        edgeVersion, waitForSubscriptionsToDownload, chromiumVersion,
        isChromiumBased, setEndpointResponse, expectElemHideRemoved,
        expectElementToHaveInlineStyle}
  from "./utils.js";
import {subTestCustom1, subAntiCVLocal} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {addFilter, EWE, setFeatureFlags} from "./messaging.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";
import sinon from "sinon/pkg/sinon.js";

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

    it("rejects inline CSS filters until the experiment is turned on", async function() {
      await setFeatureFlags({inlineCss: false});

      await expect(
        EWE.filters.add(`${TEST_PAGES_DOMAIN}#?##inline-css-div {margin-bottom: 0px; margin-top: 0px}`)
      ).rejects.toThrow("FilterError");
    });

    it("applies inline CSS to element", async function() {
      await setFeatureFlags({inlineCss: true});

      const elemId = "inline-css-div";

      await expectElementToHaveInlineStyle(elemId, "");
      await expectElementToHaveInlineStyle("inline-css-div-2", "");

      await addFilter(`${TEST_PAGES_DOMAIN}#?##${elemId} {margin-bottom: 0px; margin-top: 0px}`);

      await expectElementToHaveInlineStyle(elemId, "margin-bottom: 0px !important; margin-top: 0px !important;");
      await expectElementToHaveInlineStyle("inline-css-div-2", "");
    });

    it("only allows inline CSS filters for privileged subscriptions", async function() {
      await setFeatureFlags({inlineCss: true});

      const elemId = "inline-css-div";

      await EWE.subscriptions.add(subTestCustom1.url, {privileged: false});
      await waitForSubscriptionsToDownload();
      await expectElementToHaveInlineStyle(elemId, "");

      await EWE.subscriptions.remove(subTestCustom1.url);

      await EWE.subscriptions.add(subTestCustom1.url, {privileged: true});
      await waitForSubscriptionsToDownload();
      await expectElementToHaveInlineStyle(elemId, "margin-bottom: 0px !important;");
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
  // keep in-sync with `background.js`
  const INJECTED_SNIPPET = "injected-snippet";
  const ISOLATED_SNIPPET = "isolated-snippet";
  const SNIPPET_NOT_APPLIED_ERROR = "Snippet was not applied";
  const MAIN_WORLD = "MAIN";
  const ISOLATED_WORLD = "ISOLATED";
  const WEBPAGE_URL = "image.html";

  async function assertSnippet(pageUrl, extractor, world, expectedArgument = "true") {
    let tabId = await new Page(pageUrl).loaded;

    // If the service worker is suspended just before the new page is opened
    // (like the service worker fuzzing tests do),
    // then there might be a short delay between the page loading and the
    // snippet actually being applied. This is partly us initializing the
    // filter engine, and partly chrome doing chrome things.
    await wait(
      // Snippets arguments are stringified (JSON.string()),
      // so we set true (as boolean), but check "true" (as string).
      async() => {
        let actualArgument = await executeScript(tabId, extractor, null, world);
        return actualArgument == expectedArgument;
      },
      hideTimeout,
      SNIPPET_NOT_APPLIED_ERROR
    );
  }

  async function addAndAssertSnippet(domain, pageUrl, snippet, func, world, snippetArgument = "true") {
    await addFilter(`${domain}#$#${snippet} ${snippetArgument}`);
    await assertSnippet(pageUrl, func, world, snippetArgument);
  }

  const INJECTED_SNIPPET_ARG_EXTRACTOR = () => {
    try {
      let context = JSON.parse(document.body.id);
      return context.arg;
    }
    catch (e) {
      // may not exist yet
      return null;
    }
  };

  it("warns if snippets are not initialized", async function() {
    const sandbox = sinon.createSandbox();
    try {
      sandbox.spy(console, "log");
      await browser.runtime.sendMessage({type: "ewe-test:deinitSnippets"});

      await new Page("element-hiding.html").loaded;
      await wait(async() => {
        // eslint-disable-next-line no-console
        const calls = console.log.getCalls();
        return calls.find(call => call.args &&
          call.args.length > 1 &&
          typeof call.args[1] == "string" &&
          call.args[1].includes("Snippets are not initialized"));
      }, 1000, "No warning output received");
    }
    finally {
      sandbox.restore();
      await browser.runtime.sendMessage({type: "ewe-test:initSnippets"});
    }
  });

  it("applies an injected snippet [fuzz]", async function() {
    await addAndAssertSnippet(
      TEST_PAGES_DOMAIN,
      WEBPAGE_URL,
      INJECTED_SNIPPET,
      INJECTED_SNIPPET_ARG_EXTRACTOR,
      MAIN_WORLD);
  });

  it("applies an injected snippet for domain with port and wildcard", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addAndAssertSnippet(
      "webext.*",
      "http://webext.com:3000/" + WEBPAGE_URL,
      INJECTED_SNIPPET,
      INJECTED_SNIPPET_ARG_EXTRACTOR,
      MAIN_WORLD);
  });

  it("applies 'hide-if-classifies' snippet with no domains", async function() {
    await addAndAssertSnippet(
      "", // no domains
      WEBPAGE_URL,
      "hide-if-classifies",
      INJECTED_SNIPPET_ARG_EXTRACTOR,
      MAIN_WORLD,
      ".selector");
  });

  it("applies an isolated snippet", async function() {
    await addAndAssertSnippet(
      TEST_PAGES_DOMAIN,
      WEBPAGE_URL,
      ISOLATED_SNIPPET,
      () => self.isolated_snippet_dependency && self.isolated_snippet_works,
      ISOLATED_WORLD);
  });

  it("does not restart the snippets on history.pushState", async function() {
    setMinTimeout(this, 6000);

    await addFilter(`${TEST_PAGES_DOMAIN}#$#${INJECTED_SNIPPET} true`);
    let tabId = await new Page("history.html").loaded;
    // Snippet is expected to be called only once (EE-507):
    // only when "history.html" is loaded and not called
    // on History event pushed
    await wait(
      async() => await executeScript(tabId, () => {
        try {
          let context = JSON.parse(document.body.id);
          return context.counter;
        }
        catch (e) {
          // may not exist yet
          return null;
        }
      }, null, MAIN_WORLD) == "1",
      4 * HIDETIMEOUT,
      "Snippet was not called exactly once");
  });

  it("does not deploy snippets not from anti-cv subscription [mv2-only]", async function() {
    await EWE.subscriptions.add(subTestCustom1.url);
    await waitForSubscriptionsToDownload();
    await expect(assertSnippet(
      WEBPAGE_URL, INJECTED_SNIPPET_ARG_EXTRACTOR, MAIN_WORLD))
      .rejects.toThrow(SNIPPET_NOT_APPLIED_ERROR);
  });

  it("runs a snippet in a privileged subscription", async function() {
    // subscription with injected-snippet
    await EWE.subscriptions.add(subTestCustom1.url, {privileged: true});
    await waitForSubscriptionsToDownload();
    await expect(assertSnippet(
      WEBPAGE_URL, INJECTED_SNIPPET_ARG_EXTRACTOR, MAIN_WORLD))
      .resolves.not.toThrow();
  });
});
