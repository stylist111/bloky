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
        isChromiumBased, waitForSubscriptionToBeSynchronized, sleep,
        waitForAssertion}
  from "./utils.js";
import {subTestCustom1, subTestAllowingFilter} from "./api-fixtures.js";
import {addFilter, EWE} from "./messaging.js";
import browser from "webextension-polyfill";
import sinon from "sinon/pkg/sinon.js";

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

  it("blocks requests from service workers [incognito-skip]", async function() {
    // Firefox doesn't allow service workers in pages when in Incognito Mode
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

    await EWE.filters.add(`|${TEST_PAGES_URL}/image.png^`);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeBlocked();
  });

  it("does not block allowlisted requests from service workers [incognito-skip]", async function() {
    // Firefox doesn't allow service workers in pages when in Incognito Mode
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

    await EWE.filters.add([
      `|${TEST_PAGES_URL}/image.png^`,
      `@@|${TEST_PAGES_URL}/image.png^`
    ]);
    new Page("service-worker.html");
    await new Resource("image.png").expectToBeLoaded();
  });

  it("does not block requests from service workers on an allowlisted frame [mv2-only] [incognito-skip]", async function() {
    // Firefox doesn't allow service workers in pages when in Incognito Mode
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API

    await EWE.filters.add([
      `|${TEST_PAGES_URL}/image.png^`,
      `@@|${TEST_PAGES_URL}^$document`
    ]);
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

  it("allowlists a site based on a $domain", async function() {
    await EWE.filters.add([
      "image.png",
      `@@*$document,domain=${TEST_PAGES_DOMAIN}`
    ]);
    await new Page("image.html").expectResource("image.png").toBeLoaded();
  });

  it("blocks requests when the allowlist filter excludes using $domain", async function() {
    await EWE.filters.add([
      "image.png",
      `@@*$document,domain=~${TEST_PAGES_DOMAIN}`
    ]);
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

    it("injects header for filter with $domain option", async function() {
      await addFilter(`|${TEST_PAGES_URL}$csp=img-src 'none',domain=${TEST_PAGES_DOMAIN}`);
      expect(await checkViolatedDirective()).toEqual("img-src");
    });
  });

  describe("Sitekey allowlisting", function() {
    describe("on MV3 [mv3-only]", function() {
      async function fillSessionStorage(keys) {
        const key = "ewe:test";

        // b.s.s storage limit is 10 Mb, so
        // we start filling from the largest power of 2, less than 10 Mb.
        let currentValueSize = 8 * 1024 * 1024;
        let i = 0;
        while (true) {
          let value = "0".repeat(currentValueSize);

          try {
            let thisKey = key + (i++);
            keys.push(thisKey);
            await EWE.testing._saveSessionStorage(thisKey, value);
          }
          catch (e) {
            if (e.message.includes("Session storage quota bytes exceeded")) {
              currentValueSize /= 2;
              if (currentValueSize <= 16) {
                // now we know we can't write one more pair of 16 characters
                break;
              }
            }
            else {
              throw e;
            }
          }
        }
      }

      it("saves the sitekeys independent of b.s.s limit reached", async function() {
        setMinTimeout(this, 20000);

        const sandbox = sinon.createSandbox();
        sandbox.spy(console, "log");

        let keys = [];

        try {
          // fill the `b.s.s` fully so the next write will fail
          await fillSessionStorage(keys);

          await new Page("image.html?sitekey=1").loaded;

          // wait for saving to be finished and console output to be received
          await new Promise(r => setTimeout(r, 1000));

          // eslint-disable-next-line no-console
          const calls = console.log.getCalls();
          const possibleErrorOutput = calls.find(call =>
            call.args.length > 3 &&
            call.args[0].includes("error") &&
            call.args[2].includes("ewe:sitekeys") &&
            call.args[3].includes("Session storage quota bytes exceeded"));
          expect(possibleErrorOutput).toBeUndefined();
        }
        finally {
          await EWE.testing._removeSessionStorage(keys);
          sandbox.restore();
        }
      });
    });

    describe("on MV2 [mv2-only]", function() {
      it("does not block a request", async function() {
        await addFilter("/image.png^$image");
        await addFilter(`@@$sitekey=${SITEKEY}`);
        let page = new Page("image.html?sitekey=1");
        await page.expectResource("image.png").toBeLoaded();
      });

      it("cleans the sitekeys before new navigation in existing tab", async function() {
        await addFilter("/image.png^$image");
        await addFilter(`@@$sitekey=${SITEKEY}`);
        let page = new Page("image.html?sitekey=1");
        await page.expectResource("image.png").toBeLoaded();

        const tabId = await page.loaded;
        const topFrameId = 0;

        let sitekeys = (await EWE.testing._getSitekeys()).state;
        expect(Object.keys(sitekeys[tabId]).length).toEqual(1);
        expect(Object.keys(sitekeys[tabId][topFrameId]).length).toEqual(1);

        await page.load("iframe.html?sitekey=1");

        sitekeys = (await EWE.testing._getSitekeys()).state;
        expect(Object.keys(sitekeys[tabId]).length).toEqual(2);
        expect(Object.keys(sitekeys[tabId][topFrameId]).length).toEqual(1);
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
  });

  describe("Smart allowlisting", function() {
    it("blocks request after filter expiration [fuzz]", async function() {
      setMinTimeout(this, 30000);
      const expiresAt = Date.now() + 5000;

      await addFilter("/image.png^$image");
      await addFilter(`@@||${TEST_PAGES_DOMAIN}^$document`, {expiresAt});

      // wait for filter expiration
      await sleep(6000);
      await new Page("image.html").expectResource("image.png").toBeBlocked();
    });

    it("blocks request after filter expiration, set with setMetadata [fuzz]", async function() {
      setMinTimeout(this, 30000);
      const allowlistingFilter = `@@||${TEST_PAGES_DOMAIN}^$document`;

      await addFilter("/image.png^$image");
      await addFilter(allowlistingFilter);

      // check that allowlisting filter is active
      // note: for Edge browser it takes a bit longer to apply the allowlisting
      //       filter, so we need to wait for it to be applied.
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // set filter expiration, in 5 seconds
      const expiresAt = Date.now() + 5000;
      await EWE.filters.setMetadata(allowlistingFilter, {expiresAt});

      // wait for filter expiration
      await sleep(6000);
      await new Page("image.html").expectResource("image.png").toBeBlocked();
    });

    it("blocks request after extended expiration [fuzz]", async function() {
      setMinTimeout(this, 30000);

      const autoExtendMs = 5000;
      const expiresAt = Date.now() + autoExtendMs;

      await addFilter("/image.png^$image");
      await addFilter(`@@||${TEST_PAGES_DOMAIN}^$document`, {
        expiresAt,
        autoExtendMs
      });

      // Visit the website before filter expiration to extend filter's expiry
      await sleep(3000);
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // Revisit the website to make sure the filter is still active, and it
      // was extended, it will cause another filter expiration extension
      await sleep(3000);
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // Wait for the filter to expire
      await sleep(autoExtendMs + 1000);
      await new Page("image.html").expectResource("image.png").toBeBlocked();
    });

    it("blocks request after extended expiration, set with setMetadata [fuzz]", async function() {
      setMinTimeout(this, 30000);
      const allowlistingFilter = `@@||${TEST_PAGES_DOMAIN}^$document`;

      await addFilter("/image.png^$image");
      await addFilter(allowlistingFilter);

      // check that allowlisting filter is active
      // note: for edge browser it takes a bit longer to apply the allowlisting
      //       filter, so we need to wait for it to be applied.
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // set filter expiration, in 5 seconds + 5 seconds auto extension
      const autoExtendMs = 5000;
      const expiresAt = Date.now() + autoExtendMs;
      await EWE.filters.setMetadata(allowlistingFilter, {
        expiresAt,
        autoExtendMs
      });

      // Visit the website before filter expiration to extend filter's expiry
      await sleep(3000);
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // Revisit the website to make sure the filter is still active, and it
      // was extended, it will cause another filter expiration extension
      await sleep(3000);
      await waitForAssertion(async() => {
        await new Page("image.html").expectResource("image.png").toBeLoaded();
      });

      // Wait for the filter to expire
      await sleep(autoExtendMs + 1000);
      await new Page("image.html").expectResource("image.png").toBeBlocked();
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

  async function expectUrlLoadingAllowlisted(url, allowingFilters) {
    await waitForAssertion(async() => {
      const isResourceAllowlisted = await browser.runtime.sendMessage({
        type: "ewe-test:isResourceAllowlisted",
        url: `${TEST_PAGES_URL}/${url}`,
        status: "loading"
      });
      expect(isResourceAllowlisted).toEqual(true);
    }, 2000);
    let tabId = await new Page(url).loaded;
    expect(await EWE.filters.getAllowingFilters(tabId))
      .toEqual(allowingFilters);
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
    let allowingFilters = ["@@||localhost^$document"];
    let resource = "image.png";

    // Add filter to show that allowlisting is working
    await addFilter(resource);
    await browser.runtime.sendMessage({type: "ewe-test:subscribeTabsOnUpdated"});

    try {
      await EWE.subscriptions.add(subTestAllowingFilter.url);
      await waitForSubscriptionsToDownload();
      await shouldBeLoaded(url, resource);
      await expectUrlLoadingAllowlisted(url, allowingFilters);

      await EWE.subscriptions.disable(subTestAllowingFilter.url);
      await expectResourceBlocked(url, resource);

      await addFilter(allowingFilters[0]);
      await shouldBeLoaded(url, resource);
      await expectUrlLoadingAllowlisted(url, allowingFilters, true);
    }
    finally {
      await browser.runtime.sendMessage({
        type: "ewe-test:unsubscribeTabsOnUpdated"
      });
    }
  });
});
