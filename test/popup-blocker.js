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

import {TEST_PAGES_URL, TEST_PAGES_DOMAIN, CROSS_DOMAIN, SITEKEY}
  from "./test-server-urls.js";
import {Page, Popup, setMinTimeout, setEndpointResponse,
        syncSubHasLastFilter, syncSubHasNoLastFilter,
        isEdge, waitForSubscriptionToBeSynchronized}
  from "./utils.js";
import {emptyDiffResponse, subTestUpdatable1} from "./api-fixtures.js";
import {EWE, waitForServiceWorkerInitialization, getLastError}
  from "./messaging.js";
import {isFuzzingServiceWorker, suspendServiceWorker}
  from "./mocha/mocha-runner.js";

describe("Pop-up blocking", function() {
  describe("Blocking", function() {
    let opener;

    beforeEach(async function() {
      opener = new Page("popup-opener.html");
      await opener.loaded;
    });

    it("blocks a link-based popup [fuzz]", async function() {
      await EWE.filters.add([`|${TEST_PAGES_URL}/popup.html^$popup`]);
      expect(await new Popup("link", opener).blocked).toBe(true);
    });

    it("blocks a script-based popup tab", async function() {
      await EWE.filters.add([`|${TEST_PAGES_URL}/popup.html^$popup`]);
      expect(await new Popup("script-tab", opener).blocked).toBe(true);
    });

    it("blocks a script-based popup window", async function() {
      await EWE.filters.add([`|${TEST_PAGES_URL}/popup.html^$popup`]);
      expect(await new Popup("script-window", opener).blocked).toBe(true);
    });

    it("blocks a script-based popup with deferred navigation", async function() {
      await EWE.filters.add([`|${TEST_PAGES_URL}/popup.html^$popup`]);
      expect(await new Popup("script-deferred", opener, true).blocked)
        .toBe(true);
    });

    it("blocks a link-based third-party popup", async function() {
      await EWE.filters.add([`popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`]);
      expect(await new Popup("third-party-link", opener).blocked).toBe(true);
    });

    it("does not block a link-based third-party popup " +
       "if the domain is for the opener page", async function() {
      await EWE.filters.add([`popup.html^$popup,domain=${CROSS_DOMAIN}`]);
      expect(await new Popup("third-party-link", opener).blocked).toBe(false);
    });

    it("does not block an allowlisted popup", async function() {
      await EWE.filters.add([
        `|${TEST_PAGES_URL}/popup.html^$popup`,
        `@@|${TEST_PAGES_URL}/popup.html^$popup`
      ]);
      expect(await new Popup("link", opener).blocked).toBe(false);
    });

    it("does not block the popup if opener is allowlisted", async function() {
      await EWE.filters.add([
        `|${TEST_PAGES_URL}/popup.html^$popup`,
        `@@|${TEST_PAGES_URL}/popup-opener.html$subdocument,document`
      ]);
      let popup = new Popup("link", new Page("popup-opener.html"));
      expect(await popup.blocked).toBe(false);
    });

    it("does not block the popup page if navigated to directly", async function() {
      await EWE.filters.add([`|${TEST_PAGES_URL}/popup.html^$popup`]);
      let notAPopup = new Page("popup.html");
      await notAPopup.loaded;
      expect(await notAPopup.stillExists()).toBe(true);
    });

    it("does not error if a tab is closed while the service worker is suspended [mv3-only]", async function() {
      await suspendServiceWorker();
      await opener.remove();

      // Closing the tab causes the service worker to start up again. However,
      // the error might only be thrown once everything has startup up right.
      await waitForServiceWorkerInitialization();
      expect(await getLastError()).toBeUndefined();
    });
  });

  describe("Sitekey allowlisting", function() {
    it("does not block a popup", async function() {
      await EWE.filters.add([
        `|${TEST_PAGES_URL}/popup.html^$popup`,
        `@@$popup,sitekey=${SITEKEY}`
      ]);
      let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
      expect(await popup.blocked).toBe(false);
    });

    it("does not block a popup opened by a document [fuzz]", async function() {
      setMinTimeout(this, 20000);

      await EWE.filters.add([
        `|${TEST_PAGES_URL}/popup.html^$popup`,
        `@@$document,sitekey=${SITEKEY}`
      ]);

      if (isEdge() && isFuzzingServiceWorker()) {
        await new Promise(r => setTimeout(r, 5000));
      }

      // Note: opener must be opened AFTER adding document filter for
      // the filter to apply.
      let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
      expect(await popup.blocked).toBe(false);
    });
  });

  describe("Diff updates [mv3-only]", function() {
    setMinTimeout(this, 30000);

    let opener;

    beforeEach(async function() {
      opener = new Page("popup-opener.html");
      await opener.loaded;
    });

    it("blocks a script-based popup tab with filter from bundled subscription data", async function() {
      await setEndpointResponse(subTestUpdatable1.diff_url, emptyDiffResponse);
      await EWE.subscriptions.add(subTestUpdatable1.url);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      // no sync needed, the filter is in bundled subscription data

      expect(await new Popup("script-tab", opener).blocked).toBe(true);
    });

    it("stops blocking a script-based popup tab after filter from bundled subscription data is disabled", async function() {
      await setEndpointResponse(subTestUpdatable1.diff_url, emptyDiffResponse);
      await EWE.subscriptions.add(subTestUpdatable1.url);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      expect(await new Popup("script-tab", opener).blocked).toBe(true);

      const popupFilter = `${TEST_PAGES_URL}/popup.html^$popup`;
      await setEndpointResponse(subTestUpdatable1.diff_url, JSON.stringify({
        filters: {
          add: [],
          remove: [popupFilter]
        }
      }));

      await EWE.subscriptions.sync(subTestUpdatable1.url);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      expect(await new Popup("script-tab", opener).blocked).toBe(false);
    });

    it("blocks a script-based popup tab with filter from diff update", async function() {
      await setEndpointResponse(subTestUpdatable1.diff_url, emptyDiffResponse);
      await EWE.subscriptions.add(subTestUpdatable1.url);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      expect(await new Popup("diff-script-tab", opener).blocked).toBe(false);

      const popupFilter = `|${TEST_PAGES_URL}/diff-popup.html^$popup`;
      await setEndpointResponse(subTestUpdatable1.diff_url, JSON.stringify({
        filters: {
          add: [popupFilter],
          remove: []
        }
      }));
      await syncSubHasLastFilter(subTestUpdatable1.url, popupFilter);

      expect(await new Popup("diff-script-tab", opener).blocked).toBe(true);
    });

    it("stops blocking a script-based popup tab with filter from diff update", async function() {
      const popupFilter = `|${TEST_PAGES_URL}/diff-popup.html^$popup`;
      await setEndpointResponse(subTestUpdatable1.diff_url, JSON.stringify({
        filters: {
          add: [popupFilter],
          remove: []
        }
      }));
      await EWE.subscriptions.add(subTestUpdatable1.url);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      await syncSubHasLastFilter(subTestUpdatable1.url, popupFilter);
      await waitForSubscriptionToBeSynchronized(subTestUpdatable1.url);

      expect(await new Popup("diff-script-tab", opener).blocked).toBe(true);

      // We don't need to have `popupFilter` in `remove:` filters
      // as the diff is between the bundled state and current
      // and there is no `popupFilter` in bundled state
      // so empty diff response will make the current state equal to bundled.
      await setEndpointResponse(subTestUpdatable1.diff_url, emptyDiffResponse);

      await syncSubHasNoLastFilter(subTestUpdatable1.url, popupFilter);

      expect(await new Popup("diff-script-tab", opener).blocked).toBe(false);
    });
  });
});
