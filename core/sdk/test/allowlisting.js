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

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN} from "./test-server-urls.js";
import {Page, clickElement, executeScript, isEdge, setMinTimeout, sleep,
        waitForAssertion}
  from "./utils.js";
import {wait} from "./polling.js";
import {EWE, addFilter, getTestEvents, clearTestEvents, runInBackgroundPage,
        fuzzSuspendServiceWorker} from "./messaging.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

describe("One Click Allowlisting", function() {
  setMinTimeout(this, 12000);

  let timeout = isFuzzingServiceWorker() ? 9000 : 3000;

  let page;
  let expectImageResource;
  let tabId;

  let getOnUnauthorizedEvents = () =>
    getTestEvents("allowlisting.onUnauthorized");
  let clearOnUnauthorizedEvents = () =>
    clearTestEvents("allowlisting.onUnauthorized");

  beforeEach(async function() {
    await addFilter(`|${TEST_PAGES_URL}$image`);
    page = new Page("one-click-allowlisting.html");
    expectImageResource = page.expectResource("image.png");
    tabId = await page.loaded;
  });

  async function reload(path = "one-click-allowlisting.html") {
    // page.reload() is not used here because sometimes expectResource would
    // struggle to tell if an event happened before or after the reload
    page = new Page(path);
    expectImageResource = page.expectResource("image.png");
    tabId = await page.loaded;
  }

  async function clickAllowlistButton(id) {
    await fuzzSuspendServiceWorker();
    await clickElement(tabId, id);
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
    await wait(async() => {
      expect(getOnUnauthorizedEvents()).toEqual([]);
      return await getSuccessEventReceived() != null;
    }, timeout, "success event was not received");
    // Using waitForAssertion to retry reload as a workaround
    // https://jira.eyeo.com/browse/EE-258
    await waitForAssertion(async() => {
      await reload();
      await expectImageResource.toBeLoaded();
    });
  }

  async function expectUnsuccessfulAllowlist(errorMessage, expectedRequest) {
    if (!expectedRequest) {
      expectedRequest = {
        domain: "localhost",
        signature: expect.any(String),
        timestamp: expect.any(Number)
      };
    }

    let events;
    await wait(() => {
      events = getOnUnauthorizedEvents();
      return events.length > 0;
    }, timeout, "onUnauthorized was not called");

    expect(events).toEqual([[{
      reason: errorMessage,
      request: expectedRequest
    }]]);
    expect(await getSuccessEventReceived()).toBeNull();

    await reload();
    if (errorMessage == "already_allowlisted") {
      await expectImageResource.toBeLoaded();
    }
    else {
      await expectImageResource.toBeBlocked();
    }
  }

  it("blocks before clicking allowlist", async function() {
    await expectImageResource.toBeBlocked();
    expect(await getSuccessEventReceived()).toBeNull();
  });

  it("unblocks when allowlist is clicked [fuzz]", async function() {
    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();
  });

  it("unblocks when allowlist is clicked using the second key", async function() {
    await clickAllowlistButton("allowlist_second_key");
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

    await reload("one-click-allowlisting-iframe.html");
    await expectImageResource.toBeBlocked();
  });

  it("does nothing if domain is already allowlisted", async function() {
    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();

    clearOnUnauthorizedEvents();

    await clickAllowlistButton("allowlist");
    await expectUnsuccessfulAllowlist("already_allowlisted");
  });

  it("unblocks if only the page was previously allowlisted", async function() {
    await addFilter(
      `@@|${TEST_PAGES_URL}/one-click-allowlisting.html$document`
    );

    if (isEdge()) {
      await sleep(2000);
    }

    // Using waitForAssertion to retry reload as a workaround
    // https://eyeo.atlassian.net/browse/EE-258
    await waitForAssertion(async() => {
      await reload();
      await expectImageResource.toBeLoaded();
    }, 8000);
    await clickAllowlistButton("allowlist");
    await expectSuccessfulAllowlist();
  });

  it("unblocks when allowlist with expiration is clicked [fuzz]", async function() {
    setMinTimeout(this, 30000);
    await clickAllowlistButton("allowlist_with_expiration");
    await expectSuccessfulAllowlist();

    const filters = await EWE.filters.getAllowingFilters(tabId, {types: ["document"]});
    expect(filters).toHaveLength(1);

    const metadata = await EWE.filters.getMetadata(filters[0]);
    const {expiresAt, autoExtendMs} = metadata;
    expect(expiresAt).toBeGreaterThan(Date.now());
    // autoExtendMs is not allowed through the OC API
    expect(autoExtendMs).toBeUndefined();
  });

  describe("Invalid options parameter", function() {
    it("blocks when options doesn't have expiresAt property", async function() {
      await clickAllowlistButton("allowlist_with_invalid_options");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is string", async function() {
      await clickAllowlistButton("allowlist_with_invalid_expiration_string");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is object", async function() {
      await clickAllowlistButton("allowlist_with_invalid_expiration_object");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is null", async function() {
      await clickAllowlistButton("allowlist_with_invalid_expiration_null");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is array", async function() {
      await clickAllowlistButton("allowlist_with_invalid_expiration_array");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is boolean", async function() {
      await clickAllowlistButton("allowlist_with_invalid_expiration_boolean");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is below the range [fuzz]", async function() {
      await clickAllowlistButton("allowlist_with_expiration_below_range");
      await expectUnsuccessfulAllowlist("invalid_options");
    });

    it("blocks when expiresAt is above the range  [fuzz]", async function() {
      await clickAllowlistButton("allowlist_with_expiration_above_range");
      await expectUnsuccessfulAllowlist("invalid_options");
    });
  });

  describe("Invalid signature", function() {
    it("blocks when signature key is unauthorized [fuzz]", async function() {
      await clickAllowlistButton("allowlist_unauthorized_key");
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
        let frontEndMaliciousScriptTimeout = 100;
        await clickAllowlistButton(link);
        await new Promise(r => setTimeout(r, frontEndMaliciousScriptTimeout));
        expect(await getEventHandlerDetected()).toBeNull();
      });
    }

    async function getUserFilters() {
      return await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "filters"},
        {op: "callMethod", arg: "getUserFilters"},
        {op: "await"}
      ], false);
    }

    // Without the DOS protection code, this test doesn't fail
    // normally. It locks up the background script, and can end up
    // timing out the rest of the tests.
    it("does not break with many allowlisting requests", async function() {
      await clickAllowlistButton("malicious_dos_attempt");
      await new Promise(r => setTimeout(r, timeout));
      let userFilters = await getUserFilters();
      let userFilterTexts = userFilters.map(f => f.text);
      expect(userFilterTexts).toEqual([`|${TEST_PAGES_URL}$image`]);
    });

    it("does not break with many valid allowlisting requests", async function() {
      await clickAllowlistButton("malicious_dos_attempt_valid_signature");

      let userFilterTexts;
      await wait(async() => {
        // Fuzzing service worker while polling here is
        // inappropriate. We'd kill the exact process that we're
        // waiting to see the results of.
        let userFilters = await getUserFilters();
        userFilterTexts = userFilters.map(f => f.text);
        return userFilterTexts.length > 1;
      }, timeout, "allowlisting filter was not added");

      expect(userFilterTexts).toEqual(expect.arrayContaining([
        `|${TEST_PAGES_URL}$image`,
        `@@||${TEST_PAGES_DOMAIN}^$document`
      ]));
    });
  });
});
