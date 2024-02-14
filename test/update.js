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

import {Page, TEST_MV3_SUBSCRIPTION, isFirefox, readFile, writeFile,
        setMinTimeout, isIncognito, firefoxVersion, TEST_PAGES_URL}
  from "./utils.js";
import {wait} from "./polling.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {updateExtensionFiles} from "./mocha/mocha-runner.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const filter = "someFilterAddedInANewWebExtentionRelease";

describe(`Update (${phase}) [runner-only]`, function() {
  setMinTimeout(this, 5000);

  before(async function() {
    if (start) {
      await EWE.testing._removeAllSubscriptions();
      return;
    }

    setMinTimeout(this, 12000);
    // Wait for EWE to be started
    // (loading filter text and applying DNR rulesets might take a while)
    await wait(async() => {
      let actualState = await browser.runtime.sendMessage({
        type: "ewe-test:getState"
      });
      return actualState == "started";
    }, 10000, "EWE not started");
  });

  after(async function() {
    if (start) {
      await updateExtensionFiles([
        {
          method: "updateManifest",
          args: {
            version: "0.0.2"
          }
        }
      ]);

      await browser.storage.local.set({"update-test-running": true});
      await browser.storage.local.set({search: document.location.search});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("update-test-running");
    await browser.storage.local.remove("search");
  });

  it("updates the subscription filter text when updating the extension [mv3-only]", async function() {
    const subscriptionFile = `subscriptions/${TEST_MV3_SUBSCRIPTION.id}`;

    if (start) {
      await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION.url);

      await updateExtensionFiles([
        {
          method: "addLines",
          args: {
            file: subscriptionFile,
            lines: [filter]
          }
        }
      ]);
      return;
    }

    setMinTimeout(this, 20000);

    let filters = await EWE.subscriptions.getFilters(TEST_MV3_SUBSCRIPTION.url);
    expect(filters).toContainEqual(expect.objectContaining({
      text: filter
    }));

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: TEST_MV3_SUBSCRIPTION.url,
        updatable: false, // no `diff_url` provided
        enabled: true
      })
    ]));

    await new Page("image-from-subscription.html")
      .expectResource("image-from-subscription.png")
      .toBeBlocked();
  });

  it("maintains custom user subscriptions in an update", async function() {
    let subscriptionUrl = `${TEST_PAGES_URL}/custom-subscription-for-migration.txt`;

    if (start) {
      await EWE.subscriptions.add(subscriptionUrl);
      return;
    }

    let filters = await EWE.subscriptions.getFilters(subscriptionUrl);
    expect(filters).toContainEqual(expect.objectContaining({
      text: "/image.png^$image"
    }));

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subscriptionUrl,
        updatable: true, // full updatable
        enabled: true
      })
    ]));
  });

  it("fixes the IO/Prefs prefixes [mv2-only]", async function() {
    // Firefox 115 supports IndexedDB, so we don't switch to b.s.l for IO
    if (!isFirefox() || !isIncognito() || firefoxVersion() >= 115) {
      this.skip();
    }

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
});
