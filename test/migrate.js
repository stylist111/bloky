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

import {TEST_PAGES_URL} from "./test-server-urls.js";
import {isMV3, Page, expectElemHideHidden} from "./utils.js";
import {subAntiCVLocal, subTestCustom1, subEasylistLive,
        subEasylistPlusGermanyLive} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {updateExtensionFiles} from "./mocha/mocha-runner.js";
import {MIGRATED_TO_MV2, MIGRATED_TO_MV3} from "../sdk/api/prefs.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const RE2_UNSUPPORTED_FILTER = "/t(?=re)/$image";

describe(`MV2 MV3 migrate (${phase}) [runner-only]`, function() {
  this.timeout(10000);

  before(async function() {
    // it's meant to be started as MV2 test and restarted as MV3 test only
    if ((isMV3() && start) || (!isMV3() && !start)) {
      this.skip();
    }

    if (!start) {
      // Wait for EWE to be started, so migrations is definitely done before we
      // start asserting about it.
      await wait(async() => {
        let actualState = await browser.runtime.sendMessage({
          type: "ewe-test:getState"
        });
        return actualState == "started";
      }, 10000, "EWE not started");
    }
  });

  after(async function() {
    if (start) {
      await browser.storage.local.set({"mv2-mv3-migrate-test-running": true});
      await browser.storage.local.set({search: document.location.search});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("mv2-mv3-migrate-test-running");
    await browser.storage.local.remove("search");
  });

  it("migrates user's subscriptions that are bundled in MV3", async function() {
    if (start) {
      expect(isMV3()).toBeFalsy(); // MV2 before the migration
      await EWE.testing._setPrefs("migration_state", MIGRATED_TO_MV2);
      // We assume that there are no migration errors at this point.

      await EWE.testing._removeAllSubscriptions();
      // The subscription below does not work in MV2 (not synchronized),
      // but works in MV3 as we don't serve /mv2_subscription.txt,
      // but do serve /subscription.txt on localhost.
      await EWE.subscriptions.add(subTestCustom1.mv2_url);
      await EWE.subscriptions.add(subEasylistLive.mv2_url);
      await EWE.subscriptions.add(subEasylistPlusGermanyLive.mv2_url);
      await EWE.subscriptions.disable(subEasylistPlusGermanyLive.mv2_url);

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: subTestCustom1.mv2_url,
          updatable: true,
          enabled: true
        }),
        expect.objectContaining({
          url: subEasylistLive.mv2_url,
          updatable: true,
          enabled: true
        }),
        expect.objectContaining({
          url: subEasylistPlusGermanyLive.mv2_url,
          updatable: true,
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

    // We rely on migration being done at this time.
    await wait(async() => await EWE.testing._getPrefs("migration_state") === MIGRATED_TO_MV3,
               10000, "Prefs.migration_state was not set");

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subTestCustom1.url,
        updatable: false, // no `diff_url` provided
        enabled: true
      }),
      expect.objectContaining({
        url: subEasylistLive.url,
        updatable: true,
        diffURL: expect.any(String),
        enabled: true
      }),
      expect.objectContaining({
        url: subEasylistPlusGermanyLive.url,
        updatable: false, // no `diff_url` provided
        enabled: false
      })
    ]));

    let subscriptions = await EWE.subscriptions.getForFilter(
      "/image-from-subscription.png^$image");
    expect(subscriptions).toHaveLength(1);
  });

  it("migrates custom user subscriptions", async function() {
    let url = `${TEST_PAGES_URL}/custom-subscription-for-migration.txt`;

    if (start) {
      await EWE.subscriptions.add(url);

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual(expect.arrayContaining([
        expect.objectContaining({url})
      ]));
      await EWE.debugging.ensureEverythingHasSaved();
      return;
    }

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({url})
    ]));

    await new Page("image.html")
      .expectResource("image.png")
      .toBeBlocked();
  });

  it("migrates user subscriptions meta data", async function() {
    if (start) {
      // assuming it's added in the test above
      await EWE.subscriptions.sync(subEasylistLive.mv2_url);

      await new Promise(elapsed => setTimeout(elapsed, 1000));
      await EWE.debugging.ensureEverythingHasSaved();

      let meta = await wait(async() => {
        let subs = await EWE.subscriptions.getSubscriptions();
        let sub = subs.find(it => it.url == subEasylistLive.mv2_url);
        return (sub.downloadCount ? {
            downloadCount: sub.downloadCount,
            version: sub.version
          } : null);
      }, 3000, "The subscription is not yet downloaded");
      await browser.storage.local.set({meta});
      return;
    }

    let savedValues = await browser.storage.local.get("meta");
    let subs = await EWE.subscriptions.getSubscriptions();
    let sub = subs.find(it => it.url == subEasylistLive.url);
    expect(sub.downloadCount)
      .toBeGreaterThanOrEqual(savedValues.meta.downloadCount);
    expect(parseInt(sub.version, 10))
      .toBeGreaterThanOrEqual(parseInt(savedValues.meta.version, 10));
  });

  it("migrates the anti-cv subscription", async function() {
    this.timeout(20000);

    if (start) {
      await EWE.subscriptions.add(subAntiCVLocal.mv2_url);

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: subAntiCVLocal.mv2_url,
          updatable: true, // FullUpdatableSubscription
          enabled: true
        })
      ]));
      await EWE.debugging.ensureEverythingHasSaved();
      await new Promise(elapsed => setTimeout(elapsed, 1000));
      return;
    }

    await new Promise(elapsed => setTimeout(elapsed, 1000));

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subAntiCVLocal.url, // MV3 URL
        updatable: true, // DiffUpdatableSubscription
        diffURL: expect.any(String),
        // This subscription has a valid/test diffURL so it should synchronize
        // after being migrated.
        downloadStatus: "synchronize_ok",
        enabled: true
      })
    ]));

    // has a new filter provided in a diff update
    let subscriptions = await EWE.subscriptions.getForFilter(
      "localhost###migrate-diff-elem-item");
    expect(subscriptions).toHaveLength(1);

    // Checks that the content filter actually works
    const elemId = "migrate-diff-elem-item";
    await expectElemHideHidden({elemId, timeout: 10000});
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

    for (const filter of allFilters) {
      expect(await EWE.filters.getMetadata(filter)).toEqual(meta);
    }

    let expectedEnabled = enabledFilters.map(text => expect.objectContaining({
      text, enabled: true
    }));
    let expectedDisabled = disabledFilters.map(text => expect.objectContaining({
      text, enabled: false
    }));
    let expectedUserFilters = [...expectedEnabled, ...expectedDisabled];
    expect(await EWE.filters.getUserFilters())
      .toEqual(expect.arrayContaining(expectedUserFilters));

    expect(await EWE.filters.getMigrationErrors()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filter: expect.objectContaining({text: RE2_UNSUPPORTED_FILTER})
        })
      ])
    );
  });

  // Due to the nature of how we test this entire mechanism, the order of when
  // this test is run is important.
  it("clears custom filter migration errors", async function() {
    if (start) {
      return;
    }

    let errors = await EWE.filters.getMigrationErrors();
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filter: expect.objectContaining({
            text: RE2_UNSUPPORTED_FILTER
          })
        })
      ])
    );

    await EWE.filters.clearMigrationErrors();
    errors = await EWE.filters.getMigrationErrors();
    expect(errors).toEqual([]);
  });
});
