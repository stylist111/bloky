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
import {EWE, addFilter, setFeatureFlags, resetFeatureFlags, getTestEvents}
  from "./messaging.js";
import {isChromiumBased, Page, setMinTimeout, executeScript, waitForAssertion}
  from "./utils.js";

describe("CDP", function() {
  const WEBEXT_DOT_COM = "webext.com";
  const SUB_DOT_WEBEXT_DOT_COM = "sub." + WEBEXT_DOT_COM;
  const WEBEXT_WILDCARD = "webext.*";

  const EVENT_PAGE_VIEW = "page_view";
  const EVENT_SESSION_START = "session_start";
  const EVENT_BLOCKING = "blocking";

  const cdpDomainsPrefsKey = "cdp_domains";
  const intervalPrefsKey = "cdp_session_expiration_interval";
  let originalCdpDomains;
  let originalUserOptedOut;

  before(async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }

    originalCdpDomains = await EWE.testing._getPrefs(cdpDomainsPrefsKey);
    originalUserOptedOut = await EWE.cdp.isOptOut();
  });

  beforeEach(async function() {
    await EWE.testing._clearCdpData();
    await EWE.testing._clearCdpActivity();
    await setFeatureFlags({cdp: true});
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_DOT_COM]);
    await EWE.cdp.setOptOut(false);
  });

  afterEach(async function() {
    await EWE.testing._clearCdpData();
    await resetFeatureFlags();
  });

  after(async function() {
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, originalCdpDomains);
    await EWE.cdp.setOptOut(originalUserOptedOut);
  });

  async function assertEvents(domain, eventType, size) {
    await EWE.debugging.ensureEverythingHasSaved();

    let data;
    await waitForAssertion(async() => {
      data = await EWE.testing._getCdpData(eventType, domain);
      expect(data.length).toEqual(size);
    });
    return data;
  }

  it("tracks only 'Prefs.cdp_domains' list", async function() {
    await new Page("http://localhost:3000/image.html").loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("supports domain wildcards", async function() {
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_WILDCARD]);
    await new Page(`http:/${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_WILDCARD, EVENT_PAGE_VIEW, 1);
  });

  it("tracks tracked domains subdomains, but reports exactly tracked domain", async function() {
    await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);
    await assertEvents(SUB_DOT_WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("does not track if feature flag is off", async function() {
    await setFeatureFlags({cdp: false});
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("does not track if user opted out", async function() {
    await EWE.cdp.setOptOut(true);
    expect(await EWE.cdp.isOptOut()).toEqual(true);
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("tracks 'blocking' events", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_BLOCKING, 1);
  });

  it("tracks 'page_view' events", async function() {
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);
  });

  it("tracks 'session_start' events", async function() {
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("return events timestamps", async function() {
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

    const data = await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

    // every item is an event timestamp
    expect(data).toEqual(expect.arrayContaining([expect.any(Number)]));
    // event happened less than 10 seconds ago
    expect((Date.now() - data[0]) < 10000).toEqual(true);
  });

  it("does not consider tab reload within expiration interval as a new session", async function() {
    setMinTimeout(this, 10 * 1000);

    const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
    await page.loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

    // within session expiration interval,
    // so it's considered as session continuation, not a new session
    await page.reload();

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("considers tab reload larger than default expiration interval as a new session", async function() {
    setMinTimeout(this, 10 * 1000);

    const defaultInterval = await EWE.testing._getPrefs(intervalPrefsKey);
    try {
      await EWE.testing._setPrefs(intervalPrefsKey, 0); // 0 second

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      await page.loaded;

      // Larger than session expiration interval,
      // so it's considered as a new session
      await page.reload();

      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 2);
    }
    finally {
      await EWE.testing._setPrefs(intervalPrefsKey, defaultInterval);
    }
  });

  it("considers tab reload larger than default expiration interval as a new session having another tab with the same domain", async function() {
    setMinTimeout(this, 10 * 1000);

    const defaultInterval = await EWE.testing._getPrefs(intervalPrefsKey);
    const sessionExpirationInterval = 1000; // 1 second
    try {
      await EWE.testing._setPrefs(intervalPrefsKey, sessionExpirationInterval);

      const page1 = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false);
      await page1.loaded;

      // immediately (less then expiration interval),
      // so it's not considered as a new session
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;

      // wait longer than session expiration interval
      const sleepInterval = 2 * sessionExpirationInterval;
      await new Promise(r => setTimeout(r, sleepInterval));

      // so reload is considered as a new session
      await page1.reload();

      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 2);
    }
    finally {
      await EWE.testing._setPrefs(intervalPrefsKey, defaultInterval);
    }
  });

  it("considers same website navigation with larger than default expiration interval as a new session", async function() {
    setMinTimeout(this, 10 * 1000);

    const defaultInterval = await EWE.testing._getPrefs(intervalPrefsKey);
    const sessionExpirationInterval = 1000; // 1 second
    const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;
    try {
      await EWE.testing._setPrefs(intervalPrefsKey, sessionExpirationInterval);

      await new Page(url).loaded;

      // wait longer than session expiration interval
      const sleepInterval = 2 * sessionExpirationInterval;
      await new Promise(r => setTimeout(r, sleepInterval));

      await new Page(url).loaded;

      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 2);
    }
    finally {
      await EWE.testing._setPrefs(intervalPrefsKey, defaultInterval);
    }
  });

  it("tracks same domain navigation in different tabs as the same session", async function() {
    // if user opens multiple tabs with the same host,
    // we consider it to be the same session
    setMinTimeout(this, 10 * 1000);

    const tabsCount = 3;
    const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;

    for (let i = 0; i < tabsCount; i++) {
      // current tabs/pages stay opened
      await new Page(url, false, false).loaded;
    }

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("tracks same domain with wildcard navigation in different tabs as the same session", async function() {
    // if user opens multiple tabs with the same domain with wildcard,
    // we consider it to be the same session
    setMinTimeout(this, 30 * 1000);

    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_WILDCARD]);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
    await new Page("http://webext.co.uk:3000/image.html", false, false).loaded;

    await assertEvents(WEBEXT_WILDCARD, EVENT_SESSION_START, 1);
  });

  it("tracks same subdomain navigation in different tabs as the same session", async function() {
    // if user opens multiple tabs with the same domain/subdomain,
    // we consider it to be the same session
    setMinTimeout(this, 10 * 1000);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
    await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
    await assertEvents(SUB_DOT_WEBEXT_DOT_COM, EVENT_SESSION_START, 0);
  });

  it("tracks same subdomain with wildcard navigation in different tabs as the same session", async function() {
    // if user opens multiple tabs with the same domain/subdomain with wildcard,
    // we consider it to be the same session
    setMinTimeout(this, 10 * 1000);

    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_WILDCARD]);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
    await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;

    await assertEvents(WEBEXT_WILDCARD, EVENT_SESSION_START, 1);
    await assertEvents(SUB_DOT_WEBEXT_DOT_COM, EVENT_SESSION_START, 0);
  });

  it("tracks different domain navigations in different tabs as different sessions", async function() {
    setMinTimeout(this, 10 * 1000);

    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_DOT_COM, "localhost"]);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
    await new Page("http://localhost:3000/image.html", false, false).loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
    await assertEvents("localhost", EVENT_SESSION_START, 1);
  });

  it("does not consider the session finished if having other tabs for the host after one tab closed", async function() {
    setMinTimeout(this, 10 * 1000);

    const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;
    const page1 = new Page(url, false, false);
    await page1.loaded;

    const page2 = new Page(url, false, false);
    await page2.loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

    await page2.remove();
    await page1.reload();

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("does not consider the session finished when all the tabs are closed", async function() {
    // the session lasts for 30 minutes independent of tabs
    setMinTimeout(this, 10 * 1000);

    const tabsCount = 3;
    const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;

    for (let i = 0; i < tabsCount; i++) {
      // the current page is closed as soon as a new one created
      await new Page(url).loaded;
    }

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("prefers exact match over wildcarded and reports for one entry only", async function() {
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [
      /*
      WARNING: the order makes a difference:
      * exact matches should come earlier than wildcarded
        (eg. exact comain earlier than it's wildcarded flavour)
      */
      WEBEXT_DOT_COM,
      WEBEXT_WILDCARD
    ]);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

    // technically it also matches wildcarded entry too,
    // but we report for only one entry
    await assertEvents(WEBEXT_WILDCARD, EVENT_SESSION_START, 0);
  });

  it("prefers subdomain match over higher-level domain and reports for one entry only", async function() {
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [
      /*
      WARNING: the order makes a difference:
      * more specific site buckets should come earlier
        (eg. subdomain earlier than it's more higher level domain)
      */
      SUB_DOT_WEBEXT_DOT_COM,
      WEBEXT_DOT_COM
    ]);

    await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

    await assertEvents(SUB_DOT_WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

    // technically it also matches higher-level domain entry too,
    // but we report for only one entry
    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 0);
  });

  it("supports separate site buckets for search use case", async function() {
    // we might want to track "search.domain.com" separate from
    // ["domain.com", "domain.co.uk", etc.]

    setMinTimeout(this, 10 * 1000);

    // bucket 1
    const SEARCH_WEBEXT_DOT_COM = "search." + WEBEXT_DOT_COM;

    // bucket 2 (wildcard)

    // technically it means we keep 2 separate match entries in Prefs.cdp_domain
    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [
      /*
      WARNING: the order makes a difference:
      * more specific site buckets should come earlier
        (eg. subdomain earlier than it's more higher level domain)
      * exact matches should come earlier than wildcarded
        (eg. exact comain earlier than it's wildcarded flavour)
      */
      SEARCH_WEBEXT_DOT_COM,
      WEBEXT_WILDCARD
    ]);

    // bucket 1
    await new Page(`http://${SEARCH_WEBEXT_DOT_COM}:3000/image.html`).loaded;

    // bucket 2
    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await new Page("http://webext.co.uk:3000/image.html").loaded; // regional
    await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded; // subdomain

    await assertEvents(SEARCH_WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);
    await assertEvents(WEBEXT_WILDCARD, EVENT_PAGE_VIEW, 3);

    await assertEvents(SEARCH_WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
    await assertEvents(WEBEXT_WILDCARD, EVENT_SESSION_START, 1);
  });

  it("supports History API", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/history.html`).loaded;

    // 1 event for "history.html" and 1 event for "history-after-pushState.js"
    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 2);

    // still the same session
    await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
  });

  it("extends session expiration time due to user actions", async function() {
    setMinTimeout(this, 30 * 1000);

    const defaultInterval = await EWE.testing._getPrefs(intervalPrefsKey);
    const sessionExpirationInterval = 2000; // 2 seconds
    const sleepInterval = sessionExpirationInterval / 4.0;

    async function assertUserActionsExtendSession(callback) {
      await EWE.testing._clearCdpData();
      await EWE.testing._clearCdpActivity();
      await Page.removeCurrent();
      await EWE.testing._clearFrameState();

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      const tabId = await page.loaded;

      const attempts = 10;

      for (let i = 0; i < attempts; i++) {
        await new Promise(r => setTimeout(r, sleepInterval));

        // simulated user events extend the session expiration interval
        await executeScript(tabId, callback, []);
      }

      // the session is expected to be still not expired
      await page.reload();
      await page.remove();

      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
    }

    try {
      await EWE.testing._setPrefs(intervalPrefsKey, sessionExpirationInterval);

      await addFilter("image.png");

      // click
      await assertUserActionsExtendSession(() => {
        const image = document.getElementById("image");
        image.click();
      });

      // scrolling
      await assertUserActionsExtendSession(() => {
        const e = document.createEvent("UIEvents");
        e.initUIEvent("scroll", true, true, window, 1);
        document.body.dispatchEvent(e);
      });

      // typing
      await assertUserActionsExtendSession(() => {
        const inputBox = document.getElementById("inputBox");
        inputBox.dispatchEvent(new KeyboardEvent("keypress", {key: "1"}));
      });
    }
    finally {
      await EWE.testing._setPrefs(intervalPrefsKey, defaultInterval);
    }
  });

  it("clears the events", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);

    await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);

    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("clears the events for the domain with timestamp older than passed", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

    const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
    await page.loaded;
    await EWE.debugging.ensureEverythingHasSaved();

    let data = await EWE.testing._getCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);
    expect(data).not.toEqual([]);
    const firstTs = data[0];

    await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM, firstTs);
    data = await EWE.testing._getCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);
    expect(data).not.toEqual([]);
    expect(data[0]).toEqual(firstTs);

    await EWE.testing._clearCdpData(
      EVENT_PAGE_VIEW, WEBEXT_DOT_COM, firstTs + 1);

    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
  });

  it("clears the events for the domain", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

    await EWE.testing._setPrefs(cdpDomainsPrefsKey, [WEBEXT_DOT_COM, "localhost"]);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await new Page("http://localhost:3000/image.html").loaded;

    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);
    await assertEvents("localhost", EVENT_PAGE_VIEW, 1);

    await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);

    await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0); // cleared
    await assertEvents("localhost", EVENT_PAGE_VIEW, 1); // not cleared
  });

  it("notifies the listeners", async function() {
    await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

    await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
    await EWE.debugging.ensureEverythingHasSaved();

    expect(getTestEvents("cdp.onCdpItem.page_view")).toEqual([[{
      timeStamp: expect.any(Number),
      domain: WEBEXT_DOT_COM,
      eventType: EVENT_PAGE_VIEW
    }]]);

    expect(getTestEvents("cdp.onCdpItem.blocking")).toEqual([[{
      timeStamp: expect.any(Number),
      domain: WEBEXT_DOT_COM,
      eventType: EVENT_BLOCKING
    }]]);

    expect(getTestEvents("cdp.onCdpItem.session_start")).toEqual([[{
      timeStamp: expect.any(Number),
      domain: WEBEXT_DOT_COM,
      eventType: EVENT_SESSION_START
    }]]);

    expect(getTestEvents("cdp.onCdpItem.all")).toEqual(expect.arrayContaining([
      expect.arrayContaining([{
        timeStamp: expect.any(Number),
        domain: WEBEXT_DOT_COM,
        eventType: EVENT_PAGE_VIEW
      }]),
      expect.arrayContaining([{
        timeStamp: expect.any(Number),
        domain: WEBEXT_DOT_COM,
        eventType: EVENT_BLOCKING
      }]),
      expect.arrayContaining([{
        timeStamp: expect.any(Number),
        domain: WEBEXT_DOT_COM,
        eventType: EVENT_SESSION_START
      }])
    ]));
  });
});
