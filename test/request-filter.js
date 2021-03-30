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

import {Page, Resource, TEST_PAGES_URL, TEST_PAGES_DOMAIN, SITEKEY}
  from "./utils.js";

describe("Blocking", () =>
{
  afterEach(() => Page.removeCurrent());

  it("blocks a request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("does not block an allowlisted request", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add("@@/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("does not block a request from document allowlisted by sitekey", async() =>
  {
    ABP.filters.add("/image.png^$image");
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await new Page("srcdoc.html").expectResource("image.png").toBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    await new Page("srcdoc.html").expectResource("image.png").toBeLoaded();
  });

  it("handles requests from service workers", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}^$document`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("handles $rewrite requests", async() =>
  {
    ABP.filters.add(
      `*.js$rewrite=abp-resource:blank-js,domain=${TEST_PAGES_DOMAIN}`);
    let tabId = await new Page("script.html").loaded();
    let code = "document.documentElement.dataset.setByScript;";
    expect((await browser.tabs.executeScript(tabId, {code}))[0]).toBeFalsy();
  });

  it("blocks $domain requests", async() =>
  {
    ABP.filters.add(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $match-case requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/IMAGE.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $other requests", async() =>
  {
    ABP.filters.add(`$other,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("other.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $third-party requests", async() =>
  {
    ABP.filters.add("image.png$third-party");
    let page = new Page("third-party.html");
    await page.expectResource("http://127.0.0.1:3000/image.png").toBeBlocked();
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("handles $script requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/*.js$script`);
    await new Page("script.html").expectResource("script.js").toBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/script.js$script`);
    await new Page("script.html").expectResource("script.js").toBeLoaded();
  });

  it("handles $stylesheet requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/*.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/style.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeLoaded();
  });

  it("handles $subdocument requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/*.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeBlocked();
    ABP.filters.add(`@@|${TEST_PAGES_URL}/image.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeLoaded();
  });

  it("handles $genericblock requests", async() =>
  {
    ABP.filters.add(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/*.html$genericblock`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $ping requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/*^$ping`);
    await new Page("ping.html").expectResource("ping-handler").toBeBlocked();
  });

  it("does not block allowlisted $ping requests", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/*^$ping`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/ping-handler^$ping`);

    try
    {
      await new Page("ping.html").expectResource("ping-handler").toBeLoaded();
    }
    catch (e)
    {
      // The CI Firefox job throws NS_ERROR_ABORT on navigator.sendBeacon()
      // Blocked $ping requests would have ip:null instead
      if (e.message.includes("\"ip\": null"))
        throw e;
    }
  });

  it("does not block a request sent by the extension", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async() =>
  {
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  describe("Content-Security-Policy", () =>
  {
    async function checkViolatedDirective(query = "")
    {
      let tabId = await new Page(`csp.html${query}`).loaded();
      let code = "document.documentElement.dataset.violatedDirective";
      return (await browser.tabs.executeScript(tabId, {code}))[0];
    }

    it("injects header", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by document", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@|${TEST_PAGES_URL}/csp.html^$document`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by sitekey", async() =>
    {
      ABP.filters.add("*$csp=img-src 'none'");
      ABP.filters.add(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toBeFalsy();
    });
  });

  describe("Header-based filtering", () =>
  {
    it("blocks a request", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
    });

    it("does not block an allowlisted request", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}/image.png^`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request allowlisted by header", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}/image.png^$header`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from allowlisted document", async() =>
    {
      ABP.filters.add(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      ABP.filters.add(`@@|${TEST_PAGES_URL}^$document`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });
  });
});
