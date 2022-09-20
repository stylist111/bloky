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

import {isMV3} from "./utils.js";
import {runInBackgroundPage} from "./messaging.js";
import {isConnected, updateExtensionFiles} from "./mocha/mocha-runner.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

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
    const MANIFEST_FILE = "manifest.json";
    const TMP_MANIFEST_FILE = `${MANIFEST_FILE}.tmp`;

    if (start) {
      expect(isMV3()).toBeFalsy(); // MV2 before the migration

      await updateExtensionFiles([
        {
          method: "copyDir",
          args: {
            from: "test-mv3"
          }
        },
        {
          method: "copyFile",
          args: {
            from: MANIFEST_FILE,
            to: TMP_MANIFEST_FILE
          }
        },
        {
          method: "updateManifest",
          args: {
            version: "0.0.3"
          }
        }
      ]);
      return;
    }

    try {
      expect(isMV3()).toBeTruthy(); // MV3 after the migration
    }
    finally {
      // restore from back-up
      await updateExtensionFiles([
        {
          method: "moveFile",
          args: {
            from: TMP_MANIFEST_FILE,
            to: MANIFEST_FILE
          }
        }
      ]);
    }
  });
});
