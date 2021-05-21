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

import {Page, waitForInvisibleElement, TEST_PAGES_DOMAIN, TEST_PAGES_URL}
  from "./utils.js";

describe("Element Hiding", () =>
{
  afterEach(() => Page.removeCurrent());

  async function getVisibleElement(id)
  {
    let tabId = await new Page("element-hiding.html").loaded();
    let code = `let el = document.getElementById("${id}");
                el.offsetParent ? el.outerHTML : null`;
    return (await browser.tabs.executeScript(tabId, {code}))[0];
  }

  it("hides an element", async() =>
  {
    ABP.filters.add("###elem-hide");
    expect(await getVisibleElement("elem-hide")).toBeNull();
  });

  it("does not hide an allowlisted element", async() =>
  {
    ABP.filters.add("###elem-hide");
    ABP.filters.add("#@##elem-hide");
    expect(await getVisibleElement("elem-hide")).not.toBeNull();
  });

  it("does not hide elements in allowlisted document", async() =>
  {
    ABP.filters.add("###elem-hide");
    ABP.filters.add(`@@|${TEST_PAGES_URL}/*.html$document`);
    expect(await getVisibleElement("elem-hide")).not.toBeNull();
  });

  it("does not hide elements in document allowlisted by $elemhide", async() =>
  {
    ABP.filters.add("###elem-hide");
    ABP.filters.add(`@@|${TEST_PAGES_URL}/*.html$elemhide`);
    expect(await getVisibleElement("elem-hide")).not.toBeNull();
  });

  it("does not hide elements through generic filter " +
     "in documents allowlisted by $generichide", async() =>
  {
    ABP.filters.add("###elem-hide");
    ABP.filters.add(`${TEST_PAGES_DOMAIN}###elem-hide-specific`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}$generichide`);
    expect(await getVisibleElement("elem-hide")).not.toBeNull();
    expect(await getVisibleElement("elem-hide-specific")).toBeNull();
  });

  describe("Element Hiding Emulation", async() =>
  {
    it("hides abp-properties elements", async() =>
    {
      ABP.filters.add(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-properties(background-color: red)`);
      expect(await getVisibleElement("elem-hide-emulation-props")).toBeNull();
    });

    it("hides abp-has elements", async() =>
    {
      ABP.filters.add(
        `${TEST_PAGES_DOMAIN}#?#div:-abp-has(>span#elem-hide-emulation-has)`);
      expect(await getVisibleElement("elem-hide-emulation-has")).toBeNull();
    });

    it("hides abp-contains elements", async() =>
    {
      ABP.filters.add(`${TEST_PAGES_DOMAIN}#?#span` +
        ":-abp-contains(elem-hide-emulation-contain-target)");
      expect(await getVisibleElement("elem-hide-emulation-contain")).toBeNull();
    });
  });

  describe("Element collapsing", async() =>
  {
    it("hides the img element of a blocked request", async() =>
    {
      ABP.filters.add("/image.png^$image");

      let tabId = await new Page("element-hiding.html").loaded();
      await waitForInvisibleElement(tabId, "elem-hide-img-request");
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
      let style = await getElementStyle("elem-hide", "background-color");
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
  });
});
