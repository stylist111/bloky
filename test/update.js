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

import {TEST_MV3_SUBSCRIPTION, isMV3TestSubsExtension}
  from "./utils.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {isConnected, updateExtensionFiles} from "./mocha/mocha-runner.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const filter = "someFilterAddedInANewWebExtentionRelease";

describe(`MV3 update (${phase}) (runner only)`, function() {
  this.timeout(5000);

  before(async function() {
    if (!await isConnected())
      this.skip();

    if (!isMV3TestSubsExtension())
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
    const subscriptionFile = `subscriptions/${TEST_MV3_SUBSCRIPTION.id}`;
    const tmpSubscriptionFile = `${subscriptionFile}.tmp`;
    const manifestFile = "manifest.json";
    const tmpManifestFile = `${manifestFile}.tmp`;

    if (start) {
      await EWE.subscriptions.removeAll();
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
});
