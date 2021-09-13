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

import {Page, Resource, TEST_PAGES_URL, TEST_PAGES_DOMAIN, SITEKEY}
  from "./utils.js";
import {addFilter} from "./messaging.js";

describe("Blocking", () =>
{
  afterEach(() => Page.removeCurrent());

  it("blocks a request", async() =>
  {
    await addFilter("/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("does not block an allowlisted request", async() =>
  {
    await addFilter("/image.png^$image");
    await addFilter("@@/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request allowlisted by sitekey", async() =>
  {
    await addFilter("/image.png^$image");
    await addFilter(`@@$sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("does not block a request from document allowlisted by sitekey", async() =>
  {
    await addFilter("/image.png^$image");
    await addFilter(`@@$document,sitekey=${SITEKEY}`);
    let page = new Page("image.html?sitekey=1");
    await page.expectResource("image.png").toBeLoaded();
  });

  it("handles rewritten srcdoc frames", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await new Page("srcdoc.html").expectResource("image.png").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    await new Page("srcdoc.html").expectResource("image.png").toBeLoaded();
  });

  it("handles requests from service workers", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}^$document`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("handles $rewrite requests", async() =>
  {
    await addFilter(
      `*.js$rewrite=abp-resource:blank-js,domain=${TEST_PAGES_DOMAIN}`);
    let tabId = await new Page("script.html").loaded();
    let code = "document.documentElement.dataset.setByScript;";
    expect((await browser.tabs.executeScript(tabId, {code}))[0]).toBeFalsy();
  });

  it("blocks $domain requests", async() =>
  {
    await addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $match-case requests", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/IMAGE.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
    await addFilter(`|${TEST_PAGES_URL}/image.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $other requests", async() =>
  {
    await addFilter(`$other,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("other.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $third-party requests", async() =>
  {
    await addFilter("image.png$third-party");
    let page = new Page("third-party.html");
    await page.expectResource("http://127.0.0.1:3000/image.png").toBeBlocked();
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("handles $script requests", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/*.js$script`);
    await new Page("script.html").expectResource("script.js").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/script.js$script`);
    await new Page("script.html").expectResource("script.js").toBeLoaded();
  });

  it("handles $stylesheet requests", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/*.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/style.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeLoaded();
  });

  it("handles $subdocument requests", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/*.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/image.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeLoaded();
  });

  it("handles $genericblock requests", async() =>
  {
    addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    addFilter(`@@|${TEST_PAGES_URL}/*.html$genericblock`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $ping requests", async() =>
  {
    addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    await new Page("ping.html").expectResource("ping-handler").toBeBlocked();
  });

  it("does not block allowlisted $ping requests", async() =>
  {
    addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    addFilter(`@@|${TEST_PAGES_URL}/ping-handler^$ping`);

    try
    {
      await new Page("ping.html").expectResource("ping-handler").toBeLoaded();
    }
    catch (e)
    {
      // The CI Firefox job throws NS_ERROR_ABORT on navigator.sendBeacon()
      // Blocked $ping requests would have ip:null instead
      if (e.message.includes("\"ip\": null") ||
          e.message.startsWith("Connection refused"))
        throw e;
    }
  });

  it("handles $websocket requests", async() =>
  {
    let url = `ws://${TEST_PAGES_DOMAIN}:3001/`;
    addFilter(`$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeBlocked();
    addFilter(`@@$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeLoaded();
  });

  it("handles $xmlhttprequest requests", async() =>
  {
    addFilter(`|${TEST_PAGES_URL}/*.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeBlocked();
    addFilter(`@@|${TEST_PAGES_URL}/image.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request sent by the extension", async() =>
  {
    addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async() =>
  {
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  describe("Content-Security-Policy", () =>
  {
    const CSP_FILTER = `|${TEST_PAGES_URL}$csp=img-src 'none'`;

    async function checkViolatedDirective(query = "")
    {
      let tabId = await new Page(`csp.html${query}`).loaded();
      let code = "document.documentElement.dataset.violatedDirective";
      return (await browser.tabs.executeScript(tabId, {code}))[0];
    }

    it("injects header", async() =>
    {
      addFilter(CSP_FILTER);
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async() =>
    {
      addFilter(CSP_FILTER);
      addFilter(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by document", async() =>
    {
      addFilter(CSP_FILTER);
      addFilter(`@@|${TEST_PAGES_URL}/csp.html^$document`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by sitekey", async() =>
    {
      addFilter(CSP_FILTER);
      addFilter(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toBeFalsy();
    });
  });

  describe("Header-based filtering", () =>
  {
    it("blocks a request", async() =>
    {
      addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
    });

    it("does not block an allowlisted request", async() =>
    {
      addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      addFilter(`@@|${TEST_PAGES_URL}/image.png^`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request allowlisted by header", async() =>
    {
      addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      addFilter(`@@|${TEST_PAGES_URL}/image.png^$header`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from allowlisted document", async() =>
    {
      addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      addFilter(`@@|${TEST_PAGES_URL}^$document`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });
  });
});
