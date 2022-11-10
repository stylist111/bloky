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

import {isMV3, TEST_ANTI_CV_SUBSCRIPTION, wait, TEST_MV3_SUBSCRIPTION, Page}
  from "./utils.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {isConnected, updateExtensionFiles} from "./mocha/mocha-runner.js";
import {MIGRATED_TO_MV2, MIGRATED_TO_MV3} from "../sdk/api/prefs.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const EASYLIST_URL_MV2 = "https://easylist-downloads.adblockplus.org/easylist.txt";
const EASYLIST_GERMANY_URL_MV2 = "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt";

const EASYLIST_URL_MV3 = "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt";
const EASYLIST_GERMANY_URL_MV3 = "https://easylist-downloads.adblockplus.org/v3/full/easylistgermany+easylist.txt";

const RE2_UNSUPPORTED_FILTER = "/t(?=re)/$image";

describe(`MV2 MV3 migrate (${phase}) (runner only)`, function() {
  this.timeout(5000);

  before(async function() {
    if (!await isConnected())
      this.skip();

    // it's meant to be started as MV2 test and restarted as MV3 test only
    if ((isMV3() && start) || (!isMV3() && !start))
      this.skip();
  });

  after(async function() {
    if (start) {
      await browser.storage.local.set({"migrate-test-running": true});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("migrate-test-running");
  });

  it("migrates user subscriptions", async function() {
    if (start) {
      expect(isMV3()).toBeFalsy(); // MV2 before the migration
      await EWE.testing._setPrefs("migration_state", MIGRATED_TO_MV2);
      await EWE.subscriptions.clearMigrationErrors();

      await EWE.testing._removeAllSubscriptions();
      await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION.mv2_url);
      await EWE.subscriptions.add(EASYLIST_URL_MV2);
      await EWE.subscriptions.add(EASYLIST_GERMANY_URL_MV2);
      await EWE.subscriptions.disable(EASYLIST_GERMANY_URL_MV2);

      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: TEST_MV3_SUBSCRIPTION.mv2_url,
          downloadable: true,
          enabled: true
        }),
        expect.objectContaining({
          url: EASYLIST_URL_MV2,
          downloadable: true,
          enabled: true
        }),
        expect.objectContaining({
          url: EASYLIST_GERMANY_URL_MV2,
          downloadable: true,
          enabled: false
        })
      ]));
      await EWE.debugging.ensureEverythingHasSaved();

      await updateExtensionFiles([
        {
          method: "copyDir",
          args: {
            from: "test-mv3"
          }
        }
      ]);

      return;
    }

    expect(isMV3()).toBeTruthy(); // MV3 after the migration

    await wait(async() => await EWE.testing._getPrefs("migration_state") === MIGRATED_TO_MV3,
               2000, "Prefs.migration_state was not set");

    let downloadables = await EWE.subscriptions.getDownloadable();
    expect(downloadables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: TEST_MV3_SUBSCRIPTION.url,
        downloadable: false,
        enabled: true
      }),
      expect.objectContaining({
        url: EASYLIST_URL_MV3,
        downloadable: false,
        enabled: true
      }),
      expect.objectContaining({
        url: EASYLIST_GERMANY_URL_MV3,
        downloadable: false,
        enabled: false
      })
    ]));

    await new Page("image-from-subscription.html").expectResource("image-from-subscription.png").toBeBlocked();
  });

  it("migrates user subscriptions meta data", async function() {
    if (start) {
      // assuming it's added in the test above
      await EWE.subscriptions.sync(EASYLIST_URL_MV2);

      await new Promise(elapsed => setTimeout(elapsed, 1000));
      await EWE.debugging.ensureEverythingHasSaved();

      let meta = await wait(async() => {
        let downloadables = await EWE.subscriptions.getDownloadable();
        let sub = downloadables.find(it => it.url == EASYLIST_URL_MV2);
        return (sub.downloadCount ? {
            downloadCount: sub.downloadCount,
            version: sub.version
          } : null);
      }, 3000, "The subscription is not yet downloaded");
      await browser.storage.local.set({meta});
      return;
    }

    let savedValues = await browser.storage.local.get("meta");
    let downloadables = await EWE.subscriptions.getDownloadable();
    let sub = downloadables.find(it => it.url == EASYLIST_URL_MV3);
    expect(sub.downloadCount >= savedValues.meta.downloadCount).toBeTruthy();
    expect(sub.version).toEqual(savedValues.meta.version);
  });

  it("migrates the anti-cv subscription and it stays downloadable, but with MV3 URL", async function() {
    if (start) {
      await EWE.subscriptions.add(TEST_ANTI_CV_SUBSCRIPTION.mv2_url); // MV2 URL

      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: TEST_ANTI_CV_SUBSCRIPTION.mv2_url,
          downloadable: true,
          enabled: true
        })
      ]));
      await EWE.debugging.ensureEverythingHasSaved();
      await new Promise(elapsed => setTimeout(elapsed, 1000));
      return;
    }

    await new Promise(elapsed => setTimeout(elapsed, 1000));

    let downloadables = await EWE.subscriptions.getDownloadable();
    expect(downloadables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: TEST_ANTI_CV_SUBSCRIPTION.url, // MV3 URL
        downloadable: true, // still downloadable even in MV3
        enabled: true
      })
    ]));
  });

  it("reports the subscription migration errors", async function() {
    const URL = "https://someSubsriptionThatIsNotSupportedInMV3.com";
    if (start) {
      await EWE.subscriptions.add(URL);

      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: URL,
          downloadable: true
        })]));
      await EWE.debugging.ensureEverythingHasSaved();
      await new Promise(elapsed => setTimeout(elapsed, 1000));

      return;
    }

    let errors = await EWE.subscriptions.getMigrationErrors();
    expect(errors).toEqual([
      expect.objectContaining({
        url: URL,
        error: `Failed to find the subscription with URL=${URL}`
      }),
      // This is part of migrate custom filter test
      expect.objectContaining({
        text: RE2_UNSUPPORTED_FILTER
      })
    ]);

    await EWE.subscriptions.clearMigrationErrors();
    errors = await EWE.subscriptions.getMigrationErrors();
    expect(errors).toEqual([]);
  });

  it("migrates custom filters", async function() {
    const meta = {tag: "test"};
    const enabledFilters = [
      "|test1.com$image",
      "test1.com###image",
      "@@other1.com$image",
      "test1.com#@##image"
    ];
    const disabledFilters = [
      "|test2.com$image",
      "test2.com###image",
      "@@other2.com$image",
      "test2.com#@##image"
    ];
    const allFilters = [
      ...enabledFilters,
      ...disabledFilters
    ];

    if (start) {
      await EWE.filters.add([RE2_UNSUPPORTED_FILTER, ...allFilters], meta);
      await EWE.filters.disable(disabledFilters);
      await EWE.debugging.ensureEverythingHasSaved();
      return;
    }

    for (const filter of allFilters)
      expect(await EWE.filters.getMetadata(filter)).toEqual(meta);

    let expectedEnabled = enabledFilters.map(text => expect.objectContaining({
      text, enabled: true
    }));
    let expectedDisabled = disabledFilters.map(text => expect.objectContaining({
      text, enabled: false
    }));
    let expectedUserFilters = [...expectedEnabled, ...expectedDisabled];
    expect(await EWE.filters.getUserFilters())
      .toEqual(expect.arrayContaining(expectedUserFilters));
  });
});
