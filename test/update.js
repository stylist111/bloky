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

import {TEST_MV3_SUBSCRIPTION, TEST_ANTI_CV_SUBSCRIPTION,
        isFirefox, isMV3, readFile, writeFile} from "./utils.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {isConnected, updateExtensionFiles} from "./mocha/mocha-runner.js";
import {MIGRATED_TO_MV2, MIGRATED_TO_MV3} from "../sdk/api/prefs.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const filter = "someFilterAddedInANewWebExtentionRelease";

describe(`Update (${phase}) (runner only)`, function() {
  this.timeout(5000);

  before(async function() {
    if (!await isConnected())
      this.skip();
  });

  after(async function() {
    if (start) {
      await browser.storage.local.set({"update-test-running": true});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("update-test-running");
  });

  it("updates the subscription filter text if manifest version is updated", async function() {
    if (!isMV3())
      this.skip();

    const subscriptionFile = `subscriptions/${TEST_MV3_SUBSCRIPTION.id}`;
    const tmpSubscriptionFile = `${subscriptionFile}.tmp`;
    const manifestFile = "manifest.json";
    const tmpManifestFile = `${manifestFile}.tmp`;

    if (start) {
      await EWE.testing._removeAllSubscriptions();
      await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION.url);

      await updateExtensionFiles([
        // back-up
        {
          method: "copyFile",
          args: {
            from: subscriptionFile,
            to: tmpSubscriptionFile
          }
        },
        {
          method: "copyFile",
          args: {
            from: manifestFile,
            to: tmpManifestFile
          }
        },
        {
          method: "addLines",
          args: {
            file: subscriptionFile,
            lines: [filter]
          }
        },
        {
          method: "updateManifest",
          args: {
            version: "0.0.2"
          }
        }
      ]);
      return;
    }

    try {
      let filters = await EWE.subscriptions.getFilters(
        TEST_MV3_SUBSCRIPTION.url);
      expect(filters.find(it => it.text == filter)).toBeDefined();
    }
    finally {
      // restore from back-up
      await updateExtensionFiles([
        {
          method: "moveFile",
          args: {
            from: tmpSubscriptionFile,
            to: subscriptionFile
          }
        },
        {
          method: "moveFile",
          args: {
            from: tmpManifestFile,
            to: manifestFile
          }
        }
      ]);
    }
  });

  it("fixes the IO/Prefs prefixes", async function() {
    if (isMV3() || !isFirefox())
      this.skip();

    // we also need to skip the test if it's not "incognito" mode,
    // but we don't pass the search query to the text except "start=1" argument,
    // so `isIncognito()` does not work here.

    const PRE_SDK_PREFIX = "file:";
    const SDK_0_5_PREFIX = "abp:file:";
    const CURRENT_PREFIX = "ewe:file:";

    let preSdkFile = "preSdkFile.txt";
    let sdk0Dot5File = "sdk0.5File.txt";
    let file = "file.txt";
    let data1 = "someContent1";
    let data2 = "someContent2";
    if (start) {
      await writeFile(PRE_SDK_PREFIX, preSdkFile, data1);
      await writeFile(SDK_0_5_PREFIX, sdk0Dot5File, data2);

      // if both prefixes for the same file exist at the same time
      await writeFile(PRE_SDK_PREFIX, file, data1);
      await writeFile(SDK_0_5_PREFIX, file, data2);
      return;
    }

    let actualData1 = await readFile(CURRENT_PREFIX, preSdkFile);
    expect(actualData1.content).toEqual(Array.from(data1));

    let actualData2 = await readFile(CURRENT_PREFIX, sdk0Dot5File);
    expect(actualData2.content).toEqual(Array.from(data2));

    // pre-SDK should win
    let actualData3 = await readFile(CURRENT_PREFIX, file);
    expect(actualData3.content).toEqual(Array.from(data1));
  });

  it("does not migrate the subscriptions because of anti-cv subscription", async function() {
    if (isFirefox())
      this.skip();

    if (start) {
      await EWE.subscriptions.add(TEST_ANTI_CV_SUBSCRIPTION.url);

      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: TEST_ANTI_CV_SUBSCRIPTION.url,
          downloadable: true
        })]));
      await EWE.debugging.ensureEverythingHasSaved();
      await new Promise(elapsed => setTimeout(elapsed, 1000));

      expect(await EWE.testing._getPrefs("migration_state"))
        .toEqual(MIGRATED_TO_MV2);
    }

    await new Promise(elapsed => setTimeout(elapsed, 1000));

    // anti-cv subscriptions stay `DownloadableSubscription` even in MV3
    let downloadables = await EWE.subscriptions.getDownloadable();
    expect(downloadables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: TEST_ANTI_CV_SUBSCRIPTION.url,
        downloadable: true
      })]));

    expect(await EWE.testing._getPrefs("migration_state"))
      .toEqual(MIGRATED_TO_MV3);
  });
});
