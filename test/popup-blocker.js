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

import {Page, Popup, setMinTimeout, TEST_PAGES_URL, TEST_PAGES_DOMAIN,
        CROSS_DOMAIN, SITEKEY} from "./utils.js";
import {EWE} from "./messaging.js";

describe("Pop-up blocking", function() {
  setMinTimeout(this, 4000);

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
      await EWE.filters.add([
        `|${TEST_PAGES_URL}/popup.html^$popup`,
        `@@$document,sitekey=${SITEKEY}`
      ]);
      // Note: opener must be opened AFTER adding document filter for
      // the filter to apply.
      let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
      expect(await popup.blocked).toBe(false);
    });
  });
});
