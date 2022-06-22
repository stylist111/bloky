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

import {Page, clickElement, executeScript, TEST_PAGES_URL, TEST_PAGES_DOMAIN,
        setMinTimeout} from "./utils.js";
import {EWE, addFilter, addFakeListener} from "./messaging.js";

describe("One Click Allowlisting", function() {
  let page;
  let expectImageResource;
  let tabId;
  let onUnauthorizedFake;

  // eslint-disable-next-line max-len
  let publicKey = "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAorAkyGHnzZkVE0TGcU7Sl6/LlH9j3udDNvHv/fSzplLMdqkw0HZNV9zaBFQ0Rw73AJ7MQ8JQm2hex9DEss3xsrlpHEi/nC7C1authg1rt5Xo4K0P5Bo+j6y41UtgQoL9xKJ6RlYGBq4uBHaq/xRyp/7zUxOiViTdnVZRhSkmyBCIQ+5l8/mTk5yyMLfH7QM0KFKdJbnnTU8HEGzHaFi33vAwWPpJjCohYUzYxgXOgSZYV6xNPycQj4U/D4k+7UT+d4zzrj7fSz08/ijfHLB8G6dr1nx7+Pydt3ijhKEX2mKaAWgKtyM2wTgFXys4rnAbdr340FpQaVebNF0bwGsqluBNdvZ6fPgN9dLlpVDQKXlOKdfOyc64Yw82/jHKdYC7NO1bg13hqo7JWM10Gklt2FY5ekfDBZagPbYCH780C8w0aMceBs3NBTI6SAPI8xhyu7LwL7vw/vMwz8kfIsKOCPFqf0qPlvJCaryIAA7Ca6SHfBqaTzyivEEqn6tWphCpYSODfPRO4Udg+l/o/PCJuly41b4QF2x8H+LvJnr7HFknmFYwisbIofC/2ucO2sfJDP4EOHKeDV9mexHSJIfjyFYV0f0ALj1eKl9Viz37qLefzXFhTG4wzoK5F/QM1ZhIWjN+0DBn6GTQxuWc4eAuASoh07JG4M+i2rWcUTYvgOECAwEAAQ==";

  beforeEach(async function() {
    await EWE.allowlisting.setAuthorizedKeys([publicKey]);
    await addFilter(`|${TEST_PAGES_URL}$image`);
    page = new Page("one-click-allowlisting.html");
    expectImageResource = page.expectResource("image.png");
    tabId = await page.loaded;
    onUnauthorizedFake = await addFakeListener({
      namespace: "allowlisting",
      eventName: "onUnauthorized",
      eventOptions: {}
    });
  });

  async function reload() {
    // Waiting for it to finish loading before reloading prevents
    // browser events from before the reload from bleeding into events
    // after the reload.
    await expectImageResource.completed;

    let pageReloadPromise = page.reload(true);
    expectImageResource = page.expectResource("image.png");
    await pageReloadPromise;
  }

  async function clickAllowlistButton(id) {
    await clickElement(tabId, id);
    // clicking the button triggers an event which will probably
    // involve a message to the background page. Give it some time to
    // do its thing before checking results. This time may seem
    // excessive, but the CI pipeline runners can sometimes be pretty
    // slow.
    await new Promise(r => setTimeout(r, 300));
  }

  async function getSuccessEventReceived() {
    return await executeScript(
      tabId,
      elemId => {
        let el = document.getElementById(elemId);
        return el ? el.outerHTML : null;
      },
      ["domain_allowlisting_success_received"]
    );
  }

  async function expectSuccessfulAllowlist() {
    expect(await getSuccessEventReceived()).not.toBeNull();
    expect(onUnauthorizedFake.called).toBeFalsy();
    await reload();
    await expectImageResource.toBeLoaded();
  }

  async function expectUnsuccessfulAllowlist(errorMessage, expectedRequest) {
    if (!expectedRequest) {
      expectedRequest = {
        domain: "localhost",
        signature: expect.any(String),
        timestamp: expect.any(Number)
      };
    }

    expect(await getSuccessEventReceived()).toBeNull();
    expect(onUnauthorizedFake.args).toEqual([[{
      reason: errorMessage,
      request: expectedRequest
    }]]);
    await reload();
    await expectImageResource.toBeBlocked();
  }

  it("blocks before clicking allowlist", async function() {
    await expectImageResource.toBeBlocked();
    expect(await getSuccessEventReceived()).toBeNull();
  });

  it("unblocks when allowlist is clicked", async function() {
    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();
  });

  it("blocks when the request comes from in an iframe", async function() {
    page = new Page("one-click-allowlisting-iframe.html");
    expectImageResource = page.expectResource("image.png");
    tabId = await page.loaded;
    await executeScript(
      tabId,
      () => {
        let frame = document.getElementById("one-click-allowlisting-iframe");
        frame.contentDocument.getElementById("allowlist").click();
      },
      []
    );

    await reload();
    await expectImageResource.toBeBlocked();
  });

  it("does nothing if domain is already allowlisted", async function() {
    setMinTimeout(this, 4000);
    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();

    onUnauthorizedFake.resetHistory();

    await clickAllowlistButton("allowlist");
    expect(await getSuccessEventReceived()).toBeNull();
    expect(onUnauthorizedFake.args).toEqual([[{
      reason: "already_allowlisted",
      request: {
        domain: "localhost",
        signature: expect.any(String),
        timestamp: expect.any(Number)
      }
    }]]);
  });

  it("unblocks if only the page was previously allowlisted", async function() {
    await addFilter(
      `@@|${TEST_PAGES_URL}/one-click-allowlisting.html$document`
    );
    await reload();
    await expectImageResource.toBeLoaded();

    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();
  });

  describe("Invalid signature", function() {
    it("blocks when signature key is invalid", async function() {
      await EWE.allowlisting.setAuthorizedKeys([]);
      await clickAllowlistButton("allowlist");
      await expectUnsuccessfulAllowlist("invalid_signature");
    });

    it("blocks when signature timestamp is too long ago", async function() {
      await clickAllowlistButton("allowlist_old_timestamp");
      await expectUnsuccessfulAllowlist("invalid_timestamp");
    });

    it("blocks when signature timestamp is in the future", async function() {
      await clickAllowlistButton("allowlist_future_timestamp");
      await expectUnsuccessfulAllowlist("invalid_timestamp");
    });

    it("blocks when signature timestamp is not a number", async function() {
      await clickAllowlistButton("allowlist_nonsense_timestamp");
      await expectUnsuccessfulAllowlist("invalid_timestamp", {
        domain: "localhost",
        signature: expect.any(String),
        timestamp: "fakeTimestamp"
      });
    });

    it("blocks when signature domain is invalid", async function() {
      await clickAllowlistButton("allowlist_different_domain");
      await expectUnsuccessfulAllowlist("invalid_signature");
      // this test tries to add a filter for example.com, so we want to
      // just make sure there are no extra filters snuck past.
      let userFilters = await EWE.filters.getUserFilters();
      let userFilterTexts = userFilters.map(f => f.text);
      expect(userFilterTexts).toEqual([`|${TEST_PAGES_URL}$image`]);
    });
  });

  describe("Malicious publisher script protection", function() {
    async function getEventHandlerDetected() {
      return await executeScript(
        tabId,
        elemId => {
          let el = document.getElementById(elemId);
          return el ? el.outerHTML : null;
        },
        ["event_handler_detected"]
      );
    }

    for (let link of [
      "malicious_subclass",
      "malicious_override",
      "malicious_has_own_property",
      "malicious_replaced_custom_event",
      "malicious_get_prototype_of",
      "malicious_custom_event_prototype",
      "malicious_proxy_object"
    ]) {
      it(`can't detect handler with untrusted event using ${link}`, async function() {
        await clickAllowlistButton(link);
        expect(await getEventHandlerDetected()).toBeNull();
      });
    }

    // Without the DOS protection code, this test doesn't fail
    // normally. It locks up the background script, and can end up
    // timing out the rest of the tests.
    it("does not break with many allowlisting requests", async function() {
      await clickAllowlistButton("malicious_dos_attempt");
      let userFilters = await EWE.filters.getUserFilters();
      let userFilterTexts = userFilters.map(f => f.text);
      expect(userFilterTexts).toEqual([`|${TEST_PAGES_URL}$image`]);
    });

    it("does not break with many valid allowlisting requests", async function() {
      await clickAllowlistButton("malicious_dos_attempt_valid_signature");
      let userFilters = await EWE.filters.getUserFilters();
      let userFilterTexts = userFilters.map(f => f.text);
      expect(userFilterTexts).toEqual(expect.arrayContaining([
        `|${TEST_PAGES_URL}$image`,
        `@@||${TEST_PAGES_DOMAIN}^$document`
      ]));
    });
  });
});
