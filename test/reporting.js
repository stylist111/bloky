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

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN, CROSS_DOMAIN_URL, CROSS_DOMAIN,
        TEST_ADMIN_PAGES_URL, TEST_PAGES_PORT} from "./test-server-urls.js";
import {Page, Popup, setMinTimeout, waitForAssertion, isMV3, isEdge,
        executeScript, getVisibleElement, setEndpointResponse}
  from "./utils.js";
import {wait} from "./polling.js";
import {EWE, addFilter, runInBackgroundPage, getTestEvents, clearTestEvents,
        addOnBlockableListener, removeOnBlockableListener,
        waitForServiceWorkerInitialization, setFeatureFlags}
  from "./messaging.js";
import {VALID_FILTER_TEXT, subTestCustom1} from "./api-fixtures.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

describe("Reporting", function() {
  let elemhideEventOptions = {includeElementHiding: true};
  let unmatchedEventOptions = {includeUnmatched: true, filterType: "all"};
  let timeoutWaitingForLogs = isFuzzingServiceWorker() ? 5000 : 1500;

  it("exposes a mapping between content types and ResourceTypes [fuzz]", async function() {
    let expected = {
      other: "other",
      script: "script",
      image: "image",
      stylesheet: "stylesheet",
      object: "object",
      subdocument: "subdocument",
      websocket: "websocket",
      webbundle: "webbundle",
      webrtc: "webrtc",
      ping: "ping",
      xmlhttprequest: "xmlhttprequest",
      media: "media",
      font: "font",
      popup: "popup",
      csp: "csp",
      header: "header",
      document: "document",
      genericblock: "genericblock",
      elemhide: "elemhide",
      generichide: "generichide",
      background: "image",
      xbl: "other",
      dtd: "other",
      object_subrequest: "object",
      sub_frame: "subdocument",
      beacon: "ping",
      imageset: "image",
      main_frame: "document"
    };

    let result = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "reporting"},
      {op: "getProp", arg: "contentTypesMap"},
      {op: "stringifyMap"}
    ]);

    expect(JSON.parse(result)).toEqual(expected);
  });

  describe("Analytics", function() {
    it("gets the first version [mv2-only]", async function() {
      // This should work in MV3 after
      // https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/300

      let now = new Date();
      let reply = "[Adblock Plus 2.0]";
      reply += `\n! Version: ${now.getFullYear()}`;
      reply += (now.getMonth() + 1).toString().padStart(2, "0");
      reply += now.getDate().toString().padStart(2, "0");
      reply += "0005";
      await setEndpointResponse("/subscriptionForFirstVersion.txt", reply);
      let url = `${TEST_ADMIN_PAGES_URL}/subscriptionForFirstVersion.txt`;

      // only trusted hosts are processed to save the version
      let key = "analytics";
      let analytics = await EWE.testing._getPrefs(key);
      let host = new URL(url).host;
      if (!analytics.trustedHosts.includes(host)) {
        analytics.trustedHosts.push(host);
        await EWE.testing._setPrefs(key, analytics);
      }

      await EWE.subscriptions.add(url);

      await wait(
        async() => await EWE.reporting.getFirstVersion() != "0",
        2000,
        "No resource has been downloaded yet."
      );

      let date = new Date();
      let today = date.toISOString().substring(0, 10).replace(/-/g, "");
      date.setDate(date.getDate() - 1);
      // Yesterday is needed to not fail when the test runs at UTC 00:00
      let yesterday = date.toISOString().substring(0, 10).replace(/-/g, "");
      let expectedDates = RegExp(`(${today}|${yesterday})`);

      expect(await EWE.reporting.getFirstVersion()).toEqual(
        expect.stringMatching(expectedDates));
    });
  });

  it("receives ewe:content-hello message in background.js",
     async function() {
       await browser.runtime.sendMessage({type: "ewe-test:clearMessages"});
       await new Page("element-hiding.html").loaded;
       await new Promise(r => setTimeout(r, 200));
       let getMessage = {type: "ewe-test:getMessages"};
       let messages = await browser.runtime.sendMessage(getMessage);
       expect(messages).toEqual(expect.arrayContaining([
         // "ewe:content-hello" message sent from non-"about:blank" pages
         {type: "ewe:content-hello"},
         getMessage
       ]));
     });

  describe("Diagnostics", function() {
    // There appears to be an issue with Edge in the fuzz tests where sometimes
    // we don't get some of the webRequest events we expect when the service
    // worker is suspended, especially the onComplete ones, and this makes some
    // tests flaky.
    // https://jira.eyeo.com/browse/EE-21
    if (isFuzzingServiceWorker() && isEdge()) {
      this.retries(3);
    }

    setMinTimeout(this, 10000);

    function expectedBlockingFilter(filterText) {
      return {
        text: filterText,
        enabled: true,
        slow: expect.any(Boolean),
        type: "blocking",
        thirdParty: expect.anyNullable("boolean"),
        selector: null,
        csp: expect.anyNullable("string")
      };
    }

    function expectedAllowingFilter(filterText) {
      return {
        csp: null,
        text: filterText,
        enabled: true,
        slow: expect.any(Boolean),
        type: "allowing",
        thirdParty: expect.anyNullable("boolean"),
        selector: null
      };
    }

    function expectedElemhideFilter(filterText) {
      return {
        csp: null,
        text: filterText,
        enabled: true,
        slow: false,
        thirdParty: null,
        type: "elemhide",
        selector: expect.any(String)
      };
    }

    let requestMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "request",
      specificOnly: false
    };

    let allowingMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "allowing"
    };

    let headerMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "header",
      specificOnly: false
    };

    let cspMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "csp",
      specificOnly: false
    };

    let elemhideMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "elemhide"
    };

    let popupMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "popup",
      specificOnly: false
    };
    let unmatchedMatchInfo = {
      docDomain: TEST_PAGES_DOMAIN,
      method: "unmatched",
      specificOnly: false
    };

    let unmatchedMainFrameMatchInfo = {
      docDomain: null,
      method: "unmatched",
      specificOnly: false
    };

    let listenerCounter = 0;

    function expectRewriteMatchInfo(rewrittenUrl) {
      return {
        rewrittenUrl,
        ...requestMatchInfo
      };
    }

    function expectedRequestUrl(url) {
      return expect.objectContaining({
        url,
        frameId: expect.any(Number),
        tabId: expect.any(Number)
      });
    }

    function expectedRequestRelativeUrl(relativeUrl) {
      return expectedRequestUrl(`${TEST_PAGES_URL}/${relativeUrl}`);
    }

    async function expectLoggedMessages(getReceivedEvents, mandatoryEvents,
                                        optionalEvents = []) {
      if (isFuzzingServiceWorker()) {
        await waitForServiceWorkerInitialization();
      }

      // Some of the events we're checking for here may be emitted
      // after the page is done loading, like elemhide.
      await waitForAssertion(() => {
        let receivedEvents = getReceivedEvents();
        expect(receivedEvents)
          .toBeArrayContainingExactly(mandatoryEvents, optionalEvents);
      }, timeoutWaitingForLogs);
    }

    function compareMatchInfo(m1, m2) {
      let keys = [
        "docDomain",
        "rewrittenUrl",
        "specificOnly",
        "method",
        "allowingReason"
      ];
      return keys.every(key => m1[key] === m2[key]);
    }

    function getReceivedEventsFromListener(
      listenerName, tabId, filterToCurrentTab, devToolsEvents = false) {
      let listenerEvents = getTestEvents(listenerName);

      // Some legitimate events make it difficult to write
      // reliable tests. It's easier to just filter out these
      // requests, and assert based on requests on the test
      // pages themselves.
      return listenerEvents
          .map(args => args[0])
          .filter(event => {
            // Favicon request is difficult to sandbox or link to a
            // specific tab, since it's made and cached for a
            // domain.
            let url = event.request.url;
            let isFavicon = url && url.endsWith("/favicon.ico");
            return !isFavicon;
          })
          .filter(event => {
            if (devToolsEvents) {
              return true;
            }
            // If the devtools are open, we might see requests to load
            // the dev tools.
            let url = event.request.url;
            let isDevToolsRequest = url && url.endsWith(".html") &&
                event.request.type == "other";
            return !isDevToolsRequest;
          })
          .filter(event => {
            // Some tests ran into issues with previous other tabs
            // being open, resulting in unexpected events. We filter
            // here rather than in eventOptions because we want to
            // capture all events for the tab, and don't know the
            // tabId to filter on until after we've opened it.
            let isCurrentTab = event.request.tabId == tabId;
            let isIrrelevantTab = filterToCurrentTab && !isCurrentTab;
            return !isIrrelevantTab;
          })
          .filter((event, index, allEvents) => {
            // Some browsers (mostly Firefox) sometimes retry blocked
            // requests. We get the same result the second time, so it
            // looks like a duplicate log, but it's for a different
            // requestId so it isn't actually a duplicate. For testing,
            // we'd rather just filter these duplicates out since they
            // aren't reliable.
            let previousEvents = allEvents.slice(0, index);
            let isRetryRequest = previousEvents.some(prev => {
              let filterMatches = (prev.filter && prev.filter.text) ==
                (event.filter && event.filter.text);
              let matchInfoMatches = compareMatchInfo(
                prev.matchInfo, event.matchInfo
              );
              let requestMatches =
                  prev.request.requestId != event.request.requestId &&
                  prev.request.tabId == event.request.tabId &&
                  prev.request.frameId == event.request.frameId &&
                  prev.request.url == event.request.url;

              return filterMatches &&
                matchInfoMatches &&
                requestMatches;
            });
            return !isRetryRequest;
          });
    }

    async function addNewOnBlockableListener(eventOptions) {
      let listenerName = `reporting.onBlockableItem#${listenerCounter++}`;
      await addOnBlockableListener(listenerName, eventOptions);
      return listenerName;
    }

    async function expectCalled(name) {
      await waitForAssertion(() => {
        let events = getReceivedEventsFromListener(name);
        let called = events.length > 0;
        expect(called).toBeTruthy();
      });
    }

    async function expectNotCalled(name) {
      let check = () => {
        let events = getReceivedEventsFromListener(name);
        let called = events.length > 0;
        expect(called).toBeFalsy();
      };

      // check immediately in case we can exit early. Wait and check again in
      // case the event is still propagating through the system.
      check();
      await new Promise(r => setTimeout(r, 100));
      check();
    }

    async function checkLogging(filters, eventOptions, callbackOrPage,
                                mandatoryEvents, {
                                  filterToCurrentTab = true,
                                  optionalEvents = [],
                                  waitForContentHelloReceived = true
                                } = {}) {
      let callback = callbackOrPage;
      if (typeof callbackOrPage == "string") {
        callback = () => new Page(callbackOrPage).loaded;
      }

      if (filters) {
        await EWE.filters.add(filters);
      }

      let eventName;
      if (typeof eventOptions == "string") {
        eventName = `reporting.onBlockableItem.${eventOptions}`;
      }
      else {
        eventName = await addNewOnBlockableListener(eventOptions);
      }

      clearTestEvents(eventName);

      let tabId = await callback();

      if (waitForContentHelloReceived) {
        // Content script messages (such as "ewe:collapse") can be deferred,
        // waiting for content script to be injected and ready. Thus we might
        // need to wait for "ewe:content-hello" message to be received, deferred
        // message sent and probably it will add more log items,
        // such as elemhiding ones.
        await waitForAssertion(async() => {
          // "0" for main frame
          let contentScriptReady =
            await EWE.testing._isContentHelloReceived(tabId, 0);
          expect(contentScriptReady).toEqual(true);
        }, 3000);
      }

      let getReceivedEvents =
        () => getReceivedEventsFromListener(
          eventName, tabId, filterToCurrentTab);

      await expectLoggedMessages(
        getReceivedEvents, mandatoryEvents, optionalEvents
      );
    }

    it("does not log after listener is removed [fuzz-skip]", async function() {
      // Dynamic adding and removing of event listeners isn't
      // something which MV3 supports well with service workers
      // stopping.

      let listenerName = await addNewOnBlockableListener(null);

      await addFilter("/image.png^$image");
      let page = new Page("image.html");
      await page.loaded;

      await expectCalled(listenerName);

      await removeOnBlockableListener(listenerName);
      clearTestEvents(listenerName);

      await page.reload();
      await expectNotCalled(listenerName);
    });

    it("logs blocking request filter [fuzz]", async function() {
      await checkLogging(
        ["/image.png^$image"],
        "allEventOptions",
        "image.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedBlockingFilter("/image.png^$image"),
          matchInfo: requestMatchInfo,
          request: expectedRequestRelativeUrl("image.png")
        }]);
    });

    it("logs allowlisting request filter", async function() {
      await checkLogging(
        ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
        "allEventOptions",
        "image.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$image`),
          matchInfo: requestMatchInfo,
          request: expectedRequestRelativeUrl("image.png")
        }]
      );
    });

    it("logs third-party requests", async function() {
      await checkLogging(
        ["/image.png$third-party"],
        "allEventOptions",
        "third-party.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("third-party.html")
        }, {
          filter: expectedBlockingFilter("/image.png$third-party"),
          matchInfo: requestMatchInfo,
          request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/image.png`)
        }]
      );
    });

    it("logs rewrite filter [fuzz]", async function() {
      await checkLogging(
        ["*.js$rewrite=abp-resource:blank-js,domain=localhost"],
        "allEventOptions",
        "script.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("script.html")
        }, {
          filter: expectedBlockingFilter(
            "*.js$rewrite=abp-resource:blank-js,domain=localhost"
          ),
          matchInfo: expectRewriteMatchInfo("data:application/javascript,"),
          request: expectedRequestRelativeUrl("script.js")
        }]);
    });

    it("logs the url filter actually applied even if there is an unapplied filter too - blocking", async function() {
      // In MV2, the first filter listed is applied because URL
      // filters have the same priority. In MV3, blocking is
      // prioritized over rewrite (see
      // https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#matching-algorithm).
      let mv2ExpectedLog = {
        filter: expectedBlockingFilter("*.js$rewrite=abp-resource:blank-js,domain=localhost"),
        matchInfo: expectRewriteMatchInfo("data:application/javascript,"),
        request: expectedRequestRelativeUrl("script.js")
      };
      let mv3ExpectedLog = {
        filter: expectedBlockingFilter("*.js$domain=localhost"),
        matchInfo: requestMatchInfo,
        request: expectedRequestRelativeUrl("script.js")
      };
      let expectedLog = isMV3() ? mv3ExpectedLog : mv2ExpectedLog;

      await checkLogging(
        [
          "*.js$rewrite=abp-resource:blank-js,domain=localhost",
          "*.js$domain=localhost"
        ],
        "defaultEventOptions",
        "script.html",
        [expectedLog]);
    });

    it("logs the url filter actually applied even if there is an unapplied filter too - rewrite", async function() {
      // In MV2, the first filter listed is applied, but in MV3 the
      // one with the domain is higher priority.
      let mv2ExpectedLog = {
        filter: expectedBlockingFilter("*.js"),
        matchInfo: requestMatchInfo,
        request: expectedRequestRelativeUrl("script.js")
      };
      let mv3ExpectedLog = {
        filter: expectedBlockingFilter("*.js$rewrite=abp-resource:blank-js,domain=localhost"),
        matchInfo: expectRewriteMatchInfo("data:application/javascript,"),
        request: expectedRequestRelativeUrl("script.js")
      };
      let expectedLog = isMV3() ? mv3ExpectedLog : mv2ExpectedLog;

      await checkLogging(
        [
          "*.js",
          "*.js$rewrite=abp-resource:blank-js,domain=localhost"
        ],
        "defaultEventOptions",
        "script.html",
        [expectedLog]);
    });

    it("logs unmatched for invalid rewrite filter", async function() {
      // At time of writing, rewrite filters are not allowed to
      // redirect to arbitrary resources. It's only ever data urls
      // defined in core. This means when we redirect, we don't have
      // to deal with the redirected request, because it's a data
      // url. This test is meant to catch if this assumption is
      // broken in future and an arbitrary redirect is allowed.
      await expect(addFilter(
        `*.js$rewrite=${TEST_PAGES_URL}/script.js,domain=localhost`
      )).rejects.toThrow("FilterError");
      await checkLogging(
        [],
        "allEventOptions",
        "script.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("script.html")
        }, {
          filter: null,
          matchInfo: unmatchedMatchInfo,
          request: expectedRequestRelativeUrl("script.js")
        }]);
    });

    // is not feasible in MV3: "filter_unknown_option" thrown
    it("logs blocking $header filter [mv2-only]", async function() {
      await checkLogging(
        [`|${TEST_PAGES_URL}$header=x-header=whatever`],
        "allEventOptions",
        "header.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("header.html")
        }, {
          filter: expectedBlockingFilter(
            `|${TEST_PAGES_URL}$header=x-header=whatever`
          ),
          matchInfo: headerMatchInfo,
          request: expectedRequestRelativeUrl(
            "image.png?header-name=x-header&header-value=whatever"
          )
        }, {
          filter: expectedBlockingFilter(
            `|${TEST_PAGES_URL}$header=x-header=whatever`
          ),
          matchInfo: headerMatchInfo,
          request: expectedRequestRelativeUrl(
            "script.js?header-name=x-header&header-value=whatever"
          )
        }]);
    });

    // is not feasible in MV3: "filter_unknown_option" thrown
    it("logs allowlisting $header filter [mv2-only]", async function() {
      await checkLogging(
        [
          `|${TEST_PAGES_URL}$header=x-header=whatever`,
          `@@|${TEST_PAGES_URL}$header`
        ],
        "allEventOptions",
        "header.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("header.html")
        }, {
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}$header`
          ),
          matchInfo: headerMatchInfo,
          request: expectedRequestRelativeUrl(
            "image.png?header-name=x-header&header-value=whatever"
          )
        }, {
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}$header`
          ),
          matchInfo: headerMatchInfo,
          request: expectedRequestRelativeUrl(
            "script.js?header-name=x-header&header-value=whatever"
          )
        }]);
    });

    // is not feasible in MV3: "filter_unknown_option" thrown
    it("logs $header filter allowlisted by non-header filter [mv2-only]", async function() {
      await checkLogging(
        [
          `|${TEST_PAGES_URL}$header=x-header=whatever`,
          `@@|${TEST_PAGES_URL}`
        ],
        "allEventOptions",
        "header.html",
        [{
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("header.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
          matchInfo: requestMatchInfo,
          request: expectedRequestRelativeUrl(
            "image.png?header-name=x-header&header-value=whatever"
          )
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}`),
          matchInfo: requestMatchInfo,
          request: expectedRequestRelativeUrl(
            "script.js?header-name=x-header&header-value=whatever"
          )
        }]);
    });

    it("logs blocking $csp filter [fuzz]", async function() {
      await checkLogging(
        [`|${TEST_PAGES_URL}$csp=img-src 'none'`],
        "allEventOptions",
        "csp.html",
        [{
          filter: expectedBlockingFilter(
            `|${TEST_PAGES_URL}$csp=img-src 'none'`
          ),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("csp.html")
        }]);
    });

    it("logs blocking $csp filter with domain option", async function() {
      let cspFilter = `$csp=img-src 'none',domain=${TEST_PAGES_DOMAIN}`;
      await checkLogging(
        [cspFilter],
        "allEventOptions",
        "csp.html",
        [{
          filter: expectedBlockingFilter(cspFilter),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("csp.html")
        }]);
    });

    it("logs multiple blocking $csp filters if multiple apply", async function() {
      await checkLogging(
        [
          `|${TEST_PAGES_URL}$csp=img-src 'none'`,
          `|${TEST_PAGES_URL}$csp=img-src 127.0.0.1`
        ],
        "allEventOptions",
        "csp.html",
        [{
          filter: expectedBlockingFilter(
            `|${TEST_PAGES_URL}$csp=img-src 'none'`
          ),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("csp.html")
        }, {
          filter: expectedBlockingFilter(
            `|${TEST_PAGES_URL}$csp=img-src 127.0.0.1`
          ),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("csp.html")
        }]);
    });

    it("logs allowlisting $csp filter", async function() {
      await checkLogging(
        [`|${TEST_PAGES_URL}$csp=img-src 'none'`, `@@|${TEST_PAGES_URL}$csp`],
        "allEventOptions",
        "csp.html",
        [{
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$csp`),
          matchInfo: cspMatchInfo,
          request: expectedRequestRelativeUrl("csp.html")
        }, {
          filter: null,
          matchInfo: unmatchedMatchInfo,
          request: expectedRequestRelativeUrl("image.png")
        }]);
    });

    it("logs allowlisting $document filter [fuzz]", async function() {
      await checkLogging(
        [`@@|${TEST_PAGES_URL}$document`],
        "allEventOptions",
        "image.html",
        [{
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            allowingReason: "document"
          },
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("image.png")
        }],
        {
          optionalEvents: [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              allowingReason: "document"
            },
            request: expectedRequestUrl(TEST_PAGES_URL)
          }],
          waitForContentHelloReceived: false
        }
      );
    });

    it("logs allowlisting $document filter after cross domain navigation", async function() {
      // In fuzz mode the page is loaded already navigated to "image.html"
      // without having a history, so no "cross-domain-navigation.html" items
      // are available and thus missing.
      // See https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/493
      if (isFuzzingServiceWorker()) {
        return;
      }

      await checkLogging(
        [`@@|${TEST_PAGES_URL}$document`, `@@|${CROSS_DOMAIN_URL}$document`],
        "allEventOptions",
        async() => {
          let tabId = await new Page("cross-domain-navigation.html").loaded;
          // This page only has all the events we expect after it's done its
          // navigations.
          await wait(async() => {
            let tab = await browser.tabs.get(tabId);
            return tab.url.endsWith("image.html") && tab.status == "complete";
          });

          // Sometimes "image.html" page loading is finished before "image.png"
          // is loaded, so awaiting for it to avoid the flakiness. (EE-221)
          await waitForAssertion(async() => {
            const logs = getTestEvents("reporting.onBlockableItem.unmatchedEventOptions");
            expect(logs).toEqual(expect.arrayContaining([
              expect.arrayContaining([expect.objectContaining({
                request: expectedRequestUrl(`http://${CROSS_DOMAIN}:${TEST_PAGES_PORT}/image.png`)
              })])
            ]));
          });

          return tabId;
        },
        [{
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            allowingReason: "document"
          },
          request: expectedRequestRelativeUrl("cross-domain-navigation.html")
        }, {
          filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("cross-domain-navigation.html")
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            allowingReason: "document"
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.html`,
            frameId: expect.any(Number),
            tabId: expect.any(Number)
          })
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.html`,
            frameId: expect.any(Number),
            tabId: expect.any(Number),
            type: "main_frame"
          })
        }, {
          filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            specificOnly: false
          },
          request: expect.objectContaining({
            url: `${CROSS_DOMAIN_URL}/image.png`,
            frameId: expect.any(Number),
            tabId: expect.any(Number),
            type: "image"
          })
        }],
        {
          // These extra frame events can come from our frame state doing its
          // best to figure out the frame when we need to make a blocking
          // decision, but haven't received the frame events yet. The document
          // URL we have access to construct the frame state initially is only
          // the domain part of the full document URL.
          optionalEvents: [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              allowingReason: "document"
            },
            request: expectedRequestUrl(TEST_PAGES_URL)
          }, {
            filter: expectedAllowingFilter(`@@|${CROSS_DOMAIN_URL}$document`),
            matchInfo: {
              ...allowingMatchInfo,
              docDomain: CROSS_DOMAIN,
              allowingReason: "document"
            },
            request: expectedRequestUrl(CROSS_DOMAIN_URL)
          }]
        }
      );
    });

    for (let option of ["$elemhide", "$genericblock", "$generichide"]) {
      it(`logs allowlisting ${option} filter`, async function() {
        let specificOnly = option == "$genericblock";
        await checkLogging(
          [`@@|${TEST_PAGES_URL}${option}`],
          "allEventOptions",
          "image.html",
          [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}${option}`),
            matchInfo: {
              ...allowingMatchInfo,
              allowingReason: option.substring(1)
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: {
              ...unmatchedMatchInfo,
              docDomain: null,
              specificOnly
            },
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: {
              ...unmatchedMatchInfo,
              specificOnly
            },
            request: expectedRequestRelativeUrl("image.png")
          }],
          {
            optionalEvents: [{
              filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}${option}`),
              matchInfo: {
                ...allowingMatchInfo,
                allowingReason: option.substring(1)
              },
              request: expectedRequestUrl(TEST_PAGES_URL)
            }]
          }
        );
      });
    }

    it("logs allowlisting for different domain iframe", async function() {
      await checkLogging(
        [`@@|${TEST_PAGES_URL}/image.html^$document`],
        "allowingEventOptions",
        () => new Page(`${CROSS_DOMAIN_URL}/iframe.html`, true).loaded,
        [{
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}/image.html^$document`
          ),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            allowingReason: "document"
          },
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}/image.html^$document`
          ),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: CROSS_DOMAIN,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("image.html")
        }, {
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}/image.html^$document`
          ),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: TEST_PAGES_DOMAIN,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("image.png")
        }]
      );
    });

    it("logs allowlisting for nested iframe", async function() {
      await checkLogging(
        [`@@${TEST_PAGES_URL}/iframe.html$document`],
        "allowingEventOptions",
        "nested-iframe.html",
        [{
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/iframe.html$document`
          ),
          matchInfo: {...allowingMatchInfo, allowingReason: "document"},
          request: expectedRequestRelativeUrl("iframe.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/iframe.html$document`
          ),
          matchInfo: {...allowingMatchInfo, specificOnly: false},
          request: expectedRequestRelativeUrl("iframe.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/iframe.html$document`
          ),
          matchInfo: {...allowingMatchInfo, specificOnly: false},
          request: expectedRequestRelativeUrl("image.png")
        }],
        {
          // see getParentFrameInfoFromWebrequestDetails()
          // https://bugs.chromium.org/p/chromium/issues/detail?id=725917
          optionalEvents: [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.html")
          }]
        }
      );
    });

    it("logs allowlisting for contents of aborted iframe", async function() {
      await checkLogging(
        [`@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`],
        "allowingEventOptions",
        "nested-iframe-aborted-request.html",
        [{
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
          ),
          matchInfo: {...allowingMatchInfo, allowingReason: "document"},
          request: expectedRequestRelativeUrl("nested-iframe-aborted-request.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
          ),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("nested-iframe-aborted-request.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
          ),
          matchInfo: {...allowingMatchInfo, specificOnly: false},
          request: expectedRequestRelativeUrl("image.png")
        }],
        {
          optionalEvents: [{
            // This event may appear depending on the order frames are
            // loaded and then committed. If it's committed first (eg
            // firefox), we correctly get this event before the frame
            // ultimately errors. If it would only be committed later
            // (eg chrome), we don't get this event. Blocking should
            // be the same either way.
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("iframe.html?delay=500")
          }, {
            // see getParentFrameInfoFromWebrequestDetails()
            // https://bugs.chromium.org/p/chromium/issues/detail?id=725917
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-aborted-request.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.html")
          }]
        }
      );
    });

    it("does not use aborted iframe's url to add allowlisting filters", async function() {
      // This one is unusual in that the filter applies to the URL
      // which is aborted. So we might see the frame being committed
      // and the request for the frame, but we shouldn't see
      // allowlisting applied to the contents of the frame that are
      // injected with Javascript.
      await checkLogging(
        [`@@${TEST_PAGES_URL}/iframe.html$document`],
        "allowingEventOptions",
        "nested-iframe-aborted-request.html",
        [],
        {
          optionalEvents: [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("iframe.html?delay=500")
          }, {
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/iframe.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("iframe.html?delay=500")
          }]
        }
      );
    });

    it("logs allowlisting for nested iframe when the inner frame is set by srcdoc", async function() {
      await checkLogging(
        [`@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`],
        "allowingEventOptions",
        "nested-iframe-srcdoc.html",
        [{
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
          ),
          matchInfo: {...allowingMatchInfo, allowingReason: "document"},
          request: expectedRequestRelativeUrl("nested-iframe-srcdoc.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
          ),
          matchInfo: {
            ...allowingMatchInfo,
            docDomain: null,
            specificOnly: false
          },
          request: expectedRequestRelativeUrl("nested-iframe-srcdoc.html")
        }, {
          filter: expectedAllowingFilter(
            `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
          ),
          matchInfo: {...allowingMatchInfo, specificOnly: false},
          request: expectedRequestRelativeUrl("image.png")
        }],
        {
          // see getParentFrameInfoFromWebrequestDetails()
          // https://bugs.chromium.org/p/chromium/issues/detail?id=725917
          optionalEvents: [{
            filter: expectedAllowingFilter(
              `@@${TEST_PAGES_URL}/nested-iframe-srcdoc.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.html")
          }]
        }
      );
    });

    it("logs element hiding filter [fuzz]", async function() {
      await checkLogging(
        ["###elem-hide"],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: expectedElemhideFilter("###elem-hide"),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs element hiding filter with remove filters", async function() {
      await checkLogging(
        ["###elem-hide {remove:true;}"],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: {
            ...expectedElemhideFilter("###elem-hide {remove:true;}"),
            type: "elemhideemulation",
            remove: true
          },
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs element hiding filter with inline CSS filters", async function() {
      await setFeatureFlags({inlineCss: true});

      await checkLogging(
        ["###inline-css-div {color:#0000bb;}"],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: {
            ...expectedElemhideFilter("###inline-css-div {color:#0000bb;}"),
            type: "elemhideemulation",
            css: {color: "#0000bb"}
          },
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs user element hiding filter that is also listed in a subscription once [mv2-only]", async function() {
      await EWE.subscriptions.add(subTestCustom1.url);
      await checkLogging(
        ["###elem-hide"],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: expectedElemhideFilter("###elem-hide"),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("handles invalid elemhide selectors", async function() {
      await checkLogging(
        [
          "####.wj-header-usercookies", // invalid selector
          "###elem-hide"
        ],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: expectedElemhideFilter("###elem-hide"),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]);
    });

    it("logs element hiding filter for a given tab [fuzz-skip]", async function() {
      // Filtering by tabs can't work reliably when service worker
      // is suspended because the event listener can't be attached
      // in the first turn of the event loop.

      let page = new Page("element-hiding.html");
      let tabId = await page.loaded;
      await checkLogging(
        ["###elem-hide"],
        {
          tabId,
          ...elemhideEventOptions
        },
        () => page.reload(true),
        [{
          filter: expectedElemhideFilter("###elem-hide"),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }],
        {filterToCurrentTab: false}
      );
    });

    it("logs element hiding filter dynamically [fuzz]", async function() {
      setMinTimeout(this, 25000);

      let text = `${TEST_PAGES_DOMAIN}###element-hiding-dyn`;
      await checkLogging(
        [text],
        "elemhideEventOptions",
        async() => {
          let tabId = await new Page("image.html").loaded;
          await executeScript(tabId, async() => {
            let div = document.createElement("div");
            div.id = "element-hiding-dyn";
            div.style = "display: block !important;";
            div.innerHTML = "Target";
            document.body.appendChild(div);
          });
          await wait(
            async() =>
              await getVisibleElement(tabId, "element-hiding-dyn") == null,
            isMV3() ? 10000 : 200,
            "Element is not visible"
          );
          await new Promise(r => setTimeout(r, isMV3() ? 10000 : 1500));
          return tabId;
        },
        [{
          filter: expectedElemhideFilter(text),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("image.html")
        }]
      );
    });

    it("logs element hiding emulation filter [fuzz]", async function() {
      let text = TEST_PAGES_DOMAIN +
          "#?#.child1:-abp-properties(background-color: blue)";
      await checkLogging(
        [text],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: {
            ...expectedElemhideFilter(text),
            type: "elemhideemulation"
          },
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs element hiding emulation filter with remove", async function() {
      let text = TEST_PAGES_DOMAIN +
          "#?#.child1:-abp-properties(background-color: blue) {remove:true;}";
      await checkLogging(
        [text],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: {
            ...expectedElemhideFilter(text),
            type: "elemhideemulation",
            remove: true
          },
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("handles invalid element hiding emulation selectors", async function() {
      let text = TEST_PAGES_DOMAIN +
        "#?#.child1:-abp-properties(background-color: blue)";
      await checkLogging(
        [
          TEST_PAGES_DOMAIN + "#?#.wj-header-usercookies:-abp-properties(background-color: blue)", // invalid selector
          text
        ],
        "elemhideEventOptions",
        "element-hiding.html",
        [{
          filter: {
            ...expectedElemhideFilter(text),
            type: "elemhideemulation"
          },
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs all items", async function() {
      await checkLogging(
        ["###elem-hide", VALID_FILTER_TEXT],
        "allEventOptions",
        "element-hiding.html",
        [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }, {
          filter: expectedBlockingFilter(VALID_FILTER_TEXT),
          matchInfo: requestMatchInfo,
          request: expectedRequestRelativeUrl("image.png")
        }, {
          filter: expectedElemhideFilter("###elem-hide"),
          matchInfo: elemhideMatchInfo,
          request: expectedRequestRelativeUrl("element-hiding.html")
        }]
      );
    });

    it("logs for the requested tab [fuzz-skip]", async function() {
      // Filtering by tabs can't work reliably when service worker
      // is suspended because the event listener can't be attached
      // in the first turn of the event loop.

      await addFilter(VALID_FILTER_TEXT);
      // The delay is used to prevent that the page loads before the listener is
      // effectively added.
      let page = new Page("image.html?delay=500");
      let tabId = await page.created;
      let [listenerName1, listenerName2] = await Promise.all(
        [tabId, tabId + 1].map(id => addNewOnBlockableListener({tabId: id}))
      );
      await page.loaded;

      await expectCalled(listenerName1);
      await expectNotCalled(listenerName2);
    });

    it("logs snippets filter [fuzz]", async function() {
      // keep in-sync with `background.js`
      const snippet = "injected-snippet";

      await checkLogging(
        [`${TEST_PAGES_DOMAIN}#$#${snippet} true`],
        "defaultEventOptions",
        "image.html",
        [{
          filter: {
            csp: null,
            text: `${TEST_PAGES_DOMAIN}#$#${snippet} true`,
            enabled: true,
            slow: false,
            thirdParty: null,
            type: "snippet",
            selector: null
          },
          matchInfo: {
            docDomain: TEST_PAGES_DOMAIN,
            method: "snippet"
          },
          request: expect.objectContaining({
            frameId: expect.any(Number),
            tabId: expect.any(Number),
            url: expect.any(String)
          })
        }]
      );
    });

    it("logs blocking popup filter [fuzz]", async function() {
      let opener = new Page("popup-opener.html");
      let sourceTabId = await opener.loaded;
      await checkLogging(
        ["*popup.html^$popup"],
        "allEventOptions",
        async() => {
          let popup = new Popup("link", opener);
          await popup.blocked;
          return sourceTabId;
        },
        [{
          filter: expectedBlockingFilter("*popup.html^$popup"),
          matchInfo: popupMatchInfo,
          request: expectedRequestRelativeUrl("popup.html")
        }],
        {optionalEvents: [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("popup-opener.html")
        }]}
      );
    });

    it("logs allowlisting popup filter", async function() {
      let opener = new Page("popup-opener.html");
      let sourceTabId = await opener.loaded;
      await checkLogging(
        ["*popup.html^$popup", `@@|${TEST_PAGES_URL}/popup.html^$popup`],
        "allEventOptions",
        async() => {
          let popup = new Popup("link", opener);
          await popup.blocked;
          return sourceTabId;
        },
        [{
          filter: expectedAllowingFilter(
            `@@|${TEST_PAGES_URL}/popup.html^$popup`
          ),
          matchInfo: popupMatchInfo,
          request: expectedRequestRelativeUrl("popup.html")
        }],
        {optionalEvents: [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("popup-opener.html")
        }]}
      );
    });

    it("logs blocking third-party popup filter", async function() {
      let opener = new Page("popup-opener.html");
      let sourceTabId = await opener.loaded;
      await checkLogging(
        [`popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`],
        "allEventOptions",
        async() => {
          let popup = new Popup("third-party-link", opener);
          await popup.blocked;
          return sourceTabId;
        },
        [{
          filter: expectedBlockingFilter(
            `popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`
          ),
          matchInfo: popupMatchInfo,
          request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/popup.html`)
        }],
        {optionalEvents: [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("popup-opener.html")
        }]}
      );
    });

    it("logs allowlisted third-party popup filter", async function() {
      let opener = new Page("popup-opener.html");
      let sourceTabId = await opener.loaded;
      await checkLogging(
        ["*popup.html^$popup", `@@|${CROSS_DOMAIN_URL}/popup.html^$popup`],
        "allEventOptions",
        async() => {
          let popup = new Popup("third-party-link", opener);
          await popup.blocked;
          return sourceTabId;
        },
        [{
          filter: expectedAllowingFilter(
            `@@|${CROSS_DOMAIN_URL}/popup.html^$popup`
          ),
          matchInfo: popupMatchInfo,
          request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/popup.html`)
        }],
        {optionalEvents: [{
          filter: null,
          matchInfo: unmatchedMainFrameMatchInfo,
          request: expectedRequestRelativeUrl("popup-opener.html")
        }]}
      );
    });

    it("logs requests sent by the extension [mv2-only]", async function() {
      // DNR doesn't have this protection mechanism
      await checkLogging(
        [],
        "allEventOptions",
        () => fetch(`${TEST_PAGES_URL}/image.png`),
        [{
          filter: null,
          matchInfo: {
            method: "allowing",
            allowingReason: "extensionInitiated"
          },
          request: expectedRequestRelativeUrl("image.png")
        }],
        {
          filterToCurrentTab: false,
          waitForContentHelloReceived: false
        }
      );
    });

    describe("Unmatched requests", function() {
      it("logs all unmatched requests on the image page [fuzz]", async function() {
        await checkLogging(
          [],
          "unmatchedEventOptions",
          "image.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs unmatched requests for the requested tab [fuzz-skip]", async function() {
        // Filtering by tabs can't work reliably when service worker
        // is suspended because the event listener can't be attached
        // in the first turn of the event loop.

        let page = new Page("image.html");
        let tabId = await page.loaded;

        let otherTabListenerName = await addNewOnBlockableListener({
          includeUnmatched: true,
          tabId: tabId + 1
        });

        // small pause for unmatched events to finish coming through
        await new Promise(r => setTimeout(r, 50));

        await checkLogging(
          [],
          {...unmatchedEventOptions, tabId},
          () => page.reload(true),
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
        await expectNotCalled(otherTabListenerName);
      });

      it("logs unmatched iframe requests", async function() {
        await checkLogging(
          [],
          "unmatchedEventOptions",
          "iframe.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("iframe.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs unmatched third-party requests", async function() {
        await checkLogging(
          [],
          "allEventOptions",
          "third-party.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("third-party.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestUrl(`${CROSS_DOMAIN_URL}/image.png`)
          }]
        );
      });

      it("logs unmatched popup requests [fuzz]", async function() {
        let opener = new Page("popup-opener.html");
        await opener.loaded;
        await checkLogging(
          [],
          "allEventOptions",
          async() => {
            let popup = new Popup("link", opener);
            await popup.blocked;
            return await popup.created;
          },
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("popup.html")
          }]
        );
      });

      it("logs unmatched allowlisted iframe requests", async function() {
        await checkLogging(
          [`@@|${TEST_PAGES_URL}/image.html$document`],
          "unmatchedEventOptions",
          "iframe.html",
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestRelativeUrl("iframe.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {...allowingMatchInfo, allowingReason: "document"},
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: expectedAllowingFilter(
              `@@|${TEST_PAGES_URL}/image.html$document`
            ),
            matchInfo: {...allowingMatchInfo, specificOnly: false},
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("logs unmatched different domain iframe requests", async function() {
        let url = `${CROSS_DOMAIN_URL}/iframe.html`;
        await checkLogging(
          [],
          "allEventOptions",
          () => new Page(url, true).loaded,
          [{
            filter: null,
            matchInfo: unmatchedMainFrameMatchInfo,
            request: expectedRequestUrl(url)
          }, {
            filter: null,
            matchInfo: {...unmatchedMatchInfo, docDomain: CROSS_DOMAIN},
            request: expectedRequestRelativeUrl("image.html")
          }, {
            filter: null,
            matchInfo: unmatchedMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });
    });

    describe("Event Options Filtering", function() {
      it("filters out unmatched requests with default options [fuzz]", async function() {
        await checkLogging(
          ["/image.png^$image"],
          "defaultEventOptions",
          "image.html",
          [{
            filter: expectedBlockingFilter("/image.png^$image"),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]);
      });

      it("filters out unmatched requests with allowing options", async function() {
        await checkLogging(
          ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
          "allowingEventOptions",
          "image.html",
          [{
            filter: expectedAllowingFilter(`@@|${TEST_PAGES_URL}$image`),
            matchInfo: requestMatchInfo,
            request: expectedRequestRelativeUrl("image.png")
          }]
        );
      });

      it("filters out allowing requests with default options", async function() {
        await checkLogging(
          ["/image.png^$image", `@@|${TEST_PAGES_URL}$image`],
          "defaultEventOptions",
          "image.html",
          []
        );
      });
    });
  });
});
