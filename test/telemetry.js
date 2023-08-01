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

import browser from "webextension-polyfill";
import expect from "expect";
import {EWE} from "./messaging.js";
import {clearRequestLogs, getRequestLogs, waitForAssertion,
        TEST_ADMIN_PAGES_URL} from "./utils.js";

describe("Telemetry", function() {
  const TELEMETRY_URL = `${TEST_ADMIN_PAGES_URL}/telemetry`;
  const TELEMETRY_STORAGE_KEY = "ewe:telemetry";
  const TELEMETRY_ARGS = {
    url: TELEMETRY_URL,
    bearer: "bbb"
  };

  it("pings the telemetry server at startup", async function() {
    await waitForAssertion(async() => {
      let result = await browser.storage.local.get([TELEMETRY_STORAGE_KEY]);
      expect(result[TELEMETRY_STORAGE_KEY]).toEqual({
        firstPing: expect.any(String)
      });
    });
  });

  it("does not ping again when started multiple times immediately", async function() {
    await EWE.testing.resetTelemetry();
    await clearRequestLogs();

    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);
    EWE.testing.startTelemetry(TELEMETRY_ARGS);

    // wait for the telemetry requests to be sent
    await new Promise(r => setTimeout(r, 1000));

    let responses = await getRequestLogs();
    expect(responses.filter(request => request.url == "/telemetry").length)
      .toEqual(1);
  });

  it("doesn't ping again when starting again later", async function() {
    await clearRequestLogs();
    await EWE.testing.stopTelemetry();

    EWE.testing.startTelemetry(TELEMETRY_ARGS);

    // wait for the telemetry requests to be sent
    await new Promise(r => setTimeout(r, 1000));

    let responses = await getRequestLogs();
    expect(responses.filter(request => request.url == "/telemetry").length)
      .toEqual(0);
  });

  it("doesn't send request if both url and bearer token aren't provided", async function() {
    await expect(EWE.testing.startTelemetry({url: TELEMETRY_URL}))
      .rejects.toThrow("Error: No telemetry `bearer` provided");
    await expect(EWE.testing.startTelemetry({bearer: "bbb"}))
      .rejects.toThrow("Error: No telemetry `url` provided");
  });

  it("sends extension metadata to the telemetry server", async function() {
    await clearRequestLogs();
    await EWE.testing.resetTelemetry();

    await EWE.testing.startTelemetry(TELEMETRY_ARGS);

    await waitForAssertion(async() => {
      let requests = await getRequestLogs();
      expect(requests).toEqual([
        expect.objectContaining({
          url: "/telemetry",
          method: "POST",
          body: {
            extension_name: "eyeo's Web Extension Ad Blocking Toolkit Test Extension",
            extension_version: "0.0.1"
          }
        })
      ]);
    });
  });
});
