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

import {Page, TEST_MV3_SUBSCRIPTION,
        isFirefox, isMV3, readFile, writeFile, setMinTimeout, wait} from "./utils.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {isConnected, updateExtensionFiles} from "./mocha/mocha-runner.js";

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

  it("updates the subscription filter text when updating the extension", async function() {
    setMinTimeout(this, 3000);
    if (!isMV3())
      this.skip();

    const subscriptionFile = `subscriptions/${TEST_MV3_SUBSCRIPTION.id}`;
    const tmpSubscriptionFile = `${subscriptionFile}.tmp`;

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
          method: "addLines",
          args: {
            file: subscriptionFile,
            lines: [filter]
          }
        }
      ]);
      return;
    }
    await new Promise(r => setTimeout(r, 50));

    let filters;

    await wait(async() => {
      filters = await EWE.subscriptions.getFilters(
        TEST_MV3_SUBSCRIPTION.url);
      if (filters.length > 0)
        return filters;
    }, 40000, "Events are not received");
    expect(filters.find(it => it.text == filter)).toBeDefined();
    try {
      let downloadables = await EWE.subscriptions.getDownloadable();
      expect(downloadables).toEqual(expect.arrayContaining([
        expect.objectContaining({
          url: TEST_MV3_SUBSCRIPTION.url,
          downloadable: false,
          enabled: true
        })
      ]));
      // Page load sometimes occurs while the system isn't ready
      await new Promise(r => setTimeout(r, 50));

      await new Page("image-from-subscription.html").expectResource("image-from-subscription.png").toBeBlocked();
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
});
