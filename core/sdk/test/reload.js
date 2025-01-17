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
import browser from "webextension-polyfill";

import {Page, isMV3, isFirefox, waitForHighlightedStyle,
        isIncognito, waitForSubscriptionToBeSynchronized}
  from "./utils.js";
import {subTestCustom1} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {addFilter, EWE, runInBackgroundPage}
  from "./messaging.js";

const METADATA_FILTER_TEXT = "reload###metadata-test";
const METADATA_FILTER = {
  csp: null,
  text: METADATA_FILTER_TEXT,
  enabled: true,
  slow: false,
  thirdParty: null,
  type: "elemhide",
  selector: "#metadata-test"
};
const CONTENT_FILTER_TEXT = "reload###test";
const CONTENT_FILTER = {
  csp: null,
  text: CONTENT_FILTER_TEXT,
  enabled: true,
  slow: false,
  thirdParty: null,
  type: "elemhide",
  selector: "#test"
};
const IMAGE_FILTER_TEXT = "/image.png^$image";
const BLOCKING_FILTER_TEXT = "/blocking.png^$image";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

describe(`Reload (${phase})`, function() {
  if (isFirefox() && isIncognito()) {
    this.timeout(7000);
  }
  else {
    this.timeout(5000);
  }

  after(async function() {
    if (start) {
      await browser.storage.local.set({"reload-test-running": true});
      await browser.storage.local.set({search: document.location.search});
      // Even if we await for promise above, we still need to give browser time
      // to complete setting flag, in other case in next steps we won't have
      // flag set properly and reload.html won't load
      await new Promise(r => setTimeout(r, 4500));

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("reload-test-running");
    await browser.storage.local.remove("search");
  });

  it("persists filter storage data", async function() {
    if (start) {
      await addFilter(CONTENT_FILTER_TEXT);
      await wait(async() => {
        return await EWE.debugging.isInFilterStorage(CONTENT_FILTER_TEXT);
      }, 2000, "The added filter didn't reach storage");

      return;
    }

    try {
      expect(await EWE.filters.getUserFilters())
        .toEqual(expect.arrayContaining([CONTENT_FILTER]));
    }
    finally {
      await EWE.filters.remove([CONTENT_FILTER_TEXT]);
    }
  });

  it("persists metadata filter storage data", async function() {
    let metadata = {a: 1};
    if (start) {
      await EWE.filters.add([METADATA_FILTER_TEXT], metadata);
      await wait(async() => {
        return await EWE.debugging.isInFilterStorage(METADATA_FILTER_TEXT);
      }, 2000, "The added filter didn't reach storage");

      return;
    }

    try {
      expect(await EWE.filters.getUserFilters())
        .toEqual(expect.arrayContaining([METADATA_FILTER]));

      expect(await EWE.filters.getMetadata(METADATA_FILTER_TEXT))
        .toEqual(metadata);
    }
    finally {
      await EWE.filters.remove([METADATA_FILTER_TEXT]);
    }
  });

  it("blocks a request using stored filters", async function() {
    this.timeout(8000);

    if (start) {
      await addFilter(IMAGE_FILTER_TEXT);
      if (!isMV3()) {
        await wait(async() => {
          return await EWE.debugging.isInFilterStorage(IMAGE_FILTER_TEXT);
        }, 2000, "The added filter didn't reach storage");
      }

      return;
    }

    await new Page("image.html?delay=500").expectResource("image.png")
      .toBeBlocked();
    await EWE.filters.remove([IMAGE_FILTER_TEXT]);
  });

  it("persists blocking filters state", async function() {
    if (start) {
      await addFilter(BLOCKING_FILTER_TEXT);
      if (!isMV3()) {
        await wait(async() => {
          return await EWE.debugging.isInFilterStorage(BLOCKING_FILTER_TEXT);
        }, 2000, "The added filter didn't reach storage");
      }

      return;
    }

    let userFilters = await EWE.filters.getUserFilters();
    if (userFilters.filter(e => e.text === IMAGE_FILTER_TEXT).length > 0) {
      await EWE.filters.remove(IMAGE_FILTER_TEXT);
    }

    try {
      expect(await EWE.filters.getUserFilters()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({text: BLOCKING_FILTER_TEXT})
        ])
      );
      await addFilter(IMAGE_FILTER_TEXT);
    }
    finally {
      await EWE.filters.remove([BLOCKING_FILTER_TEXT, IMAGE_FILTER_TEXT]);
    }
  });

  it("ignores file:/// entries in storage", async function() {
    if (start) {
      let randomKey = `file:///${new Date().getTime()}`;
      let saveData = {};
      saveData[randomKey] = {
        name: "name",
        width: 250,
        height: 345,
        src: "a base 64 string"
      };

      await browser.storage.local.set(saveData);
    }

    // This test recreates the situation in https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/175
    // The application not failing during the 'check' phase means
    // this test passes.
  });

  it("blocks a request using stored subscriptions", async function() {
    this.timeout(15000);

    if (start) {
      await EWE.subscriptions.add(subTestCustom1.url);
      await waitForSubscriptionToBeSynchronized(subTestCustom1.url);
      await EWE.debugging.ensureEverythingHasSaved();
      return;
    }

    try {
      await new Promise(r => setTimeout(r, 500));

      await new Page("image-from-subscription.html")
        .expectResource("image-from-subscription.png")
        .toBeBlocked();
    }
    finally {
      await EWE.subscriptions.remove(subTestCustom1.url);
    }
  });

  it("persists debug mode across browser restart [mv3-only]", async function() {
    if (start) {
      await EWE.debugging.setElementHidingDebugMode(true);
      await EWE.debugging.setElementHidingDebugStyle([["background", "pink"]]);
      return;
    }

    await addFilter("###elem-hide");
    let style = await waitForHighlightedStyle();
    await EWE.debugging.setElementHidingDebugMode(false);

    expect(style).toBe("rgb(255, 192, 203)");
    await EWE.debugging.clearDebugOptions();
  });
});
