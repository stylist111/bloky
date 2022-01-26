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
        getVisibleElement, getVisibleElementInFrame, TEST_PAGES_DOMAIN,
        TEST_PAGES_URL} from "./utils.js";
import {addFilter, EWE, setTestSnippets} from "./messaging.js";

describe("Element Hiding", () =>
{
  async function getElemHideElement(id)
  {
    let tabId = await new Page("element-hiding.html").loaded;
    // hiding elements may take a few ms on CI
    await new Promise(r => setTimeout(r, 200));
    return await getVisibleElement(tabId, id);
  }

  async function getElemHideElementInFrame(id, frameId)
  {
    let tabId = await new Page("iframe-elemhide.html").loaded;
    // hiding elements may take a few ms on CI
    await new Promise(r => setTimeout(r, 200));
    return await getVisibleElementInFrame(tabId, id, frameId);
  }

  it("hides an element", async() =>
  {
    await addFilter("###elem-hide");
    expect(await getElemHideElement("elem-hide")).toBeNull();
  });

  it("hides an element after service worker is suspended", async() =>
  {
    await addFilter("###elem-hide");
    await EWE.debugging.initializerStop();
    expect(await getElemHideElement("elem-hide")).toBeNull();
  });

  it("does not hide an allowlisted element", async() =>
  {
    await addFilter("###elem-hide");
    await addFilter("#@##elem-hide");
    expect(await getElemHideElement("elem-hide")).not.toBeNull();
  });

  for (let type of ["$document", "$elemhide"])
  {
    it(`does not hide elements in allowlisted ${type}`, async function()
    {
      setMinTimeout(this, 4000);

      await addFilter("###elem-hide");
      expect(await getElemHideElement("elem-hide")).toBeNull();

      await addFilter(`@@|${TEST_PAGES_URL}/*.html${type}`);
      expect(await getElemHideElement("elem-hide")).not.toBeNull();
    });

    it(`does not hide frame elements allowlisted by ${type}`, async function()
    {
      setMinTimeout(this, 4000);

      await addFilter("###elem-hide");
      expect(await getElemHideElementInFrame("elem-hide", "elem-hide-frame"))
        .toBeNull();

      await addFilter(`@@|${TEST_PAGES_URL}/iframe-elemhide.html^${type}`);
      expect(await getElemHideElementInFrame("elem-hide", "elem-hide-frame"))
        .not.toBeNull();
    });
  }

  it("does not hide elements in document allowlisted by $elemhide", async() =>
  {
    await addFilter("###elem-hide");
    await addFilter(`@@|${TEST_PAGES_URL}/*.html$elemhide`);
    expect(await getElemHideElement("elem-hide")).not.toBeNull();
  });

  it("does not hide elements through generic filter " +
     "in documents allowlisted by $generichide", async() =>
  {
    await addFilter("###elem-hide");
    await addFilter(`${TEST_PAGES_DOMAIN}###elem-hide-specific`);
    await addFilter(`@@|${TEST_PAGES_URL}$generichide`);

    let tabId = await new Page("element-hiding.html").loaded;
    await new Promise(r => setTimeout(r, 200));
    expect(await getVisibleElement(tabId, "elem-hide")).not.toBeNull();
    expect(await getVisibleElement(tabId, "elem-hide-specific")).toBeNull();
  });

  describe("Element Hiding Emulation", async() =>
  {
    it("hides abp-properties elements", async() =>
    {
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);
      expect(await getElemHideElement("elem-hide-emulation-props")).toBeNull();
    });

    it("hides abp-properties elements after unhide", async function()
    {
      setMinTimeout(this, 9000);

      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#.child1:-abp-properties(background-color: blue)`
      );
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#.child2:-abp-properties(background-color: lime)`
      );

      let tabId = await new Page("element-hiding.html").loaded;
      await new Promise(r => setTimeout(r, 200));
      let elem1 = await getVisibleElement(tabId, "unhide1");
      let elem2 = await getVisibleElement(tabId, "unhide2");
      expect(elem1).toBeNull();
      expect(elem2).toBeNull();

      await executeScript(tabId, async() =>
      {
        document.getElementById("unhide1").parentElement.className = "";
        document.getElementById("unhide2").parentElement.className = "";
      });
      await wait(async() =>
      {
        elem1 = await getVisibleElement(tabId, "unhide1");
        elem2 = await getVisibleElement(tabId, "unhide2");
        return elem1 != null && elem2 != null;
      }, 4000, "Element is not visible");
      expect(elem1).toContain("unhide1");
      expect(elem2).toContain("unhide2");

      await executeScript(tabId, async() =>
      {
        document.getElementById("unhide1").parentElement.className = "parent1";
        document.getElementById("unhide2").parentElement.className = "parent2";
      });
      await wait(async() =>
      {
        elem1 = await getVisibleElement(tabId, "unhide1");
        elem2 = await getVisibleElement(tabId, "unhide2");
        return elem1 == null && elem2 == null;
      }, 4000, "Element is visible");
    });

    it("hides abp-has elements", async() =>
    {
      await addFilter(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-has(>span#elem-hide-emulation-has)`);
      expect(await getElemHideElement("elem-hide-emulation-has")).toBeNull();
    });

    it("hides abp-contains elements", async() =>
    {
      await addFilter(`${TEST_PAGES_DOMAIN}#?#span` +
        ":-abp-contains(elem-hide-emulation-contain-target)");
      expect(await getElemHideElement("elem-hide-emulation-contain"))
        .toBeNull();
    });
  });

  describe("Element collapsing", async() =>
  {
    it("hides the img element of a blocked request", async function()
    {
      setMinTimeout(this, 3000);
      await addFilter("/image.png^$image");

      let tabId = await new Page("element-hiding.html").loaded;
      await waitForInvisibleElement(tabId, "elem-hide-img-request");
    });
  });
});

describe("Snippets", () =>
{
  let snippet = "do";

  before(() => setTestSnippets(snippet));
  after(() => setTestSnippets(null));

  it("applies a snippet", async() =>
  {
    await addFilter(`${TEST_PAGES_DOMAIN}#$#${snippet}`);

    let tabId = await new Page("image.html").loaded;
    expect(await executeScript(tabId, () => self.works)).toBe(true);
  });
});
