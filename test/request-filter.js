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

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN, CROSS_DOMAIN_URL, SITEKEY,
        TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {Page, Resource, executeScript, shouldBeLoaded, supportsWebBundle,
        waitForSubscriptionsToDownload, setMinTimeout, setEndpointResponse,
        isChromiumBased, waitForSubscriptionToBeSynchronized} from "./utils.js";
import {subTestCustom1, subTestAllowingFilter} from "./api-fixtures.js";
import {addFilter, EWE} from "./messaging.js";
import browser from "webextension-polyfill";

describe("Blocking", function() {
  it("blocks a request using user filters [fuzz]", async function() {
    setMinTimeout(this, 6000);

    await addFilter("/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks a request using subscriptions [fuzz]", async function() {
    await EWE.subscriptions.add(subTestCustom1.url);
    await waitForSubscriptionsToDownload();

    await new Page("image-from-subscription.html")
      .expectResource("image-from-subscription.png")
      .toBeBlocked();
  });

  it("blocks a request using custom user subscriptions [fuzz]", async function() {
    let customUserSubscription = `${TEST_ADMIN_PAGES_URL}/custom-user-subscription.txt`;

    await setEndpointResponse(
      customUserSubscription,
      "[Adblock Plus]\n/image-from-subscription.png^$image"
    );

    await EWE.subscriptions.add(customUserSubscription);
    await waitForSubscriptionToBeSynchronized(customUserSubscription);

    await new Page("image-from-subscription.html")
      .expectResource("image-from-subscription.png")
      .toBeBlocked();
  });

  it("does not block from subscription if allow filter is added", async function() {
    await EWE.subscriptions.add(subTestCustom1.url);
    await EWE.filters.add("@@image-from-subscription.png");
    await waitForSubscriptionsToDownload();

    await new Page("image-from-subscription.html")
      .expectResource("image-from-subscription.png")
      .toBeLoaded();
  });

  it("does not block a request using a disabled filter", async function() {
    await addFilter("/image.png^$image");
    await EWE.filters.disable(["/image.png^$image"]);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("blocks a request using a re-enabled filter", async function() {
    await addFilter("/image.png^$image");
    await EWE.filters.disable(["/image.png^$image"]);
    await EWE.filters.enable(["/image.png^$image"]);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("does not block an allowlisted request", async function() {
    await addFilter("/image.png^$image");
    await addFilter("@@/image.png^$image");
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block an allowlisted request after reload", async function() {
    await addFilter("/image.png^$image");
    await addFilter("@@/image.png^$image");
    let page = new Page("image.html");
    await page.loaded;
    page.reload();
    await page.expectResource("image.png").toBeLoaded();
  });

  it("handles rewritten srcdoc frames", async function() {
    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await new Page("srcdoc.html").expectResource("image.png").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/srcdoc.html^$document`);
    await new Page("srcdoc.html").expectResource("image.png").toBeLoaded();
  });

  it("handles requests from service workers [mv2-only] [incognito-skip]", async function() {
    // Firefox doesn't allow service workers in pages when in Incognito Mode
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}^$document`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("handles $rewrite requests", async function() {
    await addFilter(
      `*.js$rewrite=abp-resource:blank-js,domain=${TEST_PAGES_DOMAIN}`);
    let tabId = await new Page("script.html").loaded;
    let result = await executeScript(
      tabId, () => document.documentElement.dataset.setByScript);
    expect(result).toBeFalsy();
  });

  it("blocks $domain requests", async function() {
    await addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks the requests with ports and wildcards in $domain option [mv2-only]", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    await addFilter("/image.png$domain=webext.*");
    await new Page("http://webext.com:3000/image.html")
      .expectResource("http://webext.com:3000/image.png")
      .toBeBlocked();
  });

  it("blocks the requests with wildcards in URL part", async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    // The ".*" wildcard in URL part of request filter is interpreted as
    // "dot followed a sequence of any characters" wildcard,
    // not as "TLD wildcard" that is applied to domains list in content filters
    // and in `$domain` option, so it's converted directly.
    // The filters with ".*" wildcards are not converted into DNR rules.
    await addFilter("||webext.*/image.png");
    await new Page("http://webext.com:3000/image.html")
      .expectResource("http://webext.com:3000/image.png")
      .toBeBlocked();
  });

  for (let testCase of [
    {name: "nested iframe", file: "nested-iframe.html", tags: "[fuzz]"},
    {name: "nested iframe using srcdoc", file: "nested-iframe-srcdoc.html"},
    {name: "nested iframe where the request is aborted", file: "nested-iframe-aborted-request.html"}
  ]) {
    it(`blocks resources in a ${testCase.name} ${testCase.tags}`, async function() {
      await addFilter("/image.png");
      await new Page(testCase.file).expectResource("image.png").toBeBlocked();
    });

    it(`does not block resources in a ${testCase.name} if the top iframe is allowlisted ${testCase.tags}`, async function() {
      await addFilter("/image.png");
      await addFilter(`@@/${testCase.file}$document`);
      await new Page(testCase.file).expectResource("image.png").toBeLoaded();
    });
  }

  it("blocks a request with an opaque origin", async function() {
    await addFilter("/image.png^$image");
    await new Page("image-with-opaque-origin.html")
      .expectResource("image.png").toBeBlocked();
  });

  it("ignores case if $match-case is not specified", async function() {
    await addFilter(`|${TEST_PAGES_URL}/IMAGE.png`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $match-case requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/IMAGE.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
    await addFilter(`|${TEST_PAGES_URL}/image.png$match-case`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks $other requests", async function() {
    await addFilter(`$other,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("other.html").expectResource("image.png").toBeBlocked();
  });

  it("handles $third-party requests", async function() {
    await addFilter("image.png$third-party");
    let page = new Page("third-party.html");
    await page.expectResource(`${CROSS_DOMAIN_URL}/image.png`).toBeBlocked();
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("doesn't block first party requests in a deferred loading iframe", async function() {
    await addFilter("image.png$third-party");
    let page = new Page("iframe-cross-domain-deferred-navigation.html");
    await page.expectResource(`${CROSS_DOMAIN_URL}/image.png`).toBeLoaded();
  });

  it("supports allowlisting of a resource inside a deferred loading iframe", async function() {
    await addFilter("image.png");
    await new Page("iframe-cross-domain-deferred-navigation.html")
      .expectResource(`${CROSS_DOMAIN_URL}/image.png`)
      .toBeBlocked();

    await addFilter(`@@${CROSS_DOMAIN_URL}/image.html$document`);

    await new Page("iframe-cross-domain-deferred-navigation.html")
      .expectResource(`${CROSS_DOMAIN_URL}/image.png`)
      .toBeLoaded();
  });

  it("handles $script requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*.js$script`);
    await new Page("script.html").expectResource("script.js").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/script.js$script`);
    await new Page("script.html").expectResource("script.js").toBeLoaded();
  });

  it("handles $stylesheet requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/style.css$stylesheet`);
    await new Page("style.html").expectResource("style.css").toBeLoaded();
  });

  it("handles $subdocument requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/image.html$subdocument`);
    await new Page("iframe.html").expectResource("image.html").toBeLoaded();
  });

  it("handles $genericblock requests", async function() {
    await addFilter(`/image.png$domain=${TEST_PAGES_DOMAIN}`);
    await addFilter(`@@|${TEST_PAGES_URL}/*.html$genericblock`);
    await new Page("image.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks whole $webbundle requests [mv3-only]", async function() {
    if (!supportsWebBundle()) {
      this.skip();
    }

    await addFilter(`|${TEST_PAGES_URL}/*^$webbundle`);
    await new Page("webbundle.html").expectResource("webext-sample.wbn").toBeBlocked();
    await new Page("webbundle.html").expectResource("dir/a.js").toBeAborted();
    await new Page("webbundle.html").expectResource("dir/c.png").toBeAborted();
  });

  it("blocks subresources inside of a webbundle", async function() {
    await addFilter(`|${TEST_PAGES_URL}/dir/a.js`);
    await addFilter(`|${TEST_PAGES_URL}/dir/c.png`);

    if (supportsWebBundle()) {
      await new Page("webbundle.html").expectResource("webext-sample.wbn").toBeLoaded();
    }

    await new Page("webbundle.html").expectResource("dir/a.js").toBeBlocked();
    await new Page("webbundle.html").expectResource("dir/c.png").toBeBlocked();
  });

  it("blocks $ping requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    await new Page("ping.html").expectResource("ping-handler").toBeBlocked();
  });

  it("does not block allowlisted $ping requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*^$ping`);
    await addFilter(`@@|${TEST_PAGES_URL}/ping-handler^$ping`);

    try {
      await new Page("ping.html").expectResource("ping-handler").toBeLoaded();
    }
    catch (e) {
      // The CI Firefox job throws NS_ERROR_ABORT on navigator.sendBeacon()
      // Blocked $ping requests would have ip:null instead
      if (e.message.includes("\"ip\": null") ||
          e.message.startsWith("Connection refused")) {
        throw e;
      }
    }
  });

  it("handles $websocket requests", async function() {
    let url = `ws://${TEST_PAGES_DOMAIN}:3001/`;
    await addFilter(`$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeBlocked();
    await addFilter(`@@$websocket,domain=${TEST_PAGES_DOMAIN}`);
    await new Page("websocket.html").expectResource(url).toBeLoaded();
  });

  it("handles $xmlhttprequest requests", async function() {
    await addFilter(`|${TEST_PAGES_URL}/*.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeBlocked();
    await addFilter(`@@|${TEST_PAGES_URL}/image.png$xmlhttprequest`);
    await new Page("fetch.html").expectResource("image.png").toBeLoaded();
  });

  it("does not block a request sent by the extension [mv2-only]", async function() {
    await addFilter(`|${TEST_PAGES_URL}/image.png^`);
    await fetch(`${TEST_PAGES_URL}/image.png`);
  });

  it("does not block requests with no filters", async function() {
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("blocks requests after history.pushState", async function() {
    await addFilter("/image.png^$image");
    await new Page("history.html").expectResource("image.png").toBeBlocked();
  });

  it("blocks requests after history.pushState with previous URL allowlisted",
     async function() {
       await addFilter(`@@|${TEST_PAGES_URL}/history.html^$document`);
       await addFilter("/image.png^$image");
       await new Page("history.html").expectResource("image.png").toBeBlocked();
     });

  it("does not block requests with allowlisted URL after history.pushState",
     async function() {
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

  describe("Content-Security-Policy", function() {
    it("injects header", async function() {
      await addFilter(CSP_FILTER);
      expect(await checkViolatedDirective()).toEqual("img-src");
    });

    it("does not inject header for allowlisted requests", async function() {
      await addFilter(CSP_FILTER);
      await addFilter(`@@|${TEST_PAGES_URL}/csp.html^$csp`);
      expect(await checkViolatedDirective()).toBeFalsy();
    });

    it("does not inject header for allowlisted requests by document",
       async function() {
         await addFilter(CSP_FILTER);
         await addFilter(`@@|${TEST_PAGES_URL}/csp.html^$document`);
         expect(await checkViolatedDirective()).toBeFalsy();
       });
  });

  describe("Sitekey allowlisting [mv2-only]", function() {
    it("does not block a request", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from document", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$document,sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.expectResource("image.png").toBeLoaded();
    });

    it("does not inject header", async function() {
      await addFilter(CSP_FILTER);
      await addFilter(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?sitekey=1")).toBeFalsy();
    });

    it("does not block a request from iframe", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$document,sitekey=${SITEKEY}`);
      await new Page("iframe-sitekey.html").expectResource("image.png")
        .toBeLoaded();
    });

    it("does not block a request after a reload", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.loaded;
      page.reload();
      await page.expectResource("image.png").toBeLoaded();
    });

    it("blocks a request after a reload if sitekey filter was removed", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$sitekey=${SITEKEY}`);
      let page = new Page("image.html?sitekey=1");
      await page.expectResource("image.png").toBeLoaded();

      await EWE.filters.remove([`@@$sitekey=${SITEKEY}`]);
      page.reload();
      await page.expectResource("image.png").toBeBlocked();
    });

    it("injects header if sitekey signature is invalild", async function() {
      await addFilter(CSP_FILTER);
      await addFilter(`@@$csp,sitekey=${SITEKEY}`);
      expect(await checkViolatedDirective("?invalid-sitekey=1")).toEqual("img-src");
    });

    it("blocks a request if sitekey signature is invalild", async function() {
      await addFilter("/image.png^$image");
      await addFilter(`@@$sitekey=${SITEKEY}`);
      let page = new Page("image.html?invalid-sitekey=1");
      await page.expectResource("image.png").toBeBlocked();
    });
  });

  describe("Header-based filtering [mv2-only]", function() {
    it("blocks a request", async function() {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
    });

    it("does not block an allowlisted request", async function() {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}/image.png^`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request allowlisted by header", async function() {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}/image.png^$header`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("only blocks specific content types", async function() {
      addFilter(`|${TEST_PAGES_URL}^$image,header=x-header=whatever`);
      await new Page("header.html").expectResource("image.png").toBeBlocked();
      await new Page("header.html").expectResource("script.js").toBeLoaded();
    });

    it("does not block a request from allowlisted document", async function() {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}^$document`);
      await new Page("header.html").expectResource("image.png").toBeLoaded();
    });

    it("does not block a request from allowlisted document after reload", async function() {
      await addFilter(`|${TEST_PAGES_URL}^$header=x-header=whatever`);
      await addFilter(`@@|${TEST_PAGES_URL}^$document`);
      let page = new Page("header.html");
      await page.loaded;
      page.reload();
      await page.expectResource("image.png").toBeLoaded();
    });
  });

  async function expectResourceAllowedByFilter(url, resource, allowingFilter) {
    await shouldBeLoaded(url, resource);
    let isResourceAllowlisted = await browser.runtime.sendMessage({
      type: "ewe-test:isResourceAllowlisted",
      url: `${TEST_PAGES_URL}/${url}`,
      status: "loading"
    });
    expect(await isResourceAllowlisted).toEqual(true);
    let tabId = await new Page(url).loaded;
    expect(await EWE.filters.getAllowingFilters(tabId))
      .toEqual(allowingFilter);
  }

  async function expectResourceBlocked(url, resource) {
    await new Page(url).expectResource(resource).toBeBlocked();
    let tabId = await new Page(url).loaded;
    let isResourceAllowlisted = await browser.runtime.sendMessage({
      type: "ewe-test:isResourceAllowlisted",
      url: `${TEST_PAGES_URL}/${url}`,
      status: "loading"
    });
    expect(await EWE.filters.getAllowingFilters(tabId)).toEqual([]);
    expect(isResourceAllowlisted).toEqual(false);
  }

  it("checks if getAllowingFilters() works when filter is added while present in disabled subscription", async function() {
    setMinTimeout(this, 10000);

    let url = "image.html";
    let allowingFilter = ["@@||localhost^$document"];
    let resource = "image.png";

    // Add filter to show that allowlisting is working
    await addFilter(resource);
    await browser.runtime.sendMessage({type: "ewe-test:subscribeTabsOnUpdated"});

    try {
      await EWE.subscriptions.add(subTestAllowingFilter.url);
      await waitForSubscriptionsToDownload();
      await expectResourceAllowedByFilter(url, resource, allowingFilter);

      await EWE.subscriptions.disable(subTestAllowingFilter.url);
      await expectResourceBlocked(url, resource);

      await addFilter(allowingFilter[0]);
      await expectResourceAllowedByFilter(url, resource, allowingFilter, true);
    }
    finally {
      await browser.runtime.sendMessage({
        type: "ewe-test:unsubscribeTabsOnUpdated"
      });
    }
  });
});
