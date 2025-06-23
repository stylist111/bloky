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

import {EWE} from "./messaging.js";
import {clearEndpointResponse} from "./utils.js";
import expect from "expect";
import {EXPERIMENT_FLAG, EXPERIMENT_URL, oneVariantConfig, twoVariantConfig} from "./fixtures/experiments.js";
import browser from "webextension-polyfill";

describe("EWE UI API tests", function() {
  describe("Experiments API", function() {
    let uiPort;
    let uiTab;

    before(async function() {
      function handleConnect(port) {
        if (port.name !== "experiments-ui-test") {
          return;
        }
        uiPort = port;

        browser.runtime.onConnect.removeListener(handleConnect);
      }

      browser.runtime.onConnect.addListener(handleConnect);
      uiTab = await browser.tabs.create({url: "experiments-test.html"});
    });

    after(async function() {
      await clearEndpointResponse(EXPERIMENT_URL);
      await EWE.experiments.clearFlagOverrides();
      await browser.tabs.remove(uiTab.id);
    });

    afterEach(async function() {
      await EWE.testing.resetExperimentData();
    });

    async function uiSendMessage(method, ...args) {
      // Currently we check if an element is displayed on the page by
      // injecting a script into the page via browser.tab.executeScript.
      // For extension pages we cannot use this, so we pass the information
      // retrieved on the UI page via a message.
      return new Promise((resolve, reject) => {
        uiPort.postMessage({method, args});
        uiPort.onMessage.addListener(message => {
          resolve(message);
        });

        uiPort.onDisconnect.addListener(() => {
          reject(new Error("Port disconnected without receiving the flag value"));
        });
      });
    }

    it("should return experiment flag in UI when flag is set", async function() {
      // wait for the page to load before trying to open the port
      await new Promise(r => setTimeout(r, 1000));
      const config = oneVariantConfig("test-ui-flag");
      await EWE.experiments.sync(config);
      const flagValue = await uiSendMessage("getFlag", EXPERIMENT_FLAG);
      expect(flagValue).toBe("test-ui-flag");
    });

    it("should NOT experiment flag in UI when flag is NOT set", async function() {
      const flagValue = await uiSendMessage("getFlag", EXPERIMENT_FLAG);
      expect(flagValue).toBeNull();
    });

    it("should get all experiment flags available for the user, in UI", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);
      await EWE.experiments.sync(config);
      const availableFlags = await EWE.experiments.getFlags();

      const uiFlags = await uiSendMessage("getFlags");
      expect(uiFlags).toEqual(availableFlags);
    });

    it("should get all experiment assignments available for the user, in UI", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);
      await EWE.experiments.sync(config);
      const assignments = await EWE.experiments.getAssignments();

      const uiAssignments = await uiSendMessage("getAssignments");
      expect(uiAssignments).toEqual(assignments);
    });
  });
});
