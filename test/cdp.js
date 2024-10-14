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
import {v4 as uuidv4} from "uuid";
import {wait} from "./polling.js";
import {MILLIS_IN_MINUTE, MILLIS_IN_DAY, MILLIS_IN_HOUR, MINUTES_IN_DAY,
        MINUTES_IN_HOUR,
        MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

import {EWE, addFilter, getTestEvents} from "./messaging.js";
import {TEST_ADMIN_PAGES_URL, TEST_PAGES_PORT} from "./test-server-urls.js";
import {isChromiumBased, isFirefox, Page, setMinTimeout, executeScript,
        waitForAssertion, clearRequestLogs, getRequestLogs, setEndpointResponse,
        clearEndpointResponse} from "./utils.js";
import {setFeatureFlags} from "./messaging.js";
import {base64ToArrayBuffer} from "adblockpluscore/lib/rsa.js";

const WEBEXT_DOT_COM = "webext.com";
const SUB_DOT_WEBEXT_DOT_COM = "sub." + WEBEXT_DOT_COM;
const WEBEXT_WILDCARD = "webext.*";
const SITE_ID = "siteId";

const EVENT_PAGE_VIEW = "page_view";
const EVENT_SESSION_START = "session_start";
const EVENT_BLOCKING = "blocking";

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
  const decoder = new TextDecoder("utf-8");
  return JSON.parse(decoder.decode(decryptedDataArray));
}

describe("CDP opt-out", function() {
  const KEY = "cdp_opt_in_out";

  it("is disabled by default for Firefox only", async function() {
    expect(await EWE.cdp.isOptOut()).toEqual(isFirefox());
  });

  it("checks to be opted out on Firefox by default", async function() {
    if (!isFirefox()) {
      this.skip();
    }

    expect(await EWE.cdp.isOptOut()).toEqual(true);
  });

  it("checks to be opted in on Firefox by user", async function() {
    if (!isFirefox()) {
      this.skip();
    }

    await EWE.cdp.setOptOut(false);
    expect(await EWE.cdp.isOptOut()).toEqual(false);
    expect(await EWE.testing._getPrefs(KEY)).toEqual(2); // OPTED_IN_BY_USER
  });

  it("checks to be opted in not on Firefox by default", async function() {
    if (isFirefox()) {
      this.skip();
    }

    expect(await EWE.cdp.isOptOut()).toEqual(false);
  });

  it("checks to be opted out by user", async function() {
    await EWE.cdp.setOptOut(true);

    expect(await EWE.cdp.isOptOut()).toEqual(true);
    expect(await EWE.testing._getPrefs(KEY)).toEqual(3); // OPTED_OUT_BY_USER
  });
});

describe("CDP on Chromium-based browsers", function() {
  const PING_URL = `${TEST_ADMIN_PAGES_URL}/cdp-ping`;
  const AGGREGATE_URL = `${TEST_ADMIN_PAGES_URL}/cdp-aggregate`;
  const PUBLIC_KEY_URL = `${TEST_ADMIN_PAGES_URL}/public-key`;
  const CDP_BEARER = "SSBhbSBhIGJlYXIuLi4gZXIuLi4gUkFXUg==";
  const CDP_STORAGE_2_KEY = "ewe:cdp-metrics-uploader";
  const CDP_STORAGE_3_KEY = "ewe:cdp-metrics-uploader-3";

  const CDP_PHASE_2_ARGS = {
    pingUrl: PING_URL,
    aggregateUrl: AGGREGATE_URL,
    bearer: CDP_BEARER
  };

  const EXPIRATION_INTERVAL_KEY = "cdp_session_expiration_interval";
  let originalUserOptedOut;
  let originalExpirationInterval;

  before(async function() {
    // DNS mapping webext.com to 127.0.0.1 is configured
    // for all Chromium-based browsers during the tests.
    if (!isChromiumBased()) {
      this.skip();
    }
    originalUserOptedOut = await EWE.cdp.isOptOut();
  });

  beforeEach(async function() {
    setMinTimeout(this, 10 * 1000);

    originalExpirationInterval = await EWE.testing._getPrefs(
      EXPIRATION_INTERVAL_KEY);
    await EWE.testing._clearCdpData();
    await EWE.testing._clearCdpActivity();
    await EWE.testing._setCdpConfig([[[WEBEXT_DOT_COM], SITE_ID]]);
    await EWE.cdp.setOptOut(false);
  });

  async function restoreSessionExpirationInterval() {
    await EWE.testing._setPrefs(
      EXPIRATION_INTERVAL_KEY, originalExpirationInterval);
  }

  afterEach(async function() {
    await EWE.testing._clearCdpData();
    await restoreSessionExpirationInterval();
  });

  after(async function() {
    await EWE.testing._restoreCdpConfig();
    await EWE.cdp.setOptOut(originalUserOptedOut);
  });

  async function assertEventsPhase2(siteId, eventType, size) {
    await EWE.debugging.ensureEverythingHasSaved();

    let data;
    await waitForAssertion(async() => {
      data = await EWE.testing._getCdpData(eventType, siteId);
      expect(data).toHaveLength(size);
    });
    return data;
  }

  describe("Phase 2", function() {
    const assertEvents = assertEventsPhase2;

    beforeEach(async function() {
      await setFeatureFlags({cdpPhase3: false});
    });

    it("tracks only listed domains", async function() {
      await new Page("http://localhost:3000/image.html").loaded;
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 0);
    });

    it("supports domain wildcards", async function() {
      await EWE.testing._setCdpConfig([
        [[WEBEXT_WILDCARD], SITE_ID]
      ]);
      await new Page(`http:/${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 1);
    });

    it("tracks domains and subdomains, but reports siteIds", async function() {
      setMinTimeout(this, 10000);

      await EWE.testing._setCdpConfig([
        [[WEBEXT_DOT_COM], SITE_ID]
      ]);

      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 0);
      await assertEvents(SUB_DOT_WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 1);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
      await assertEvents(SITE_ID, EVENT_BLOCKING, 1);
    });

    it("reports same siteId for different domains", async function() {
      const LOCALHOST = "localhost";

      await EWE.testing._setCdpConfig([
        [[WEBEXT_DOT_COM, LOCALHOST], SITE_ID] // multiple domains, one siteId
      ]);
      await addFilter("image.png");

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

      for (const eachSiteId of
        [WEBEXT_DOT_COM, SUB_DOT_WEBEXT_DOT_COM, LOCALHOST]) {
        for (const eachEventType of
          [EVENT_PAGE_VIEW, EVENT_SESSION_START, EVENT_BLOCKING]) {
          await assertEvents(eachSiteId, eachEventType, 0);
        }
      }

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 2);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
      await assertEvents(SITE_ID, EVENT_BLOCKING, 2);
    });

    it("does not track if opted out by user", async function() {
      await EWE.cdp.setOptOut(true);
      expect(await EWE.cdp.isOptOut()).toEqual(true);
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 0);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 0);
      await assertEvents(SITE_ID, EVENT_BLOCKING, 0);
    });

    it("tracks 'blocking' events", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_BLOCKING, 1);
    });

    it("tracks 'page_view' events", async function() {
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 1);
    });

    it("tracks 'session_start' events", async function() {
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("counts only main frames", async function() {
      const LOCALHOST = "localhost";
      const LOCALHOST_SITE_ID = "localhostSiteId";
      await EWE.testing._setCdpConfig([
        [[LOCALHOST], LOCALHOST_SITE_ID]
      ]);

      await new Page(`http://${LOCALHOST}:3000/iframe.html`).loaded;
      await assertEvents(LOCALHOST_SITE_ID, EVENT_PAGE_VIEW, 1);
    });

    it("return events timestamps", async function() {
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

      const data = await assertEvents(SITE_ID, EVENT_SESSION_START, 1);

      // every item is an event timestamp
      expect(data).toEqual(expect.arrayContaining([expect.any(Number)]));
      // event happened less than 10 seconds ago
      expect((Date.now() - data[0]) < 10000).toEqual(true);
    });

    it("does not consider tab reload within expiration interval as a new session", async function() {
      setMinTimeout(this, 10 * 1000);

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      await page.loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);

      // within session expiration interval,
      // so it's considered as session continuation, not a new session
      await page.reload();

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("considers tab reload larger than default expiration interval as a new session", async function() {
      setMinTimeout(this, 10 * 1000);

      await EWE.testing._setPrefs(EXPIRATION_INTERVAL_KEY, 0); // 0 second

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      await page.loaded;

      // Larger than session expiration interval,
      // so it's considered as a new session
      await page.reload();

      await assertEvents(SITE_ID, EVENT_SESSION_START, 2);
    });

    it("considers tab reload larger than default expiration interval as a new session having another tab with the same domain", async function() {
      setMinTimeout(this, 10 * 1000);

      const sessionExpirationInterval = 1000; // 1 second
      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

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

      await assertEvents(SITE_ID, EVENT_SESSION_START, 2);
    });

    it("considers same website navigation with larger than default expiration interval as a new session", async function() {
      setMinTimeout(this, 10 * 1000);

      const sessionExpirationInterval = 1000; // 1 second
      const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;
      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

      await new Page(url).loaded;

      // wait longer than session expiration interval
      const sleepInterval = 2 * sessionExpirationInterval;
      await new Promise(r => setTimeout(r, sleepInterval));

      await new Page(url).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 2);
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

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("tracks same domain with wildcard navigation in different tabs as the same session", async function() {
      // if user opens multiple tabs with the same domain with wildcard,
      // we consider it to be the same session
      setMinTimeout(this, 30 * 1000);

      await EWE.testing._setCdpConfig([
        [[WEBEXT_WILDCARD], SITE_ID]
      ]);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
      await new Page("http://webext.co.uk:3000/image.html", false, false).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("tracks same subdomain navigation in different tabs as the same session", async function() {
      // if user opens multiple tabs with the same domain/subdomain,
      // we consider it to be the same session
      setMinTimeout(this, 10 * 1000);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("tracks same subdomain with wildcard navigation in different tabs as the same session", async function() {
      // if user opens multiple tabs with the same
      // domain/subdomain with wildcard,
      // we consider it to be the same session
      setMinTimeout(this, 10 * 1000);

      await EWE.testing._setCdpConfig([
        [[WEBEXT_WILDCARD], SITE_ID]
      ]);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("tracks different domain navigations in different tabs as different sessions", async function() {
      setMinTimeout(this, 10 * 1000);

      const LOCALHOST = "localhost";
      const LOCALHOST_SITE_ID = "localhostSiteId";
      await EWE.testing._setCdpConfig([
        [[WEBEXT_DOT_COM], SITE_ID],
        [[LOCALHOST], LOCALHOST_SITE_ID]
      ]);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`, false, false).loaded;
      await new Page(`http://${LOCALHOST}:3000/image.html`, false, false).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
      await assertEvents(LOCALHOST_SITE_ID, EVENT_SESSION_START, 1);
    });

    it("does not consider the session finished if having other tabs for the host after one tab closed", async function() {
      setMinTimeout(this, 10 * 1000);

      const url = `http://${WEBEXT_DOT_COM}:3000/image.html`;
      const page1 = new Page(url, false, false);
      await page1.loaded;

      const page2 = new Page(url, false, false);
      await page2.loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);

      await page2.remove();
      await page1.reload();

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
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

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("prefers exact entries over wildcarded and reports for one entry only", async function() {
      const WILDCARD_SITE_ID = "wildcardSiteId";

      await EWE.testing._setCdpConfig([
        /*
        WARNING: the order makes a difference:
        * exact matches should come earlier than wildcarded
          (eg. exact comain earlier than it's wildcarded flavour)
        */
        [[WEBEXT_DOT_COM], SITE_ID],
        [[WEBEXT_WILDCARD], WILDCARD_SITE_ID]
      ]);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);

      // technically it also matches wildcarded entry too,
      // but we report for only one entry
      await assertEvents(WILDCARD_SITE_ID, EVENT_SESSION_START, 0);
    });

    it("prefers subdomain entries over higher level domain with exact match", async function() {
      setMinTimeout(this, 15 * 1000);

      const SUBDOMAIN_SITE_ID = "subdomainSiteId";

      /*
      WARNING: the order makes a difference:
      * more specific site buckets should come earlier
        (eg. subdomain earlier than it's higher level domain)
      */

      // The right order
      await EWE.testing._setCdpConfig([
        [[SUB_DOT_WEBEXT_DOT_COM], SUBDOMAIN_SITE_ID], // before WEBEXT_DOT_COM
        [[WEBEXT_DOT_COM], SITE_ID]
      ]);

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SUBDOMAIN_SITE_ID, EVENT_SESSION_START, 1);

      // technically it also matches higher level domain entry too,
      // but we report for only one entry (the first wins)
      await assertEvents(SITE_ID, EVENT_SESSION_START, 0);

      await EWE.testing._clearCdpData(EVENT_SESSION_START, SITE_ID);
      await EWE.testing._clearCdpData(EVENT_SESSION_START, SUBDOMAIN_SITE_ID);

      // The wrong order
      await EWE.testing._setCdpConfig([
        [[WEBEXT_DOT_COM], SITE_ID], // it should come after more specific
        [[SUB_DOT_WEBEXT_DOT_COM], SUBDOMAIN_SITE_ID]
      ]);

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SUBDOMAIN_SITE_ID, EVENT_SESSION_START, 0);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("prefers subdomain entries over higher level domain with wildcarded match", async function() {
      setMinTimeout(this, 15 * 1000);

      const SUB_DOT_WEBEXT_WILDCARD = "sub." + WEBEXT_WILDCARD;
      const SUBDOMAIN_SITE_ID = "subdomainSiteId";

      /*
      WARNING: the order makes a difference:
      * more specific site buckets should come earlier
        (eg. subdomain earlier than it's higher level domain)
      */

      // The right order
      await EWE.testing._setCdpConfig([
        // the following line must be before WEBEXT_WILDCARD
        [[SUB_DOT_WEBEXT_WILDCARD], SUBDOMAIN_SITE_ID],
        [[WEBEXT_WILDCARD], SITE_ID]
      ]);

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SUBDOMAIN_SITE_ID, EVENT_SESSION_START, 1);

      // technically it also matches higher level domain entry too,
      // but we report for only one entry (the first wins)
      await assertEvents(SITE_ID, EVENT_SESSION_START, 0);

      await EWE.testing._clearCdpData(EVENT_SESSION_START, SITE_ID);
      await EWE.testing._clearCdpData(EVENT_SESSION_START, SUBDOMAIN_SITE_ID);

      // The wrong order
      await EWE.testing._setCdpConfig([
        [[WEBEXT_WILDCARD], SITE_ID], // it should come after more specific
        [[SUB_DOT_WEBEXT_WILDCARD], SUBDOMAIN_SITE_ID]
      ]);

      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SUBDOMAIN_SITE_ID, EVENT_SESSION_START, 0);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("supports separate site buckets for search use case", async function() {
      // we might want to track "search.domain.com" separate from
      // ["domain.com", "domain.co.uk", etc.]

      setMinTimeout(this, 10 * 1000);

      // bucket 1
      const SEARCH_WEBEXT_DOT_COM = "search." + WEBEXT_DOT_COM;
      const SEARCH_SITE_ID = "searchSiteId";

      // bucket 2 (wildcard)
      // technically it means we keep 2 separate match entries in CDP config
      await EWE.testing._setCdpConfig([
        /*
        WARNING: the order makes a difference:
        * more specific site buckets should come earlier
          (eg. subdomain earlier than it's higher level domain)
        * exact matches should come earlier than wildcarded
          (eg. exact comain earlier than it's wildcarded flavour)
        */
        [[SEARCH_WEBEXT_DOT_COM], SEARCH_SITE_ID],
        [[WEBEXT_WILDCARD], SITE_ID]
      ]);

      // bucket 1
      await new Page(`http://${SEARCH_WEBEXT_DOT_COM}:3000/image.html`).loaded;

      // bucket 2
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await new Page("http://webext.co.uk:3000/image.html").loaded; // regional
      await new Page(`http://${SUB_DOT_WEBEXT_DOT_COM}:3000/image.html`).loaded; // subdomain

      await assertEvents(SEARCH_SITE_ID, EVENT_PAGE_VIEW, 1);
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 3);

      await assertEvents(SEARCH_SITE_ID, EVENT_SESSION_START, 1);
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    it("supports History API", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/history.html`).loaded;

      // 1 event for "history.html" and 1 event for "history-after-pushState.js"
      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 2);

      // still the same session
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);
    });

    async function assertUserActionsSessionEvents(
      callback, sessionDuration, clear = true, eventsCount = 1) {
      if (clear) {
        await EWE.testing._clearCdpData();
        await EWE.testing._clearCdpActivity();
        await Page.removeCurrent();
        await EWE.testing._clearFrameState();
      }

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      const tabId = await page.loaded;

      const sleepInterval = 100;
      const attempts = sessionDuration / sleepInterval;

      for (let i = 0; i < attempts; i++) {
        await new Promise(r => setTimeout(r, sleepInterval));

        // simulated user events extend the session expiration interval
        await executeScript(tabId, callback, []);
      }

      // now sleep a bit more to let the session expire,
      // if it's not extended by user actions
      await new Promise(r => setTimeout(r, sleepInterval));

      // the session is expected to be still not expired ...
      await page.reload();
      await page.remove();

      // ... or a new session is started
      await assertEvents(SITE_ID, EVENT_SESSION_START, eventsCount);
    }

    it("extends session expiration time due to user actions", async function() {
      setMinTimeout(this, 60 * 1000);

      const sessionExpirationInterval = 6 * MILLIS_IN_SECOND;

      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

      await addFilter("image.png");

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

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(SITE_ID, EVENT_SESSION_START, 1);

      await EWE.testing.stopCdp();
      try {
        await EWE.testing.setCdpLoadDelay(loadDelay);
        await EWE.testing.startCdp();

        // If there is no data (existing sessions) loaded,
        // it's considered to be a new session.
        // Otherwise we know there is a pending session.
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        // the deferred events are processed now
        await new Promise(r => setTimeout(r, loadDelay));

        await assertEvents(SITE_ID, EVENT_SESSION_START, 1);// not a new session
      }
      finally {
        await EWE.testing.setCdpLoadDelay(0);
      }
    });

    it("clears the events for the domain with timestamp older than passed", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      await page.loaded;
      await EWE.debugging.ensureEverythingHasSaved();

      let data = await EWE.testing._getCdpData(EVENT_PAGE_VIEW, SITE_ID);
      expect(data).not.toEqual([]);
      const firstTs = data[0];

      await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, SITE_ID, firstTs);
      data = await EWE.testing._getCdpData(EVENT_PAGE_VIEW, SITE_ID);
      expect(data).not.toEqual([]);
      expect(data[0]).toEqual(firstTs);

      await EWE.testing._clearCdpData(
        EVENT_PAGE_VIEW, SITE_ID, firstTs + 1);

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 0);
    });

    it("clears the events", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 1);

      await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, SITE_ID);

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 0);
    });

    it("clears the events for the domain", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      const LOCALHOST = "localhost";
      const LOCALHOST_SITE_ID = "localhostSiteId";
      await EWE.testing._setCdpConfig([
        [[WEBEXT_DOT_COM], SITE_ID],
        [[LOCALHOST], LOCALHOST_SITE_ID]
      ]);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 1);
      await assertEvents(LOCALHOST_SITE_ID, EVENT_PAGE_VIEW, 1);

      await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, SITE_ID);

      await assertEvents(SITE_ID, EVENT_PAGE_VIEW, 0); // cleared
      await assertEvents(LOCALHOST_SITE_ID, EVENT_PAGE_VIEW, 1); // not cleared
    });

    it("notifies the listeners", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await EWE.debugging.ensureEverythingHasSaved();

      expect(getTestEvents("cdp.onCdpItem.page_view")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: SITE_ID,
        eventType: EVENT_PAGE_VIEW
      }]]);

      expect(getTestEvents("cdp.onCdpItem.blocking")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: SITE_ID,
        eventType: EVENT_BLOCKING
      }]]);

      expect(getTestEvents("cdp.onCdpItem.session_start")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: SITE_ID,
        eventType: EVENT_SESSION_START
      }]]);

      expect(getTestEvents("cdp.onCdpItem.all")).toEqual(expect.arrayContaining([
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: SITE_ID,
          eventType: EVENT_PAGE_VIEW
        }]),
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: SITE_ID,
          eventType: EVENT_BLOCKING
        }]),
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: SITE_ID,
          eventType: EVENT_SESSION_START
        }])
      ]));
    });

    describe("Metric Upload Startup", function() {
      it("assigns a random cutoff time of day for session bucketing on first run", async function() {
        let storage = await browser.storage.local.get([CDP_STORAGE_2_KEY]);

        expect(storage[CDP_STORAGE_2_KEY]).toHaveProperty("dayCutoffMinutes");

        let dayCutoffMinutes = storage[CDP_STORAGE_2_KEY].dayCutoffMinutes;

        expect(dayCutoffMinutes).toBeGreaterThanOrEqual(0);
        expect(dayCutoffMinutes).toBeLessThan(MINUTES_IN_DAY);
      });
    });

    describe("Metric Upload Running", function() {
      // Some of these unfortunately need to wait for pings to happen (or not
      // happen) and so can get a bit long.
      setMinTimeout(this, 15000);

      beforeEach(async function() {
        await clearRequestLogs();
        await EWE.testing.resetCdpMetricsUploader();
      });

      afterEach(async function() {
        await clearEndpointResponse(AGGREGATE_URL);
        await clearEndpointResponse(PING_URL);
      });

      const ERROR_DELAY_MS = MILLIS_IN_HOUR;

      async function startMetricsUploaderWithTestArgs() {
        await EWE.testing.startCdpMetricsUploader(
          CDP_PHASE_2_ARGS, ERROR_DELAY_MS);
      }

      function createAggregateBundleToSend() {
        let now = Date.now();
        return {
          siteId: SITE_ID,
          referenceDateLocal: "2024-05-13",
          utid: uuidv4(),
          scheduledSendTimestamp: now
        };
      }

      function createAggregateBundleNotToSendYet() {
        let now = Date.now();
        return {
          siteId: SITE_ID,
          referenceDateLocal: "2024-05-14",
          utid: uuidv4(),
          scheduledSendTimestamp: now + MILLIS_IN_DAY
        };
      }

      it("creates a scheduled aggregate metrics upload on the first visit to a site", async function() {
        await startMetricsUploaderWithTestArgs();

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.bundles).toEqual([{
            siteId: SITE_ID,
            referenceDateLocal: expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
            utid: expect.any(String),
            scheduledSendTimestamp: expect.any(Number)
          }]);

          let minScheduledSend =
              new Date(storage.bundles[0].referenceDateLocal).getTime() +
              storage.dayCutoffMinutes * MILLIS_IN_MINUTE +
              MILLIS_IN_DAY;
          expect(storage.bundles[0].scheduledSendTimestamp)
            .toBeGreaterThanOrEqual(minScheduledSend);
          expect(storage.bundles[0].scheduledSendTimestamp)
            .toBeLessThanOrEqual(minScheduledSend + 12 * MILLIS_IN_HOUR);
        });
      });

      it("immediately sends a request to the ping url on the first visit to a site", async function() {
        await startMetricsUploaderWithTestArgs();

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        let payload;

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        });

        let storageResult =
          await browser.storage.local.get([CDP_STORAGE_2_KEY]);
        let storage = storageResult[CDP_STORAGE_2_KEY];

        expect(payload.site_id).toEqual(SITE_ID);
        expect(payload.site_client_id).toEqual(storage.clientIds[SITE_ID]);
        expect(payload.application)
          .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
        expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
        expect(payload.addon_name).toEqual("eyeo-webext-ad-filtering-solution");
        expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
      });

      it("does not create a new scheduled aggregate metrics upload on the second session on a site on the same day", async function() {
        let now = new Date();
        let nowMinutes = now.getHours() * 60 + now.getMinutes();

        // I want to control the dayCutoffMinutes for this test to make sure
        // that the multiple sessions that we have here will never cross the
        // boundary into a new day.
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes:
            (nowMinutes + 12 * MINUTES_IN_HOUR) % MINUTES_IN_DAY
          }
        });

        await startMetricsUploaderWithTestArgs();

        // 0 second, so sessions end immediately
        await EWE.testing._setPrefs(EXPIRATION_INTERVAL_KEY, 0);

        let page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
        await page.loaded;
        // Larger than session expiration interval of 0, so it's considered as a
        // new session
        await page.reload();

        // We need to make sure we wait long enough for the second session to
        // have been picked up.
        await assertEvents(SITE_ID, EVENT_SESSION_START, 2);

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.bundles).toHaveLength(1);
        });
      });

      it("does not send a second ping to the ping url if there's a second session on the same day", async function() {
        let now = new Date();
        let nowMinutes = now.getHours() * 60 + now.getMinutes();

        // I want to control the dayCutoffMinutes for this test to make sure
        // that the multiple sessions that we have here will never cross the
        // boundary into a new day.
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes:
            (nowMinutes + 12 * MINUTES_IN_HOUR) % MINUTES_IN_DAY
          }
        });

        await startMetricsUploaderWithTestArgs();

        // 0 second, so sessions end immediately
        await EWE.testing._setPrefs(EXPIRATION_INTERVAL_KEY, 0);

        let page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
        await page.loaded;
        // Larger than session expiration interval of 0, so it's considered as a
        // new session
        await page.reload();

        // We need to make sure we wait long enough for the second session to
        // have been picked up.
        await assertEvents(SITE_ID, EVENT_SESSION_START, 2);

        // Only one ping sent, and the storage doesn't have others lined up to
        // send later.
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.pingBundles).toHaveLength(0);
        });
      });

      it("creates a new scheduled aggregate metrics upload when a session happens on a new day", async function() {
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: 0,
            bundles: [createAggregateBundleNotToSendYet()]
          }
        });

        await startMetricsUploaderWithTestArgs();

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.bundles).toHaveLength(2);
        });
      });

      it("collects the data for the sessions that relate to previous day", async function() {
        let now = new Date();
        let nowMinutes = now.getHours() * 60 + now.getMinutes();

        // the session relates to previous day (not today)
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: (nowMinutes + 10) // after "now"
          }
        });

        await EWE.testing.setForceEarlyCdpUploads(true);
        try {
          await startMetricsUploaderWithTestArgs();

          await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

          let requestLogs;
          await waitForAssertion(async() => {
            requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
            expect(requestLogs).toHaveLength(1);
          }, 3000);

          expect(requestLogs).toEqual([expect.objectContaining({body: {
            payload: expect.objectContaining({
              sessions_count: 1
            })
          }})]);
        }
        finally {
          await EWE.testing.setForceEarlyCdpUploads(false);
        }
      });

      it("sends a new ping if the previous one happened the previous day", async function() {
        // An aggregate bundle existing is the symbol that a ping happened
        // already on that day. But the date in the bundle is not today.
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: 0,
            bundles: [createAggregateBundleNotToSendYet()]
          }
        });

        await startMetricsUploaderWithTestArgs();

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        });
      });

      it("sends scheduled aggregate metrics", async function() {
        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToSend]
          }
        });

        let dayStart = new Date(bundleToSend.referenceDateLocal).getTime();
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID, [
          dayStart,
          dayStart + 3 * MILLIS_IN_HOUR,
          dayStart + MILLIS_IN_DAY // this one shouldn't be included
        ]);

        await startMetricsUploaderWithTestArgs();

        let payload;

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(
            CDP_PHASE_2_ARGS.aggregateUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        });

        expect(payload.site_id).toEqual(bundleToSend.siteId);
        expect(payload.sessions_count).toEqual(2);
        expect(payload.reference_date_local)
          .toEqual(bundleToSend.referenceDateLocal);
        expect(payload.utid).toEqual(bundleToSend.utid);

        expect(payload.application)
          .toEqual(expect.oneOf(["firefox", "chrome", "headlesschrome", "edg"]));
        expect(payload.application_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));
        expect(payload.addon_name).toEqual("eyeo-webext-ad-filtering-solution");
        expect(payload.addon_version).toEqual(expect.stringMatching(/^\d+(.\d+)+$/));

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.dayCutoffMinutes).toEqual(dayCutoffMinutes);
          expect(storage.bundles).toHaveLength(0);

          expect(await EWE.testing._getCdpData(EVENT_SESSION_START, SITE_ID))
            .toEqual([dayStart + MILLIS_IN_DAY]);
        });
      });

      it("does not send aggregate metrics that aren't scheduled to send yet", async function() {
        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        let bundleToNotSendYet = createAggregateBundleNotToSendYet();
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToNotSendYet, bundleToSend]
          }
        });

        await startMetricsUploaderWithTestArgs();

        // We include one that IS sent in this test case to make sure we
        // don't get a false positive by checking too early.
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
          expect(requestLogs).toHaveLength(1);
          let payload = requestLogs[0].body.payload;
          expect(payload.utid).toEqual(bundleToSend.utid);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.dayCutoffMinutes).toEqual(dayCutoffMinutes);
          expect(storage.bundles).toEqual([bundleToNotSendYet]);
        });
      });

      it("clears metrics without sending them if user has opted out", async function() {
        await EWE.cdp.setOptOut(true);

        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToSend]
          }
        });

        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.bundles).toHaveLength(0);
        });

        let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
        expect(requestLogs).toHaveLength(0);
      });

      it("sets an error timestamp if the server has an error when sending an aggregate", async function() {
        await setEndpointResponse(AGGREGATE_URL, {}, "POST", 500);

        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToSend]
          }
        });

        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.lastError).toEqual(expect.any(Number));
          // We expect the lastError to be in the form of a date that is
          // close to now, but there are multiple threads and this test is
          // async so it won't be exactly equal.
          expect(Math.abs(storage.lastError - Date.now()))
            .toBeLessThan(MILLIS_IN_MINUTE);
          expect(storage.bundles).toHaveLength(1);
        });
      });

      it("sets an error timestamp and schedules the ping if the server has an error when sending an ping", async function() {
        await setEndpointResponse(PING_URL, {}, "POST", 500);

        await startMetricsUploaderWithTestArgs();
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.pingBundles).toHaveLength(1);

          expect(storage.lastError).toEqual(expect.any(Number));
          // We expect the lastError to be in the form of a date that is
          // close to now, but there are multiple threads and this test is
          // async so it won't be exactly equal.
          expect(Math.abs(storage.lastError - Date.now()))
            .toBeLessThan(MILLIS_IN_MINUTE);
          expect(storage.bundles).toHaveLength(1);
        });
      });

      it("schedules the ping without sending it if there was previously an error", async function() {
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: 0,
            lastError: Date.now()
          }
        });

        await startMetricsUploaderWithTestArgs();
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.pingBundles).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(0);
        });
      });

      it("does not schedule a new ping if there is still one unsent", async function() {
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: 0,
            lastError: Date.now(),
            pingBundles: [{
              siteId: SITE_ID,
              clientId: uuidv4(),
              scheduledSendTimestamp: Date.now() - MILLIS_IN_DAY
            }]
          }
        });

        await startMetricsUploaderWithTestArgs();
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.pingBundles).toHaveLength(1);
        });
      });

      it("sends the ping after the error resend interval has passed", async function() {
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes: 0,
            lastError: Date.now() - ERROR_DELAY_MS,
            pingBundles: [{
              siteId: SITE_ID,
              clientId: uuidv4(),
              scheduledSendTimestamp: Date.now() - MILLIS_IN_DAY
            }]
          }
        });

        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.pingBundles).toHaveLength(0);
          expect(storage).not.toHaveProperty("lastError");
        });
      });

      it("does not send again if the error resend interval has not passed yet", async function() {
        let now = Date.now();
        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        let originalStorage = {
          dayCutoffMinutes,
          bundles: [bundleToSend],
          lastError: now - ERROR_DELAY_MS / 2
        };
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: originalStorage
        });

        await startMetricsUploaderWithTestArgs();

        // Unfortunately no better condition to wait for here, because what we
        // expect is that nothing changes.
        await new Promise(r => setTimeout(r, 1000));

        let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
        expect(requestLogs).toHaveLength(0);

        let storageResult =
          await browser.storage.local.get([CDP_STORAGE_2_KEY]);
        let storage = storageResult[CDP_STORAGE_2_KEY];
        expect(storage).toEqual(originalStorage);
      });

      it("resumes sending bundles after the error resend interval passed", async function() {
        let now = Date.now();
        let dayCutoffMinutes = 0;
        let bundleToSend = createAggregateBundleToSend();
        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToSend],
            lastError: now - ERROR_DELAY_MS - MILLIS_IN_MINUTE
          }
        });

        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
          expect(requestLogs).toHaveLength(1);
        });

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];
          expect(storage.bundles).toEqual([]);
          expect(storage).not.toHaveProperty("lastError");
        });
      });
    });

    describe("Metric Upload Integration", function() {
      it("can successfully send an aggregation payload to the eyeometry staging server", async function() {
        setMinTimeout(this, 11000);
        await EWE.testing.resetCdpMetricsUploader();

        // These credentials can be set by setting the environment
        // variables with the same name before running webpack.
        let cdpArgs = {
          pingUrl: webpackDotenvPlugin.EWE_CDP_PING_URL,
          aggregateUrl: webpackDotenvPlugin.EWE_CDP_AGGREGATE_URL,
          bearer: webpackDotenvPlugin.EWE_CDP_BEARER
        };
        if (!cdpArgs.pingUrl || !cdpArgs.aggregateUrl || !cdpArgs.bearer) {
          this.skip();
        }

        let now = Date.now();

        let dayCutoffMinutes = 0;
        let bundleToSend = {
          siteId: SITE_ID,
          referenceDateLocal: "2024-05-13",
          utid: uuidv4(),
          scheduledSendTimestamp: now
        };

        await browser.storage.local.set({
          [CDP_STORAGE_2_KEY]: {
            dayCutoffMinutes,
            bundles: [bundleToSend]
          }
        });

        let dayStart = new Date(bundleToSend.referenceDateLocal).getTime();
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID, [
          dayStart,
          dayStart + 3 * MILLIS_IN_HOUR
        ]);

        await EWE.testing.startCdpMetricsUploader(cdpArgs);

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          expect(storage.bundles).toEqual([]);
          expect(storage).not.toHaveProperty("lastError");
        }, 10000);
      });

      it("can successfully send a ping payload to the eyeometry staging server", async function() {
        setMinTimeout(this, 11000);
        await EWE.testing.resetCdpMetricsUploader();

        // These credentials can be set by setting the environment
        // variables with the same name before running webpack.
        let cdpArgs = {
          pingUrl: webpackDotenvPlugin.EWE_CDP_PING_URL,
          aggregateUrl: webpackDotenvPlugin.EWE_CDP_AGGREGATE_URL,
          bearer: webpackDotenvPlugin.EWE_CDP_BEARER
        };
        if (!cdpArgs.pingUrl || !cdpArgs.aggregateUrl || !cdpArgs.bearer) {
          this.skip();
        }

        await EWE.testing.startCdpMetricsUploader(cdpArgs);

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await waitForAssertion(async() => {
          let storageResult =
            await browser.storage.local.get([CDP_STORAGE_2_KEY]);
          let storage = storageResult[CDP_STORAGE_2_KEY];

          // this clientId is created at the same time that the pingBundle is
          // scheduled, so we know it's been scheduled
          expect(storage.clientIds).toEqual({
            [SITE_ID]: expect.any(String)
          });
          // and this being empty means that it has definitely been sent at this
          // point
          expect(storage.pingBundles).toEqual([]);
          expect(storage).not.toHaveProperty("lastError");
        }, 10000);
      });
    });

    describe("Specific sites", function() {
      beforeEach(async function() {
        await EWE.testing._restoreCdpConfig();
      });

      it("counts Amazon visitors", async function() {
        setMinTimeout(this, 30 * 1000);

        const AMAZON_SITE_ID = "amazon.*";

        await new Page("https://amazon.com").loaded;
        await new Page("https://amazon.co.uk").loaded;   // regional
        await new Page("https://docs.aws.amazon.com").loaded; // subdomain

        await assertEvents(AMAZON_SITE_ID, EVENT_PAGE_VIEW, 3);
        await assertEvents(AMAZON_SITE_ID, EVENT_SESSION_START, 1);
      });

      it("counts Yahoo visitors", async function() {
        setMinTimeout(this, 70 * 1000);

        const YAHOO_SITE_ID = "yahoo.com";
        const SEARCH_YAHOO_SITE_ID = "search.yahoo.com";

        await new Page("https://yahoo.com").loaded;
        await new Page("https://search.yahoo.com").loaded; // search

        await assertEvents(SEARCH_YAHOO_SITE_ID, EVENT_SESSION_START, 1);
        await assertEvents(YAHOO_SITE_ID, EVENT_SESSION_START, 1);
      });

      it("counts Expedia visitors", async function() {
        setMinTimeout(this, 10 * 1000);

        // The domains are mapped using browser start DNS args
        // to locally hosted test server, running on a specific port
        await new Page(`http://expedia.com:${TEST_PAGES_PORT}`).loaded;
        await new Page(`http://hotels.com:${TEST_PAGES_PORT}`).loaded;

        await assertEvents("expedia.*", EVENT_SESSION_START, 1);
        await assertEvents("hotels.*", EVENT_SESSION_START, 1);
      });
    });
  });

  describe("Phase 3", function() {
    const CDP_PHASE_3_ARGS = {
      pingUrl: PING_URL,
      publicKeyUrl: PUBLIC_KEY_URL,
      bearer: CDP_BEARER
    };

    const ERROR_DELAY_MS = MILLIS_IN_HOUR;
    const LOCALHOST = "localhost";

    async function assertEvents(siteId, eventType, size) {
      await EWE.debugging.ensureEverythingHasSaved();

      let counter;
      await waitForAssertion(async() => {
        counter = await EWE.testing._getCdpData(eventType, siteId);
        expect(counter).toEqual(size);
      });
      return counter;
    }

    beforeEach(async function() {
      await EWE.testing.resetCdpMetricsUploader();
      await setFeatureFlags({cdpPhase3: true});
      await EWE.testing.stopCdp();
      await EWE.testing.startCdp();
    });

    async function startMetricsUploaderWithTestArgs() {
      await EWE.testing.stopCdpMetricsUploader();
      await EWE.testing.startCdpMetricsUploader(
        CDP_PHASE_3_ARGS, ERROR_DELAY_MS);
    }

    it("does not track if opted out by user", async function() {
      await EWE.cdp.setOptOut(true);
      expect(await EWE.cdp.isOptOut()).toEqual(true);
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);
      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 0);
      await assertEvents(WEBEXT_DOT_COM, EVENT_BLOCKING, 0);
    });

    it("tracks 'blocking' events", async function() {
      await addFilter("image.png");
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

    it("migrates the data from Phase 2", async function() {
      setMinTimeout(this, 2 * 60 * 1000);

      // we can migrate/reuse the data for domains where siteId
      // is equal to domain name
      const YAHOO_COM = "yahoo.com";

      // Phase 2
      await EWE.testing.stopCdp();
      await setFeatureFlags({cdpPhase3: false});
      await EWE.testing.startCdp();

      await new Page(`https://${YAHOO_COM}`).loaded;
      await assertEventsPhase2(YAHOO_COM, EVENT_PAGE_VIEW, 1);

      // Phase 3
      await EWE.testing.stopCdp();
      await setFeatureFlags({cdpPhase3: true});
      await EWE.testing.startCdp();

      await new Page(`https://${YAHOO_COM}`).loaded;
      await assertEvents(YAHOO_COM, EVENT_PAGE_VIEW, 2);
    });

    it("supports History API", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);
      // This is failing on Windows runners, adding retry mechanism:
      await wait(async() => {
        const opener = new Page(`http://${WEBEXT_DOT_COM}:3000/history.html`);
        if (await opener.loaded) {
          return true;
        }
      }, 10000, "Failed to load the history page within the timeout.");

      // 1 event for "history.html" and 1 event for "history-after-pushState.js"
      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 2);

      // still the same session
      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
    });

    async function assertUserActionsSessionEvents(
      callback, sessionDuration, clear = true, eventsCount = 1) {
      if (clear) {
        await EWE.testing._clearCdpData();
        await EWE.testing._clearCdpActivity();
        await Page.removeCurrent();
        await EWE.testing._clearFrameState();
      }

      const page = new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`);
      const tabId = await page.loaded;

      const sleepInterval = 100;
      const attempts = sessionDuration / sleepInterval;

      for (let i = 0; i < attempts; i++) {
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
      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, eventsCount);
    }

    it("extends session expiration time due to user actions", async function() {
      setMinTimeout(this, 60 * 1000);

      const sessionExpirationInterval = 6 * MILLIS_IN_SECOND;

      await EWE.testing._setPrefs(
        EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);

      await addFilter("image.png");

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

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);

      await EWE.testing.stopCdp();
      try {
        await EWE.testing.setCdpLoadDelay(loadDelay);
        await EWE.testing.startCdp();

        // If there is no data (existing sessions) loaded,
        // it's considered to be a new session.
        // Otherwise we know there is a pending session.
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        // the deferred events are processed now
        await new Promise(r => setTimeout(r, loadDelay));

        // not a new session
        await assertEvents(WEBEXT_DOT_COM, EVENT_SESSION_START, 1);
      }
      finally {
        await EWE.testing.setCdpLoadDelay(0);
      }
    });

    it("clears the events", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);

      await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);

      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0);
    });

    it("clears the events for the domain", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 1);
      await assertEvents(LOCALHOST, EVENT_PAGE_VIEW, 1);

      await EWE.testing._clearCdpData(EVENT_PAGE_VIEW, WEBEXT_DOT_COM);

      await assertEvents(WEBEXT_DOT_COM, EVENT_PAGE_VIEW, 0); // cleared
      await assertEvents(LOCALHOST, EVENT_PAGE_VIEW, 1); // not cleared
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
        await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;
        await assertEvents(LOCALHOST, EVENT_SESSION_START, 1);

        // wait for the session to expire
        await new Promise(r => setTimeout(r, 2 * newSessionExpirationInterval));

        await EWE.testing.stopCdp();

        // Make sure the session is saved
        let activity = await browser.storage.local.get([ACTIVITY_KEY]);
        activity = activity[ACTIVITY_KEY];
        expect(activity).toHaveProperty(LOCALHOST);
        expect(activity[LOCALHOST]).toEqual(expect.any(Number));

        await EWE.testing.startCdp();

        // Make sure the session is cleaned during the start,
        // so new navigation is treated as a new session
        await waitForAssertion(async() => {
          activity = await browser.storage.local.get([ACTIVITY_KEY]);
          activity = activity[ACTIVITY_KEY];
          expect(activity).not.toHaveProperty(LOCALHOST);
        });
        await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

        await assertEvents(LOCALHOST, EVENT_SESSION_START, 2);
      }
      finally {
        await EWE.testing._setPrefs(
          EXPIRATION_INTERVAL_KEY, sessionExpirationInterval);
      }
    });

    it("ignores service URLs", async function() {
      await new Page("chrome://version").loaded;
      await assertEvents("version", EVENT_SESSION_START, 0);
    });

    it("notifies the listeners", async function() {
      await addFilter(`image.png$domain=${WEBEXT_DOT_COM}`);

      await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
      await EWE.debugging.ensureEverythingHasSaved();

      expect(getTestEvents("cdp.onCdpItem.page_view")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: WEBEXT_DOT_COM,
        eventType: EVENT_PAGE_VIEW
      }]]);

      expect(getTestEvents("cdp.onCdpItem.blocking")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: WEBEXT_DOT_COM,
        eventType: EVENT_BLOCKING
      }]]);

      expect(getTestEvents("cdp.onCdpItem.session_start")).toEqual([[{
        timeStamp: expect.any(Number),
        siteId: WEBEXT_DOT_COM,
        eventType: EVENT_SESSION_START
      }]]);

      expect(getTestEvents("cdp.onCdpItem.all")).toEqual(expect.arrayContaining([
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: WEBEXT_DOT_COM,
          eventType: EVENT_PAGE_VIEW
        }]),
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: WEBEXT_DOT_COM,
          eventType: EVENT_BLOCKING
        }]),
        expect.arrayContaining([{
          timeStamp: expect.any(Number),
          siteId: WEBEXT_DOT_COM,
          eventType: EVENT_SESSION_START
        }])
      ]));
    });

    async function clearState() {
      await browser.storage.local.remove(CDP_STORAGE_3_KEY);
    }

    const LOGS_WAIT_INTERVAL_MS = 5 * MILLIS_IN_SECOND;

    describe("Metric Upload Running", function() {
      // Some of these unfortunately need to wait for pings to happen (or not
      // happen) and so can get a bit long.
      setMinTimeout(this, 15000);

      async function clearEndpointResponses() {
        await clearEndpointResponse(PING_URL);
        await clearEndpointResponse(PUBLIC_KEY_URL);
      }

      beforeEach(async function() {
        await clearRequestLogs();
        await clearState();
        await clearEndpointResponses();
      });

      afterEach(async function() {
        await clearEndpointResponses();
        await clearState();
      });

      it("sends the request for the very first time with missing 'last_ping' and 'encrypted_data'", async function() {
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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

        await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;
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
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
        }, LOGS_WAIT_INTERVAL_MS);

        // no new navigation, thus no new data
        await EWE.testing._uploadCdp();

        let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
        expect(requestLogs).toHaveLength(1);
      });

      it("sends the ping after the error resend interval has passed", async function() {
        const lastError = Date.now() - ERROR_DELAY_MS;
        await browser.storage.local.set({
          [CDP_STORAGE_3_KEY]: {
            lastError
          }
        });

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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
          await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
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

      it("sends the same 'utid' and data in the retry ping for the very first ping", async function() {
        setMinTimeout(this, 20 * 1000);

        const SHORT_ERROR_DELAY_MS = 2 * MILLIS_IN_SECOND;

        try {
          await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

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

      it("sends the 'last_ping' of the last successful ping in retry ping", async function() {
        setMinTimeout(this, 20 * 1000);

        const SHORT_ERROR_DELAY_MS = 2 * MILLIS_IN_SECOND;

        try {
          await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

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
          await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

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

        await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;
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

          await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

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
          expect(errorDomainStats).toEqual([{
            site_id: WEBEXT_DOT_COM,
            sessions_count: 1
          }]);

          // configure backend to return ok
          await setEndpointResponse(PING_URL, JSON.stringify({
            token: "someToken"
          }), "POST", 200);

          // navigation that shouldn't be counted in retry ping,
          // but should be counted in the next regular ping
          await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;

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
          // no "webext.com" sessions is expected here
          expect(regularDomainStats).toEqual([{
            site_id: LOCALHOST,
            sessions_count: 1
          }]);
        }
        finally {
          await setEndpointResponse(PING_URL, JSON.stringify({
            token: "someToken"
          }), "POST", 200);
        }
      });

      it("does not send the ping if user has opted out", async function() {
        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;

        await EWE.cdp.setOptOut(true);

        await startMetricsUploaderWithTestArgs();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_2_ARGS.aggregateUrl);
          expect(requestLogs).toHaveLength(0);
        });
      });
    });

    describe("Domains trimming", function() {
      it("generates \"domain_stats\" payload", async function() {
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID, [1, 2, 3]);
        const stats = await EWE.testing._getCdpDomainStats();
        expect(stats).toEqual(
          `[{"site_id":"${SITE_ID}","sessions_count":3}]`);
      });

      it("sorts \"domain_stats\" payload for sessions count", async function() {
        const SITE_ID1 = SITE_ID;
        const SITE_ID2 = SITE_ID + "2";
        const SITE_ID3 = SITE_ID + "3";
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID1, [1]);
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID2, [1, 2, 3]);
        await EWE.testing._setCdpData(EVENT_SESSION_START, SITE_ID3, [1, 2]);
        const stats = await EWE.testing._getCdpDomainStats();
        expect(stats).toEqual("[" +
          `{"site_id":"${SITE_ID2}","sessions_count":3},` +
          `{"site_id":"${SITE_ID3}","sessions_count":2},` +
          `{"site_id":"${SITE_ID1}","sessions_count":1}` +
          "]");
      });

      it("skips sending 0 sessions_count if having pageviews_count", async function() {
        await EWE.testing._setCdpData(EVENT_PAGE_VIEW, SITE_ID, 1);
        // At the moment we pass only sessions count,
        // but having page_view events might add the domain to
        // the reported list, so we might occasionally add 0
        // as a sessions count for it.
        const stats = await EWE.testing._getCdpDomainStats();
        expect(stats).toEqual("[]");
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
        expect(publicKey.byteLength).not.toEqual(0);
      });

      it("requests public key", async function() {
        await EWE.testing.startCdpMetricsUploader(CDP_PHASE_3_ARGS, 3000);
        const {publicKey, keyId} = await EWE.testing._requestPublicKey();
        expect(publicKey).not.toBeNull();
        expect(keyId).not.toBeNull();
      });

      it("is able to decrypt the payload", async function() {
        setMinTimeout(this, 20 * 1000);

        await clearRequestLogs();

        await new Page(`http://${WEBEXT_DOT_COM}:3000/image.html`).loaded;
        await startMetricsUploaderWithTestArgs();

        let payload;
        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(1);
          payload = requestLogs[0].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);
        expect(payload).not.toHaveProperty("encrypted_data"); // the very first ping

        // We need to navigate to another domain, as the session for webext.com
        // is pending and will be not counted in domains_stats
        await new Page(`http://${LOCALHOST}:3000/image.html`).loaded;
        await EWE.testing._uploadCdp();

        await waitForAssertion(async() => {
          let requestLogs = await getRequestLogs(CDP_PHASE_3_ARGS.pingUrl);
          expect(requestLogs).toHaveLength(2);
          payload = requestLogs[1].body.payload;
        }, LOGS_WAIT_INTERVAL_MS);

        expect(payload).toHaveProperty("encrypted_data");
        expect(payload).toHaveProperty("public_key_id");

        const domainStats = await decryptDomainStats(payload);
        expect(domainStats).toEqual(expect.arrayContaining([{
          site_id: WEBEXT_DOT_COM,
          sessions_count: 1
        }, {
          site_id: LOCALHOST,
          sessions_count: 1
        }]));
      });
    });
  });
});
