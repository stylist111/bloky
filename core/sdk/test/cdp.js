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
import pako from "pako";
import {MILLIS_IN_MINUTE, MILLIS_IN_HOUR, MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

import {EWE, addFilter, getTestEvents} from "./messaging.js";
import {CROSS_DOMAIN, TEST_ADMIN_PAGES_URL, TEST_PAGES_URL, TEST_PAGES_DOMAIN,
        CROSS_DOMAIN_URL} from "./test-server-urls.js";
import {isChromiumBased, isFirefox, Page, setMinTimeout, executeScript,
        waitForAssertion, clearRequestLogs, getRequestLogs, setEndpointResponse,
        clearEndpointResponse, waitForSubscriptionToBeSynchronized} from "./utils.js";
import {setPremiumStatus, resetPremiumStatus} from "./messaging.js";
import {base64ToArrayBuffer} from "adblockpluscore/lib/rsa.js";
import {limitPromiseDuration} from "./polling.js";

const SITE_ID = "siteId";

const EVENT_PAGE_VIEW = "page_view";
const EVENT_SESSION_START = "session_start";
const EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW = "blockthrough_acceptable_ads_page_view";

const PEM_PRIVATE_KEY_HEADER = "-----BEGIN PRIVATE KEY-----";
const PEM_PRIVATE_KEY_FOOTER = "-----END PRIVATE KEY-----";
const RSA_ALGORITHM = {
  name: "RSA-OAEP",
  hash: "SHA-256"
};

async function importRSAPrivateKey(pem) {
  // fetch the part of the PEM string between header and footer
  const pemContents = pem.substring(
    PEM_PRIVATE_KEY_HEADER.length,
    pem.length - PEM_PRIVATE_KEY_FOOTER.length - 1);

  return await crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(pemContents),
    RSA_ALGORITHM,
    true,
    ["decrypt"]);
}

async function decryptRSA(privateKey, data) {
  return await crypto.subtle.decrypt(
    RSA_ALGORITHM,
    privateKey,
    data);
}

async function importAESKey(data) {
  return await crypto.subtle.importKey(
    "raw",
    data, {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["decrypt"]);
}

async function decryptAES(nonce, key, data) {
  const DECRYPT_ALGORITHM = {
    name: "AES-GCM",
    iv: nonce
  };
  return await crypto.subtle.decrypt(
    DECRYPT_ALGORITHM,
    key,
    data);
}

async function decryptDomainStats(payload) {
  const privateKeyPem =
    `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDWj+Q+MRYCdOVS
YBcceCNL7mwc2PMgZD2/OzqO/YVqey0OFWFGqg6+keWJh+hAeGa9A/ZgaugFgJgt
6UDU+8kiVYlqHASfFqkJ29XYZ3tC2QolRT95ypxNvr2A6Me0REPk5KY8qjSrKe/h
gyjf4pjWtYMDILlZiygHDbDitKxMZIOZ17PeRBgJpwJV6sdvFDP6H82CDsBk+F0K
TxDh23CNwxUnZ+iyn79c8DISjL+ww79pisD1XMD71lwJ16Q+zrpotgk/Zvs6NuJH
8JirmEP0WifUBGaYuZKLeez5G4hd43ZL+/5EtDgnSsVF2r5GMPvWvE3qyT+WE4cK
gxrFl5UnAgMBAAECggEAEsL8+lM10XvXRvS6u0qQtjsK88V6ElhcQzSH/P4+Lv7G
WczqIfu3flfTnSBn4VCl6zFFgfjXK7lVlUN9ineEhvQOfVt7K/jB9JK8iEfEMibj
CY9HQFHEiSfR+ku16sAYD755VXoB+6rscZO+fJVGjWp3Ikw3k5Tk0yO8q+uQhWgQ
12LVS2S0gk91JxW7Tpv4hvagzRXh4a/ltaMcpmNn1wSwCpRDHyfHo27tOG/k3YWn
4kD5j8EfuFu/1ye8tmNhP5Fhrv60dOKiZGovIxdHXiorRJNDUDQR9FXYbCPTS7YR
TSdDdoJfLjlNLDzMWhO6SfNVGpW9hgzz0wvgc7qwAQKBgQDXU+796vM07C+JGi6Y
aokqVh4CyLjo7oqysXPz8ThnStOfC1dUJGUpuE8ashUQfjVhdRIGFRQ8aJWFbevo
2l6RmzB5vbcRmh3A7XCMgCRIC7G6fK0P5ktW2cKhRoV7I2LT432NXFOt5uYWVGp8
i/epKUXdEnwteJBIXswFtQaMJwKBgQD/Fu2+P9L56XhU2Jz8MhTI8ZhgauQBDnjF
YShxNq4TKOIKz4NmiisIdJEZbi07hfNDRmQwa4ot561aO1RFL03eGUl3MDAs481H
oprPqCD2ixN05vPfxjugsbmVtGvoFQlJCh8dBiLROTloh+y3Wq6V2UmxJXx6TLHb
rYPwv8dPAQKBgQC+08OZg/7FiAsYlft1V/T3cBponTpCNCT2+Ayqw7wYzld9O6/J
AfglYRG5tti0JSVpmTa/7S5h2s2n0iKf2ea1Y7MyMM9s6gg0UjjMS0PcFYEMpDE7
Rfy+m33BL55b4qBS5+j8vjXqiBag827rsZ9qawlfQmKKaa50dI6bADMtQQKBgQD2
JyEJyjsDUAj/DvwF3SnzcjcRK3STlGx0QzosbZBzCqt9tRtecovuH9X4zTm2y56f
16hMlSmE/KBqhv/dtzUT0iDzc7u5RaXMr5tmMR6F6lS/JTJGSNs3SOkGDlFmZg5M
vgiiEE6+yNKeDTQfBtGb5k7XM4430hR7IKhGRDnHAQKBgENYy1Kar5gKOaHChJXV
kQs+REJ29x/c/ff95djsZbFHfPy/Djv6txb7J+rDNcdh4T65W56WdIutx4MDCxMF
Uf3EQna7+viKeGOEpe2PDqH3V/g4XZeksCpKHOtS9QjGkF28Pl03z7odu3LcYnJ5
9M2jd3iyThixkj2oAnZBm7aT
-----END PRIVATE KEY-----`;

  const encryptedData = payload.encrypted_data;
  const encryptedCombo = new Uint8Array(
    base64ToArrayBuffer(encryptedData));

  const AES_SIZE = 256; // bytes
  const NONCE_SIZE = 16; // bytes

  const encryptedAesKeyBinaryArray = encryptedCombo.slice(0, AES_SIZE);
  const rsaPrivateKey = await importRSAPrivateKey(privateKeyPem);
  const aesKeyBinaryArray = await decryptRSA(
    rsaPrivateKey, encryptedAesKeyBinaryArray);
  const aesNonce = encryptedCombo.slice(AES_SIZE, AES_SIZE + NONCE_SIZE);
  const encryptedDataArray = encryptedCombo.slice(
    AES_SIZE + NONCE_SIZE, encryptedCombo.length);
  const aesKey = await importAESKey(aesKeyBinaryArray);
  expect(aesKey).not.toBeNull();

  const decryptedDataArray = await decryptAES(
    aesNonce, aesKey, encryptedDataArray);
  const ungzippedArray = pako.ungzip(decryptedDataArray);
  const decoder = new TextDecoder("utf-8");
  const domainStatsString = decoder.decode(ungzippedArray.buffer);
  return JSON.parse(domainStatsString);
}

const PING_URL = `${TEST_ADMIN_PAGES_URL}/cdp-ping`;
const PUBLIC_KEY_URL = `${TEST_ADMIN_PAGES_URL}/public-key`;
const CDP_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";

const CDP_PHASE_3_ARGS = {
  pingUrl: PING_URL,
  publicKeyUrl: PUBLIC_KEY_URL,
  bearer: CDP_BEARER
};

const ERROR_DELAY_MS = MILLIS_IN_HOUR;
const LOGS_WAIT_INTERVAL_MS = 5 * MILLIS_IN_SECOND;

async function startMetricsUploaderWithTestArgs() {
  await EWE.testing.stopCdpMetricsUploader();
  await EWE.testing.startCdpMetricsUploader(
    CDP_PHASE_3_ARGS, ERROR_DELAY_MS);
}

const CDP_STORAGE_3_KEY = "ewe:cdp-metrics-uploader-3";
async function clearCdpStorage() {
  await browser.storage.local.remove(CDP_STORAGE_3_KEY);
}

describe("CDP", function() {
  const EXPIRATION_INTERVAL_KEY = "cdp_session_expiration_interval";

  let originalUserOptedOut;
  let originalExpirationInterval;

  before(async function() {
    originalUserOptedOut = await EWE.cdp.isOptOut();
    originalExpirationInterval = await EWE.testing._getPrefs(
      EXPIRATION_INTERVAL_KEY
    );
  });

  after(async function() {
    await EWE.cdp.setOptOut(originalUserOptedOut);
    await EWE.testing._setPrefs(
      EXPIRATION_INTERVAL_KEY, originalExpirationInterval
    );
  });

  beforeEach(async function() {
    await EWE.testing._clearCdpData();
    await EWE.testing._clearCdpActivity();
  });

  describe("Opt-out", function() {
    const KEY = "cdp_opt_in_out";

    it("is disabled by default for Firefox only", async function() {
      expect(await EWE.cdp.isOptOut()).toEqual(isFirefox());
    });

    it("checks to be opted in on Firefox by user", async function() {
      await EWE.cdp.setOptOut(false);
      expect(await EWE.cdp.isOptOut()).toEqual(false);
      expect(await EWE.testing._getPrefs(KEY)).toEqual(2); // OPTED_IN_BY_USER
    });

    it("checks to be opted out by user", async function() {
      await EWE.cdp.setOptOut(true);
      expect(await EWE.cdp.isOptOut()).toEqual(true);
      expect(await EWE.testing._getPrefs(KEY)).toEqual(3); // OPTED_OUT_BY_USER
    });
  });

  describe("Domains trimming", function() {
    it("generates \"domain_stats\" payload", async function() {
      await EWE.testing._setCdpData(
        EVENT_SESSION_START, SITE_ID, [1, 2, 3]
      );
      await EWE.testing._setCdpData(EVENT_PAGE_VIEW, SITE_ID, 4);
      const stats = await EWE.testing._getCdpDomainStats();
      expect(stats).toEqual(
        `{"ds":[{"i":"${SITE_ID}","s":3,"p":4,"b":0}]}`);
    });

    it("sorts \"domain_stats\" payload for sessions count", async function() {
      const SITE_ID1 = SITE_ID;
      const SITE_ID2 = SITE_ID + "2";
      const SITE_ID3 = SITE_ID + "3";
      await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID1, [1]);
      await EWE.testing._setCdpData(EVENT_PAGE_VIEW, SITE_ID1, 2);
      await EWE.testing._setCdpData(
        EVENT_SESSION_START, SITE_ID2, [1, 2, 3]
      );
      await EWE.testing._setCdpData(EVENT_PAGE_VIEW, SITE_ID2, 1);
      await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID3, [1, 2]);
      await EWE.testing._setCdpData(EVENT_PAGE_VIEW, SITE_ID3, 5);
      await EWE.testing._setCdpData(
        EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW, SITE_ID3, 2
      );
      const stats = await EWE.testing._getCdpDomainStats();
      expect(stats).toEqual("{\"ds\":[" +
        `{"i":"${SITE_ID2}","s":3,"p":1,"b":0},` +
        `{"i":"${SITE_ID3}","s":2,"p":5,"b":2},` +
        `{"i":"${SITE_ID1}","s":1,"p":2,"b":0}` +
        "]}");
    });
  });

  describe("Event tracking", function() {
    async function assertEvents(siteId, eventType, size) {
      await EWE.debugging.ensureEverythingHasSaved();

      let counter;
      await waitForAssertion(async() => {
        counter = await EWE.testing._getCdpData(eventType, siteId);
        expect(counter).toEqual(size);
      }, 2000);
      return counter;
    }

    async function loadPageWithTimeout(url, timeout = 10 * MILLIS_IN_SECOND) {
      const page = new Page(url);
      try {
        await limitPromiseDuration(page.loaded, `Failed to load ${url}`, timeout);
      }
      catch (e) {
        await page.remove();
        throw e;
      }
    }

    async function assertUserActionsSessionEvents(
      callback, sessionDuration, clear = true, eventsCount = 1) {
      if (clear) {
        await EWE.testing._clearCdpData();
        await EWE.testing._clearCdpActivity();
        await Page.removeCurrent();
        await EWE.testing._clearFrameState();
      }

      const page = new Page(`${TEST_PAGES_URL}/image.html`);
      const tabId = await page.loaded;

      const sleepInterval = 100;

      let startTime = performance.now();
      while (performance.now() - startTime < sessionDuration) {
        await new Promise(r => setTimeout(r, sleepInterval));

        // simulated user events extend the session expiration interval
        await executeScript(tabId, callback, []);
      }

      // now sleep a bit more to let the session expire,
      // if it's not extended by user actions
      await new Promise(r => setTimeout(r, sleepInterval));
      // the session is expected to be still not expired
      await page.reload();
      await page.remove();
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, eventsCount);
    }

    beforeEach(async function() {
      await EWE.cdp.setOptOut(false);
      await clearCdpStorage();
      await EWE.testing.stopCdp();
      await EWE.testing.startCdp();
    });

    it("does not track if opted out by user", async function() {
      await EWE.cdp.setOptOut(true);
      expect(await EWE.cdp.isOptOut()).toEqual(true);
      await addFilter(`image.png$domain=${TEST_PAGES_DOMAIN}`);
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 0);
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 0);
    });

    it("tracks 'page_view' events", async function() {
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 1);
    });

    it("tracks 'session_start' events", async function() {
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 1);
    });

    it("tracks 'blockthrough_acceptable_ads_page_view' events", async function() {
      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN,
                         EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
                         1);
    });

    it("does not track 'blockthrough_acceptable_ads_page_view' events for page views where an adblocker is not detected", async function() {
      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html?bt-aapv-ab=false`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN,
                         EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
                         0);
    });

    it("does not track 'blockthrough_acceptable_ads_page_view' events for page views where acceptable ads is not detected", async function() {
      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html?bt-aapv-acceptable=false`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN,
                         EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
                         0);
    });

    it("tracks 'blockthrough_acceptable_ads_page_view' events for history API navigation where the tag is injected per history state update", async function() {
      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv-history-page-view-per-history-state.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN,
                         EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
                         2);
    });

    it("tracks 'blockthrough_acceptable_ads_page_view' events for each history API navigation where the tag is injected once per full page load", async function() {
      // Note that in this case we only count one event, because the tag only
      // emits one event. This is consistent with Blockthrough's counting, even
      // though it doesn't match our other definition of a 'page view', which
      // would include all history API navigations as new page views.

      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv-history-page-view-per-page-load.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN,
                         EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW,
                         1);
    });

    it("supports History API", async function() {
      await addFilter(`image.png$domain=${TEST_PAGES_DOMAIN}`);

      await loadPageWithTimeout(`${TEST_PAGES_URL}/history.html`);

      // 1 event for "history.html", 1 event for "history-after-pushState.js"
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 2);

      // still the same session
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 1);
    });

    it("counts page redirects", async function() {
      await new Page(`${TEST_PAGES_URL}/redirect.html`).loaded;

      // 1 event for original load and 1 after redirection
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 2);
    });

    it("extends session expiration time due to user actions", async function() {
      setMinTimeout(this, 60 * 1000);

      const sessionExpirationInterval = 6 * MILLIS_IN_SECOND;

      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

      // click
      await assertUserActionsSessionEvents(() => {
        const image = document.getElementById("image");
        image.click();
      }, sessionExpirationInterval);

      // scrolling
      await assertUserActionsSessionEvents(() => {
        const e = document.createEvent("UIEvents");
        e.initUIEvent("scroll", true, true, window, 1);
        document.body.dispatchEvent(e);
      }, sessionExpirationInterval);

      // typing
      await assertUserActionsSessionEvents(() => {
        const inputBox = document.getElementById("inputBox");
        inputBox.dispatchEvent(new KeyboardEvent("keypress", {key: "1"}));
      }, sessionExpirationInterval);
    });

    it("starts new session if user was inactive for too long and then became active", async function() {
      setMinTimeout(this, 60 * 1000);

      const sessionExpirationInterval = 6 * MILLIS_IN_SECOND;

      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

      await addFilter("image.png");

      // click
      const userClickCallback = () => {
        const image = document.getElementById("image");
        image.click();
      };
      await assertUserActionsSessionEvents(
        userClickCallback, sessionExpirationInterval, true, 1);

      // simulate user to be inactive longer than session duration
      await new Promise(r => setTimeout(r, sessionExpirationInterval + 1000));

      await assertUserActionsSessionEvents(
        userClickCallback, sessionExpirationInterval, false, 2);
    });

    it("defers and processes the browser events when the data is loaded", async function() {
      const loadDelay = 1000;

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 1);

      await EWE.testing.stopCdp();
      try {
        await EWE.testing.setCdpLoadDelay(loadDelay);
        await EWE.testing.startCdp();

        // If there is no data (existing sessions) loaded,
        // it's considered to be a new session.
        // Otherwise we know there is a pending session.
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

        // the deferred events are processed now
        await new Promise(r => setTimeout(r, loadDelay));

        // not a new session
        await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 1);
      }
      finally {
        await EWE.testing.setCdpLoadDelay(0);
      }
    });

    it("defers and processes blockthrough events when the data is loaded", async function() {
      const loadDelay = 1000;

      await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html`).loaded;
      await assertEvents(
        TEST_PAGES_DOMAIN, EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW, 1
      );

      await EWE.testing.stopCdp();
      try {
        await EWE.testing.setCdpLoadDelay(loadDelay);
        await EWE.testing.startCdp();

        // If there is no data loaded, then it could miscount by starting the
        // count from 0 again.
        await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html`).loaded;

        // the deferred events are processed now
        await new Promise(r => setTimeout(r, loadDelay));

        await assertEvents(
          TEST_PAGES_DOMAIN, EVENT_BLOCKTHROUGH_ACCEPTABLE_ADS_PAGE_VIEW, 2
        );
      }
      finally {
        await EWE.testing.setCdpLoadDelay(0);
      }
    });

    it("clears the events", async function() {
      await addFilter(`image.png$domain=${TEST_PAGES_DOMAIN}`);

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 1);

      await EWE.testing._clearCdpData();

      await assertEvents(TEST_PAGES_DOMAIN, EVENT_PAGE_VIEW, 0);
    });

    it("clears the expired sessions on start", async function() {
      setMinTimeout(this, 15000);

      const ACTIVITY_KEY = "ewe:cdp-activity";
      const sessionExpirationInterval =
          await EWE.testing._getPrefs("cdp_session_expiration_interval");

      const newSessionExpirationInterval = 1 * MILLIS_IN_SECOND;

      try {
        await EWE.testing._setPrefs(
          EXPIRATION_INTERVAL_KEY, newSessionExpirationInterval);
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
        await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 1);

        // wait for the session to expire
        await new Promise(r =>
          setTimeout(r, 2 * newSessionExpirationInterval)
        );

        await EWE.testing.stopCdp();

        // Make sure the session is saved
        let activity = await browser.storage.local.get([ACTIVITY_KEY]);
        activity = activity[ACTIVITY_KEY];
        expect(activity).toHaveProperty(TEST_PAGES_DOMAIN);
        expect(activity[TEST_PAGES_DOMAIN]).toEqual(expect.any(Number));

        await EWE.testing.startCdp();

        // Make sure the session is cleaned during the start,
        // so new navigation is treated as a new session
        await waitForAssertion(async() => {
          activity = await browser.storage.local.get([ACTIVITY_KEY]);
          activity = activity[ACTIVITY_KEY];
          expect(activity).not.toHaveProperty(TEST_PAGES_DOMAIN);
        });
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

        await assertEvents(TEST_PAGES_DOMAIN, EVENT_SESSION_START, 2);
      }
      finally {
        await EWE.testing._setPrefs(
          EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);
      }
    });

    it("ignores Chromium service URLs", async function() {
      if (!isChromiumBased()) {
        this.skip();
      }

      await new Page("chrome://version").loaded;
      await assertEvents("version", EVENT_SESSION_START, 0);
    });

    it("notifies the listeners", async function() {
      await addFilter(`image.png$domain=${TEST_PAGES_DOMAIN}`);

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await EWE.debugging.ensureEverythingHasSaved();

      await waitForAssertion(() => {
        expect(getTestEvents("cdp.onCdpItem.page_view")).toEqual([[{
          timeStamp: expect.any(Number),
          siteId: TEST_PAGES_DOMAIN,
          eventType: EVENT_PAGE_VIEW
        }]]);

        expect(getTestEvents("cdp.onCdpItem.session_start")).toEqual([[{
          timeStamp: expect.any(Number),
          siteId: TEST_PAGES_DOMAIN,
          eventType: EVENT_SESSION_START
        }]]);

        expect(getTestEvents("cdp.onCdpItem.all")).toEqual(expect.arrayContaining([
          expect.arrayContaining([{
            timeStamp: expect.any(Number),
            siteId: TEST_PAGES_DOMAIN,
            eventType: EVENT_PAGE_VIEW
          }]),
          expect.arrayContaining([{
            timeStamp: expect.any(Number),
            siteId: TEST_PAGES_DOMAIN,
            eventType: EVENT_SESSION_START
          }])
        ]));
      });
    });
  });

  describe("Metric Upload", function() {
    beforeEach(async function() {
      setMinTimeout(this, 10 * 1000);

      await clearCdpStorage();
      await EWE.cdp.setOptOut(false);

      await EWE.testing.resetCdpMetricsUploader();
      await EWE.testing.stopCdp();
      await EWE.testing.startCdp();
      await clearRequestLogs();
    });

    afterEach(async function() {
      await clearEndpointResponse(PING_URL);
      await clearEndpointResponse(PUBLIC_KEY_URL);
    });

    it("sets premium status to premium when callback set to true", async function() {
      await setPremiumStatus(true);
      await startMetricsUploaderWithTestArgs();
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs.length).toBeGreaterThan(0);
        expect(requestLogs[0].body.payload.premium_status).toEqual("premium");
      });
    });

    it("sets premium status to free when callback set to false", async function() {
      await setPremiumStatus(false);
      await startMetricsUploaderWithTestArgs();
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs.length).toBeGreaterThan(0);
        expect(requestLogs[0].body.payload.premium_status).toEqual("free");
      });
    });

    it("does not add premium status to payload if no callback is set", async function() {
      await resetPremiumStatus();
      await startMetricsUploaderWithTestArgs();
      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs.length).toBeGreaterThan(0);
        expect(requestLogs[0].body.payload).not.toHaveProperty("premium_status");
      });
    });

    it("sends \"aa_active\" property", async function() {
      setMinTimeout(this, 10 * 1000);

      const ACCEPTABLE_ADS_MV3_URL =
          "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";

      await startMetricsUploaderWithTestArgs();

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

      let payload;

      async function assertAAActive(isActive) {
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        }, 5000);

        expect(payload.aa_active).toEqual(isActive);
      }

      await assertAAActive(false);

      await EWE.testing.stopCdpMetricsUploader();
      await clearRequestLogs();

      await EWE.subscriptions.add(ACCEPTABLE_ADS_MV3_URL);
      await waitForSubscriptionToBeSynchronized(ACCEPTABLE_ADS_MV3_URL);
      await startMetricsUploaderWithTestArgs();

      await new Page("http://localhost:3000/image.html").loaded;
      await EWE.testing._uploadCdp();

      await assertAAActive(true);
    });

    it("sends experiments property", async function() {
      const EXPERIMENT_URL = `${TEST_ADMIN_PAGES_URL}/experiments.json`;
      const PING_INTERVAL_MS = MILLIS_IN_SECOND;
      const ERROR_BACKOFF_MS = 2 * MILLIS_IN_SECOND;

      await EWE.testing.restartExperiments(
        EXPERIMENT_URL, PING_INTERVAL_MS, ERROR_BACKOFF_MS
      );
      await EWE.experiments.sync();
      await startMetricsUploaderWithTestArgs();

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

      let payload;

      async function assertAssignments(assignments) {
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        });

        expect(payload.experiments).toEqual(assignments);
      }

      await assertAssignments([]);
      await clearRequestLogs();

      await EWE.testing.stopCdpMetricsUploader();
      await setEndpointResponse(EXPERIMENT_URL, {
        schemaId: "1",
        experiments: [
          {
            experimentId: "a",
            variants: [
              {
                variantId: "aa",
                flags: {},
                mods: [0, 1000]
              }
            ]
          },
          {
            experimentId: "b",
            variants: [
              {
                variantId: "bb",
                flags: {},
                mods: [0, 1000]
              }
            ]
          }
        ]
      }, "GET", 200);
      await EWE.experiments.sync();
      await startMetricsUploaderWithTestArgs();

      await new Page("http://localhost:3000/image.html").loaded;
      await EWE.testing._uploadCdp();

      await assertAssignments([
        {
          experiment_id: "a",
          variant_id: "aa"
        },
        {
          experiment_id: "b",
          variant_id: "bb"
        }
      ]);

      await clearEndpointResponse(EXPERIMENT_URL);
    });

    it("sends the request for the very first time with missing 'last_ping' and 'encrypted_data'", async function() {
      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();

      let payload;
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
        payload = requestLogs[0].body.payload;
      }, LOGS_WAIT_INTERVAL_MS);

      expect(payload).not.toHaveProperty("encrypted_data");
      expect(payload.application)
          .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
      expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.addon_name).toEqual("eyeo-webext-ad-filtering-solution");
      expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload).not.toHaveProperty("last_ping");
      expect(payload.public_key_id).toEqual("aeec16f98f5c69aca7a91c77c494a135");
      expect(payload).toHaveProperty("extension_name");
      expect(payload.extension_name).toEqual(browser.runtime.id);
      expect(payload.extension_version).toEqual(expect.any(String));
      expect(payload.utid).not.toBeNull();
      expect(payload.ucid).not.toBeNull();

      await waitForAssertion(async() => {
        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage).not.toHaveProperty("lastError");
      });
    });

    it("sends the request for the second time with filled 'last_ping' and 'encrypted_data'", async function() {
      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();

      let payload;
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
        payload = requestLogs[0].body.payload;
      }, LOGS_WAIT_INTERVAL_MS);

      // request #1
      expect(payload).not.toHaveProperty("encrypted_data");
      expect(payload).not.toHaveProperty("last_ping");

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      await EWE.testing._uploadCdp();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(2);
        payload = requestLogs[1].body.payload;
      }, LOGS_WAIT_INTERVAL_MS);

      // request #2
      expect(payload).toHaveProperty("encrypted_data");
      expect(payload).toHaveProperty("encryption_scheme");
      expect(payload.encryption_scheme).toEqual("rsa:2048:aes:256");
      expect(payload.application)
          .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
      expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload.addon_name).toEqual("eyeo-webext-ad-filtering-solution");
      expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      expect(payload).toHaveProperty("last_ping");
      expect(payload.public_key_id).toEqual("aeec16f98f5c69aca7a91c77c494a135");
      expect(payload.utid).not.toBeNull();
      expect(payload.ucid).not.toBeNull();
    });

    it("skips sending empty requests", async function() {
      await startMetricsUploaderWithTestArgs();

      // very first ping
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      }, LOGS_WAIT_INTERVAL_MS);

      // first data ping
      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await EWE.testing._uploadCdp();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(2);
      }, LOGS_WAIT_INTERVAL_MS);

      // possible second data ping: no new navigation, thus no new data
      await EWE.testing._uploadCdp();

      let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
      expect(requestLogs).toHaveLength(2);
    });

    it("sends the ping after the error resend interval has passed", async function() {
      const lastError = Date.now() - ERROR_DELAY_MS;
      await browser.storage.local.set({
        [CDP_STORAGE_3_KEY]: {
          lastError
        }
      });

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();
      // no need to `await EWE.testing._uploadCdp()` as it's expected
      // to be scheduled immediately

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      });

      await waitForAssertion(async() => {
        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage).not.toHaveProperty("lastError");
      }, LOGS_WAIT_INTERVAL_MS);
    });

    it("does not send again if the error resend interval has not passed yet", async function() {
      let now = Date.now();
      let originalStorage = {
        lastError: now - ERROR_DELAY_MS / 2
      };
      await browser.storage.local.set({
        [CDP_STORAGE_3_KEY]: originalStorage
      });

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();

      // Unfortunately no better condition to wait for here, because what we
      // expect is that nothing changes.
      await new Promise(r => setTimeout(r, 1000));

      let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
      expect(requestLogs).toHaveLength(0);

      let storageResult =
          await browser.storage.local.get([CDP_STORAGE_3_KEY]);
      let storage = storageResult[CDP_STORAGE_3_KEY];
      expect(storage.lastError).toEqual(originalStorage.lastError);
    });

    it("resumes sending data after the error resend interval passed", async function() {
      await browser.storage.local.set({
        [CDP_STORAGE_3_KEY]: {
          lastError: Date.now() - ERROR_DELAY_MS - MILLIS_IN_MINUTE
        }
      });

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();
      // no need to `await EWE.testing._uploadCdp()` as it's expected
      // to be scheduled immediately

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      });

      await waitForAssertion(async() => {
        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage = storageResult[CDP_STORAGE_3_KEY];
        expect(storage).not.toHaveProperty("lastError");
      });
    });

    it("sets an error timestamp if the server has an error", async function() {
      await setEndpointResponse(PING_URL, {}, "POST", 500);
      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
              await browser.storage.local.get([CDP_STORAGE_3_KEY]);
          let storage = storageResult[CDP_STORAGE_3_KEY];

          expect(storage.lastError).toEqual(expect.any(Number));
          // We expect the lastError to be in the form of a date that is
          // close to now, but there are multiple threads and this test is
          // async so it won't be exactly equal.
          expect(Math.abs(storage.lastError - Date.now()))
              .toBeLessThan(MILLIS_IN_MINUTE);
        });
      }
      finally {
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);
      }
    });

    async function assertCdpError() {
      let storage;
      await waitForAssertion(async() => {
        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage.lastError).toEqual(expect.any(Number));
        // We expect the lastError to be in the form of a date that is
        // close to now, but there are multiple threads and this test is
        // async so it won't be exactly equal.
        expect(Math.abs(storage.lastError - Date.now()))
            .toBeLessThan(MILLIS_IN_MINUTE);
      });
      return storage;
    }

    it("sets an error timestamp if public key server has an error", async function() {
      const response = await fetch(PUBLIC_KEY_URL);
      const pubKeyResponseText = await response.text();
      const pubKeyResponseHeaders = Object.fromEntries(
        response.headers.entries());
      await setEndpointResponse(PUBLIC_KEY_URL, {}, "GET", 404);

      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();
        await assertCdpError();
      }
      finally {
        await setEndpointResponse(
          PUBLIC_KEY_URL, pubKeyResponseText, "GET", 200, pubKeyResponseHeaders);
      }
    });

    it("sets an error timestamp if public key server returns no \"pubkey-id\" header", async function() {
      const response = await fetch(PUBLIC_KEY_URL);
      const pubKeyResponseText = await response.text();
      const pubKeyResponseHeaders = Object.fromEntries(
        response.headers.entries());
      await setEndpointResponse(
        PUBLIC_KEY_URL, pubKeyResponseText, "GET", 200, {"pubkey-id": ""});

      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        await assertCdpError();
      }
      finally {
        await setEndpointResponse(
          PUBLIC_KEY_URL, pubKeyResponseText, "GET", 200, pubKeyResponseHeaders);
      }
    });

    it("sends the very first retry ping after public key server is up again", async function() {
      const response = await fetch(PUBLIC_KEY_URL);
      const pubKeyResponseText = await response.text();
      const pubKeyResponseHeaders = Object.fromEntries(
        response.headers.entries());
      await setEndpointResponse(
        PUBLIC_KEY_URL, pubKeyResponseText, "GET", 404);

      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        await assertCdpError();
      }
      finally {
        await setEndpointResponse(
          PUBLIC_KEY_URL, pubKeyResponseText, "GET", 200, pubKeyResponseHeaders);
      }

      // force upload (happens in 1h)
      await EWE.testing._uploadCdp();

      let requestLogs;
      await waitForAssertion(async() => {
        requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      }, 2 * 1000);
      const retryPayload = requestLogs[0].body.payload;
      expect(retryPayload).toHaveProperty("public_key_id");
      expect(retryPayload).not.toHaveProperty("encrypted_data"); // very first ping

      let storageResult =
          await browser.storage.local.get([CDP_STORAGE_3_KEY]);
      let storage = storageResult[CDP_STORAGE_3_KEY];

      expect(storage).not.toHaveProperty("lastError");
      expect(storage).not.toHaveProperty("lastDomainStats");
      expect(storage).not.toHaveProperty("lastUtid");
    });

    it("sends the data in retry ping after public key server is up again", async function() {
      const response = await fetch(PUBLIC_KEY_URL);
      const pubKeyResponseText = await response.text();
      const pubKeyResponseHeaders = Object.fromEntries(
        response.headers.entries());

      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
      await startMetricsUploaderWithTestArgs();

      let requestLogs;
      await waitForAssertion(async() => {
        requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);

        // the very first ping does not include domain stats
        expect(requestLogs).toHaveLength(1);
        const veryFirstPingPayload = requestLogs[0].body.payload;
        expect(veryFirstPingPayload).not.toHaveProperty("encrypted_data");
      });

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

      try {
        // simulate public key server is down
        await setEndpointResponse(
          PUBLIC_KEY_URL, pubKeyResponseText, "GET", 404);

        // force data upload
        await EWE.testing._uploadCdp();

        await assertCdpError();
      }
      finally {
        await setEndpointResponse(
          PUBLIC_KEY_URL, pubKeyResponseText, "GET", 200, pubKeyResponseHeaders);
      }

      await clearRequestLogs();

      // force upload (happens in 1h)
      await EWE.testing._uploadCdp();

      await waitForAssertion(async() => {
        requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      }, 2 * 1000);
      const retryPayload = requestLogs[0].body.payload;
      expect(retryPayload).toHaveProperty("public_key_id");
      expect(retryPayload).toHaveProperty("encrypted_data");

      let storageResult =
          await browser.storage.local.get([CDP_STORAGE_3_KEY]);
      let storage = storageResult[CDP_STORAGE_3_KEY];

      expect(storage).not.toHaveProperty("lastError");
      expect(storage).not.toHaveProperty("lastDomainStats");
      expect(storage).not.toHaveProperty("lastUtid");
    });

    it("sends the same 'utid' and data in the retry ping for the very first ping", async function() {
      setMinTimeout(this, 20 * 1000);

      const SHORT_ERROR_DELAY_MS = 2 * MILLIS_IN_SECOND;

      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

        await EWE.testing.stopCdpMetricsUploader();
        await clearRequestLogs();

        // configure backend to return error
        await setEndpointResponse(PING_URL, {}, "POST", 500);

        await EWE.testing.startCdpMetricsUploader(
          CDP_PHASE_3_ARGS, SHORT_ERROR_DELAY_MS);

        let requestLogs;
        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);

          // the very first ping does not include domain stats
          expect(requestLogs).toHaveLength(1);
        });
        const errorPayload = requestLogs[0].body.payload;

        let storage = await assertCdpError();
        expect(storage).toHaveProperty("lastDomainStats");
        expect(storage).toHaveProperty("lastUtid");

        // configure backend to return ok
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);

        // retry ping
        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(2);
        }, 2 * SHORT_ERROR_DELAY_MS);
        const retryPayload = requestLogs[1].body.payload;
        expect(retryPayload).toEqual(errorPayload);

        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage).not.toHaveProperty("lastError");
        expect(storage).not.toHaveProperty("lastDomainStats");
        expect(storage).not.toHaveProperty("lastUtid");
      }
      finally {
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);
      }
    });

    it("sends the 'last_ping' of the last successful ping in retry ping", async function() {
      setMinTimeout(this, 20 * 1000);

      const SHORT_ERROR_DELAY_MS = 2 * MILLIS_IN_SECOND;

      try {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

        await EWE.testing.stopCdpMetricsUploader();
        await clearRequestLogs();

        await EWE.testing.startCdpMetricsUploader(
          CDP_PHASE_3_ARGS, SHORT_ERROR_DELAY_MS);

        let requestLogs;
        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);

          // the very first ping does not include domain stats
          expect(requestLogs).toHaveLength(1);
        });
        let storageResult1 =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage1 = storageResult1[CDP_STORAGE_3_KEY];
        expect(storage1).toHaveProperty("lastPing");
        const lastSuccessFulPing = storage1.lastPing;

        // Populate domain stats
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

        // Configure backend to return error
        await setEndpointResponse(PING_URL, {}, "POST", 500);

        // Force the second ping with domain stats included (to fail)
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(2);
        });
        const errorPayload = requestLogs[1].body.payload;
        expect(errorPayload).toHaveProperty("encrypted_data");

        // Configure backend to return ok
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);

        // Retry ping
        // Rorce the third ping
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(3);
        });
        const retryPayload = requestLogs[2].body.payload;
        expect(retryPayload).toHaveProperty("encrypted_data");
        expect(retryPayload).toHaveProperty("last_ping");
        expect(retryPayload.last_ping).toEqual(
          new Date(lastSuccessFulPing).toISOString());

        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage).not.toHaveProperty("lastError");
        expect(storage).not.toHaveProperty("lastDomainStats");
        expect(storage).not.toHaveProperty("lastUtid");
      }
      finally {
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);
      }
    });

    it("does not use 'last_ping' of skipped pings", async function() {
      await startMetricsUploaderWithTestArgs();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1); // the very first ping
      }, LOGS_WAIT_INTERVAL_MS);

      let storageResult =
          await browser.storage.local.get([CDP_STORAGE_3_KEY]);
      let storage = storageResult[CDP_STORAGE_3_KEY];
      expect(storage).toHaveProperty("lastPing");

      const firstPingTimestamp = storage.lastPing;

      // No new navigation, thus no new data. The ping is skipped
      await EWE.testing._uploadCdp();

      storageResult =
          await browser.storage.local.get([CDP_STORAGE_3_KEY]);
      storage = storageResult[CDP_STORAGE_3_KEY];
      expect(storage).toHaveProperty("lastPing");
      expect(firstPingTimestamp).toEqual(firstPingTimestamp);

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1); // no new pings are sent
      });

      await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
      // Has navigation, thus has new data
      await EWE.testing._uploadCdp();

      let secondPingLastPing;
      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(2);
        secondPingLastPing = requestLogs[1].body.payload.last_ping;
      });

      expect(secondPingLastPing).toEqual(
        new Date(firstPingTimestamp).toISOString());
    });

    it("does not send the sessions twice - in both failed ping and retry ping", async function() {
      setMinTimeout(this, 20 * 1000);

      try {
        await EWE.testing.stopCdpMetricsUploader();
        await clearRequestLogs();

        await EWE.testing.startCdpMetricsUploader(
          CDP_PHASE_3_ARGS, ERROR_DELAY_MS);

        let requestLogs;
        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);

          // the very first ping
          expect(requestLogs).toHaveLength(1);
        });

        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

        // configure backend to return error
        await setEndpointResponse(PING_URL, {}, "POST", 500);
        await EWE.testing._uploadCdp(); // force ping

        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);

          // the very first ping + forced ping
          expect(requestLogs).toHaveLength(2);
        });

        await waitForAssertion(async() => {
          let storageResult =
              await browser.storage.local.get([CDP_STORAGE_3_KEY]);
          let storage = storageResult[CDP_STORAGE_3_KEY];

          expect(storage.lastError).toEqual(expect.any(Number));
          // We expect the lastError to be in the form of a date that is
          // close to now, but there are multiple threads and this test is
          // async so it won't be exactly equal.
          expect(Math.abs(storage.lastError - Date.now()))
              .toBeLessThan(MILLIS_IN_MINUTE);
          expect(storage).toHaveProperty("lastDomainStats");
          expect(storage).toHaveProperty("lastUtid");
        });

        const errorPayload = requestLogs[1].body.payload;
        const errorDomainStats = await decryptDomainStats(errorPayload);
        expect(errorDomainStats.ds).toEqual([{
          i: CROSS_DOMAIN,
          s: 1,
          p: 1,
          b: 0
        }]);

        // configure backend to return ok
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);

        // navigation that shouldn't be counted in retry ping,
        // but should be counted in the next regular ping
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

        // simulate retry ping
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(3);
        });

        let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
        let storage = storageResult[CDP_STORAGE_3_KEY];

        expect(storage).not.toHaveProperty("lastError");
        expect(storage).not.toHaveProperty("lastDomainStats");
        expect(storage).not.toHaveProperty("lastUtid");

        // regular ping
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(4);
        });
        const regularPayload = requestLogs[3].body.payload;
        const regularDomainStats = await decryptDomainStats(regularPayload);
        // no "cross domain" sessions is expected here
        expect(regularDomainStats.ds).toEqual([{
          i: TEST_PAGES_DOMAIN,
          s: 1,
          p: 1,
          b: 0
        }]);
      }
      finally {
        await setEndpointResponse(PING_URL, JSON.stringify({
          token: "someToken"
        }), "POST", 200);
      }
    });

    it("does not send the ping if user has opted out", async function() {
      await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;

      await EWE.cdp.setOptOut(true);

      await startMetricsUploaderWithTestArgs();

      await waitForAssertion(async() => {
        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(0);
      });
    });

    describe("Metric Upload Integration", function() {
      it("can successfully send a ping payload to the eyeometry staging server", async function() {
        setMinTimeout(this, 11000);

        // These credentials can be set by setting the environment
        // variables with the same name before running webpack.
        let cdpArgs = {
          pingUrl: webpackDotenvPlugin.EWE_CDP_PING_URL,
          publicKeyUrl: webpackDotenvPlugin.EWE_CDP_PUBLIC_KEY_URL,
          bearer: webpackDotenvPlugin.EWE_CDP_BEARER
        };
        if (!cdpArgs.pingUrl || !cdpArgs.publicKeyUrl || !cdpArgs.bearer) {
          this.skip();
        }

        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await EWE.testing.startCdpMetricsUploader(cdpArgs);

        // wait for the very first ping sent
        let openPingTimestamp;
        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
          let storage = storageResult[CDP_STORAGE_3_KEY];
          expect(storage).toHaveProperty("lastPing");
          openPingTimestamp = storage.lastPing;
        });

        // We need to navigate to another domain, as the session for
        // "cross domain" is pending and will be not counted in domains_stats
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
        await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html`).loaded;

        // force send the ping
        await EWE.testing._uploadCdp();

        // wait for the data ping sent
        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_3_KEY]);
          let storage = storageResult[CDP_STORAGE_3_KEY];

          expect(storage.lastPing).toBeGreaterThan(openPingTimestamp);
          expect(storage).not.toHaveProperty("lastError");
        }, 10000);
      });
    });

    describe("Encryption", function() {
      const PEM_ENCODED_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA6D2rA84PYRZQFv4NL4V5
UMCivHsmRE8JticuyWzTAx7vyptEjsstuk/oW3v25+glc4Jr0zi8z9IzUUJ097tX
RioZ9fc5bCtUFLU0+XbxiUiMBYsocPkFr/XkDClWDF7OcCvZcltZfbRnOsui8v5W
zEK1nWFTv3PPHhpBbKjnP+acnI9mxxbjC9kYzytyH03vLEGPayDujP5QyZAH6U9v
3RB6pS/46vrVbYbNuMHYrUQGSNAXotweKqx/iMs7kur5Xp0ugUoyR6mrBftmk2vP
Z5y4mIqwUhGMX1XLzQRVhT+7ngKK1QhxB0ruQuX/Dvn8Y6bIE+ola8B3txJ31l5I
8+05Dcr4AAmkq67KQUTcce/+0Nz7MWWMObf12+S/j95b4nqROGrNlwtV83MoYH8e
QtJr9Ejt+zdl/OAahyp4zvAiPFLA8fRQGoHhPXt/fYHsxySG7OPMazLJxFarmWT/
UlvVm112lG9ij3Mc/f64cKzmenKoIe0c2HSGMxFagEDnAgMBAAE=
-----END PUBLIC KEY-----`;

      it("imports public RSA key", async function() {
        const publicKey = await EWE.testing._importRSAPublicKey(
          PEM_ENCODED_PUBLIC_KEY);
        expect(publicKey).not.toBeNull();
      });

      it("requests public key", async function() {
        await EWE.testing.startCdpMetricsUploader(CDP_PHASE_3_ARGS, 3000);
        const {publicKey, keyId} = await EWE.testing._requestPublicKey();
        expect(publicKey).not.toBeNull();
        expect(keyId).not.toBeNull();
      });

      it("is able to decrypt and decompress the payload", async function() {
        setMinTimeout(this, 20 * 1000);

        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        let payload;
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);
        expect(payload).not.toHaveProperty("encrypted_data"); // the very first ping

        // We need to navigate to another domain, as the session for
        // "cross domain" is pending and will be not counted in domains_stats
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
        // increase page views counter
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;
        // add a blockthrough aa pageview
        await new Page(`${TEST_PAGES_URL}/blockthrough-aapv.html`).loaded;
        await new Page("https://adblockplus.org").loaded;
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(2);
          payload = requestLogs[1].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);

        expect(payload).toHaveProperty("encrypted_data");
        expect(payload).toHaveProperty("public_key_id");

        const domainStats = await decryptDomainStats(payload);
        expect(domainStats.ds).toEqual(expect.arrayContaining([{
          i: CROSS_DOMAIN,
          s: 1,
          p: 1,
          b: 0
        }, {
          i: TEST_PAGES_DOMAIN,
          s: 1,
          p: 3,
          b: 1
        }, {
          i: "adblockplus.org",
          s: 1,
          p: expect.any(Number),
          b: 0
        }]));
      });

      it("stops retry sending after reaching the limit", async function() {
        await new Page(`${CROSS_DOMAIN_URL}/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        let payload;
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);
        expect(payload).not.toHaveProperty("encrypted_data"); // the very first ping

        // simulate backend is down
        await setEndpointResponse(PING_URL, {}, "POST", 500);

        // retry to ping several times and make sure same utid is used
        let attempt = 0;
        let lastUtid;
        const MAX_RETRIES = 3;
        while (attempt++ < MAX_RETRIES) {
          await EWE.testing._uploadCdp();

          await waitForAssertion(async() => {
            let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
            expect(requestLogs).toHaveLength(1 + attempt);
            payload = requestLogs[requestLogs.length - 1].body.payload;
          }, LOGS_WAIT_INTERVAL_MS);

          // make sure we resend the last domains stats
          const utid = payload.utid;
          if (lastUtid) {
            expect(utid).toEqual(lastUtid);
          }
          lastUtid = utid;
        }
        const failedDomainStats = await decryptDomainStats(payload);
        expect(failedDomainStats.ds).toHaveLength(1);

        // simulate backend is up again
        await setEndpointResponse(PING_URL, {}, "POST", 200);

        // We need to navigate to another domain, as the session for
        // "cross domain" is pending and will be not counted in domains_stats
        await new Page(`${TEST_PAGES_URL}/image.html`).loaded;

        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1 + MAX_RETRIES + 1);
          payload = requestLogs[requestLogs.length - 1].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);

        // new domains stats is sent
        expect(payload.utid).not.toEqual(lastUtid);
        const successfulDomainStats = await decryptDomainStats(payload);
        expect(successfulDomainStats.ds).toEqual([{
          i: TEST_PAGES_DOMAIN,
          s: 1,
          p: 1,
          b: 0
        }]);
      });

      it("limits the payload to 50Kb", async function() {
        async function populateCdpData(length) {
          let domains = [];
          let counters = [];
          for (let i = 0; i < length; i++) {
            domains.push(SITE_ID + i);
            counters.push(i);
          }
          await EWE.testing._setCdpDataArray(
            EVENT_SESSION_START, domains, counters);
        }

        // populate the data
        await populateCdpData(100 * 1000); // domains visited

        await startMetricsUploaderWithTestArgs();

        // Wait for first ping
        let payload;
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);

        // ping with actual data
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(2);
          payload = requestLogs[requestLogs.length - 1].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);

        // payload should be limited
        expect(payload.encrypted_data.length < 50 * 1024).toEqual(true);
      });
    });
  });
});
