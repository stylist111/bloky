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

import {Page, Resource, executeScript, wait, isMV3, setMinTimeout,
        TEST_PAGES_URL,
        TEST_PAGES_DOMAIN, CROSS_DOMAIN_URL, SITEKEY} from "./utils.js";
import {addFilter, EWE} from "./messaging.js";

describe("Blocking", () => {
  it("blocks a request using user filters", async() => {
    await addFilter("/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks a request using subscriptions", async function() {
    if (isMV3())
      this.skip();

    await EWE.subscriptions.add(`${TEST_PAGES_URL}/subscription.txt`);
    await wait(async() => {
      try {
        await new Page("image.html").expectResource("image.png").toBeBlocked();
        return true;
      }
      catch (e) {}
    }, 500, "image.png was not blocked");
  });

  it("does not block a request using a disabled filter", async() => {
    await addFilter("/image.png^$image");
    await EWE.filters.disable(["/image.png^$image"]);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("blocks a request using a re-enabled filter", async function() {
    setMinTimeout(this, 4000);

    await addFilter("/image.png^$image");
    await EWE.filters.disable(["/image.png^$image"]);
    await EWE.filters.enable(["/image.png^$image"]);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("does not block an allowlisted request", async() => {
    await addFilter("/image.png^$image");
    await addFilter("@@/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("handles rewritten srcdoc frames", async() => {
    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await new Page("srcdoc.html").expectResource("image.png").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    await new Page("srcdoc.html").expectResource("image.png").toBeLoaded();
  });

  it("handles requests from service workers", async function() {
    if (isMV3())
      this.skip();

    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}^$document`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("handles $rewrite requests", async() => {
    await addFilter(
      `*.js$rewrite=abp-resource:blank-js,domain=${TEST_PAGES_DOMAIN}`);
    let tabId = await new Page("script.html").loaded;
    let result = await executeScript(
      tabId, () => document.documentElement.dataset.setByScript);
    expect(result).toBeFalsy();
  });

  it("blocks $domain requests", async() => {
    await addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $match-case requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/IMAGE.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
    await addFilter(`|${TEST_PAGES_URL}/image.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $other requests", async() => {
    await addFilter(`$other,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("other.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $third-party requests", async() => {
    await addFilter("image.png$third-party");
    let page = new Page("third-party.html");
    await page.expectResource(`${CROSS_DOMAIN_URL}/image.png`).toBeBlocked();
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("handles $script requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*.js$script`);
    await new Page("script.html").expectResource("script.js").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/script.js$script`);
    await new Page("script.html").expectResource("script.js").toBeLoaded();
  });

  it("handles $stylesheet requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/style.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeLoaded();
  });

  it("handles $subdocument requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/image.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeLoaded();
  });

  it("handles $genericblock requests", async() => {
    await addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await addFilter(`@@|${TEST_PAGES_URL}/*.html$genericblock`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $ping requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    await new Page("ping.html").expectResource("ping-handler").toBeBlocked();
  });

  it("does not block allowlisted $ping requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    await addFilter(`@@|${TEST_PAGES_URL}/ping-handler^$ping`);

    try {
      await new Page("ping.html").expectResource("ping-handler").toBeLoaded();
    }
    catch (e) {
      // The CI Firefox job throws NS_ERROR_ABORT on navigator.sendBeacon()
      // Blocked $ping requests would have ip:null instead
      if (e.message.includes("\"ip\": null") ||
          e.message.startsWith("Connection refused"))
        throw e;
    }
  });

  it("handles $websocket requests", async() => {
    let url = `ws://${TEST_PAGES_DOMAIN}:3001/`;
    await addFilter(`$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeBlocked();
    await addFilter(`@@$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeLoaded();
  });

  it("handles $xmlhttprequest requests", async() => {
    await addFilter(`|${TEST_PAGES_URL}/*.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/image.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request sent by the extension", async function() {
    if (isMV3())
      this.skip();

    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async() => {
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("blocks requests after history.pushState", async() => {
    await addFilter("/image.png^$image");
    await new Page("history.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks requests after history.pushState with previous URL allowlisted",
     async() => {
       await addFilter(`@@|${TEST_PAGES_URL}/history.html^$document`);
       await addFilter("/image.png^$image");
       await new Page("history.html").expectResource("image.png").toBeBlocked();
     });

  it("does not block requests with allowlisted URL after history.pushState",
     async function() {
       setMinTimeout(this, 4000);

       await addFilter(
         `@@|${TEST_PAGES_URL}/history-after-pushState.html^$document`);
       await addFilter("/image.png^$image");
       await new Page("history.html").expectResource("image.png").toBeLoaded();
     });

  const CSP_FILTER = `|${TEST_PAGES_URL}$csp=img-src 'none'`;

  async function checkViolatedDirective(query = "") {
    let tabId = await new Page(`csp.html${query}`).loaded;
    return await executeScript(
      tabId, () => document.documentElement.dataset.violatedDirective);
  }

  describe("Content-Security-Policy", () => {
    it("injects header", async function() {
      setMinTimeout(this, 4000);
      await addFilter(CSP_FILTER);
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async() => {
      await addFilter(CSP_FILTER);
      await addFilter(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by document",
       async() => {
         await addFilter(CSP_FILTER);
         await addFilter(`@@|${TEST_PAGES_URL}/csp.html^$document`);
         expect(await checkViolatedDirective()).toBeFalsy();
       });
  });

  describe("Sitekey allowlisting", () => {
    before(function() {
      if (isMV3())
        this.skip();
    });

    it("does not block a request", async() => {
      await addFilter("/image.png^$image");
      await addFilter(`@@$sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from document", async() => {
      await addFilter("/image.png^$image");
      await addFilter(`@@$document,sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from iframe", async() => {
      await addFilter("/image.png^$image");
      await addFilter(`@@$document,sitekey=${SITEKEY}`);
      let page = new Page("iframe-sitekey.html");
      await page.expectResource("image.png").toBeLoaded();
    });

    it("does not inject header", async() => {
      await addFilter(CSP_FILTER);
      await addFilter(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toBeFalsy();
    });
  });

  describe("Header-based filtering", () => {
    before(function() {
      if (isMV3())
        this.skip();
    });

    it("blocks a request", async() => {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
    });

    it("does not block an allowlisted request", async() => {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}/image.png^`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request allowlisted by header", async() => {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}/image.png^$header`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("only blocks specific content types", async() => {
      addFilter(`|${TEST_PAGES_URL}^$image,header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
      await new Page("header.html").expectResource("script.js").toBeLoaded();
    });

    it("does not block a request from allowlisted document", async() => {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}^$document`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });
  });
});
