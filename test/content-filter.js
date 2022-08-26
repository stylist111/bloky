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

import {Page, waitForInvisibleElement, executeScript, setMinTimeout, wait,
        getVisibleElement, getVisibleElementInFrame, isMV3, isFirefox,
        firefoxVersion, TEST_PAGES_DOMAIN, TEST_PAGES_URL, SITEKEY,
        isMV3TestSubsExtension, TEST_MV3_SUBSCRIPTION} from "./utils.js";
import {addFilter, EWE} from "./messaging.js";
import {isFuzzingServiceWorker}
  from "./mocha/mocha-runner.js";

describe("Element Hiding", function() {
  let hideTimeout = isFuzzingServiceWorker() ? 2000 : 1000;
  let collapseTimeout = 2000;
  let elemhideEmulationUpdateTimeout = 4000;
  let unhiddenTimeout = isFuzzingServiceWorker() ? 1000 : 200;

  async function expectElemHideHidden({elemId = "elem-hide",
                                       url = "element-hiding.html",
                                       frameIds} = {}) {
    let tabId = await new Page(url).loaded;
    let getElem = frameIds ?
        () => getVisibleElementInFrame(tabId, elemId, frameIds) :
        () => getVisibleElement(tabId, elemId);

    await wait(
      async() => await getElem() == null,
      hideTimeout,
      `Expected element "${elemId}" on page "${url}" to be hidden, but it was visible.`
    );
  }

  async function expectElemHideVisible({elemId = "elem-hide",
                                        url = "element-hiding.html",
                                        frameIds} = {}) {
    let tabId = await new Page(url).loaded;
    let getElem = frameIds ?
        () => getVisibleElementInFrame(tabId, elemId, frameIds) :
        () => getVisibleElement(tabId, elemId);

    // If we're expecting things to not be hidden, but we check before
    // the filters have a chance to be applied, then we're not really
    // testing anything.
    await new Promise(r => setTimeout(r, unhiddenTimeout));

    let elem = await getElem();
    expect(elem).not.toBeNull();
  }

  it("hides an element", async function() {
    await addFilter("###elem-hide");
    await expectElemHideHidden();
  });

  it("hides an element using bundled MV3 subscriptions", async function() {
    if (!isMV3TestSubsExtension())
      this.skip();

    // The list of bundled subscriptions is passed as an
    // argument to EWE.start in the background.js file.
    await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION.url);
    await expectElemHideHidden();
  });

  it("does not hide an allowlisted element", async function() {
    setMinTimeout(this, 4000);

    await addFilter("###elem-hide");
    await addFilter("#@##elem-hide");
    await expectElemHideVisible();
  });

  for (let type of ["$document", "$elemhide"]) {
    it(`does not hide elements in allowlisted ${type}`, async function() {
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
      it(`does not hide elemented allowlisted by ${type} in a ${nestedFrameTestCase.name} if the top iframe is allowlisted`, async function() {
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

  it("does not hide elements in document allowlisted by $elemhide", async function() {
    await addFilter("###elem-hide");
    await addFilter(`@@|${TEST_PAGES_URL}/*.html$elemhide`);
    await expectElemHideVisible();
  });

  it("does not hide elements in document allowlisted for domain", async function() {
    await addFilter("###elem-hide");
    await addFilter(
      `@@|${TEST_PAGES_URL}/*.html$elemhide,domain=${TEST_PAGES_DOMAIN}`);
    await expectElemHideVisible();
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
    it("hides abp-properties elements", async function() {
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);
      await expectElemHideHidden({elemId: "elem-hide-emulation-props"});
    });

    it("hides abp-properties elements after unhide", async function() {
      setMinTimeout(this, 9000);

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

    it("hides abp-contains elements", async function() {
      await addFilter(`${TEST_PAGES_DOMAIN}#?#span` +
                      ":-abp-contains(elem-hide-emulation-contain-target)");
      await expectElemHideHidden({elemId: "elem-hide-emulation-contain"});
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
  });

  describe("Element collapsing", function() {
    it("hides the img element of a blocked request", async function() {
      await addFilter("/image.png^$image");

      let forceBg = isFirefox() && firefoxVersion() >= 97;
      let tabId = await new Page("element-hiding.html", false, forceBg).loaded;
      await waitForInvisibleElement(tabId, "elem-hide-img-request");
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

  describe("Sitekey allowlisting", function() {
    before(function() {
      if (isMV3())
        this.skip();
    });

    it("has no effect on pages without the sitekey", async function() {
      await addFilter("###elem-hide");
      await addFilter(`@@$elemhide,sitekey=${SITEKEY}`);
      await expectElemHideHidden();
    });

    it("does not hide an element on a sitekey allowlisted page", async function() {
      await addFilter("###elem-hide");
      await addFilter(`@@$elemhide,sitekey=${SITEKEY}`);
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
});

describe("Snippets", function() {
  // keep in-sync with `background.js`
  const injectedSnippet = "injected-snippet";
  const isolatedSnippet = "isolated-snippet";

  async function assertSnippet(snippet, func, world) {
    await addFilter(`${TEST_PAGES_DOMAIN}#$#${snippet} true`);

    let tabId = await new Page("image.html").loaded;

    // If the service worker is suspended just before the new page is opened
    // (like the service worker fuzzing tests do),
    // then there might be a short delay between the page loading and the
    // snippet actually being applied. This is partly us initializing the
    // filter engine, and partly chrome doing chrome things.
    await wait(
      // Snippets arguments are stringified (JSON.string()),
      // so we set true (as boolean), but check "true" (as string).
      async() => await executeScript(tabId, func, null, world) == "true",
      1000,
      "Snippet was not applied"
    );
  }

  it("applies an injected snippet", async function() {
    await assertSnippet(
      injectedSnippet,
      () => document.body.textContent,
      "MAIN");
  });

  it("applies an isolated snippet", async function() {
    await assertSnippet(
      isolatedSnippet,
      () => self.isolated_snippet_dependency && self.isolated_snippet_works,
      "ISOLATED");
  });
});
