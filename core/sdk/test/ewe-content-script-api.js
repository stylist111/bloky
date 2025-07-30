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
import {getElementAttribute, Page} from "./utils.js";
import {wait} from "./polling.js";
import expect from "expect";
import {oneVariantConfig, twoVariantConfig} from "./fixtures/experiments.js";
import {DEFAULT_CONFIG} from "./fixtures/remote-config.js";

describe("EWE Content Script API tests", function() {
  describe("Experiments API", function() {
    after(async function() {
      await EWE.experiments.clearFlagOverrides();
    });

    beforeEach(async function() {
      await EWE.testing.resetRemoteConfig();
      await EWE.testing.resetExperimentData();
    });

    const timeout = 4000;

    async function getValueFromPage(tabId, dataAttr) {
      let value;

      await wait(async() => {
        value = await getElementAttribute(tabId, "experiments-api-test", dataAttr);
        return value !== null;
      }, timeout, `Experiment ${dataAttr} is not visible`);

      return JSON.parse(value);
    }

    it("should return flag when flag is set", async function() {
      const flagValue = "test-content-script-flag";
      const config = oneVariantConfig(flagValue);
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const tabId = await new Page("experiments-content-api.html").loaded;

      const contentFlagValue = await getValueFromPage(tabId, "data-get-flag");

      expect(contentFlagValue).toContain(flagValue);
    });

    it("should NOT return flag when flag is NOT set", async function() {
      let value;
      const tabId = await new Page("experiments-content-api.html").loaded;

      await wait(async() => {
        value = await getElementAttribute(tabId, "experiments-api-test", "data-get-flag");
        return value === null;
      }, timeout, "Experiment Flag is set in content script");

      expect(value).toBeNull();
    });

    it("should get all available flags in content scripts", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const availableFlags = await EWE.experiments.getFlags();

      const tabId = await new Page("experiments-content-api.html").loaded;
      const contentFlags = await getValueFromPage(tabId, "data-get-flags");

      expect(contentFlags).toEqual(availableFlags);
    });

    it("should get the experiment assignments in content scripts", async function() {
      const config = twoVariantConfig([0, 500], [500, 1000]);
      await EWE.testing.mockRemoteConfig({
        ...DEFAULT_CONFIG,
        experiments: config
      });
      await EWE.experiments.sync();
      const availableAssignments = await EWE.experiments.getAssignments();

      const tabId = await new Page("experiments-content-api.html").loaded;
      const contentAssignments = await getValueFromPage(tabId, "data-get-assignments");

      expect(contentAssignments).toEqual(availableAssignments);
    });
  });
});
