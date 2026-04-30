/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable camelcase */

import { expect } from "expect";
import {
  getOptionsHandle,
  updateSettings,
  setRemoteConfigUrl,
  syncRemoteConfig,
  resetRemoteConfig,
  setRemoteConfigCohorts,
  setRemoteConfigCountryCode,
  setRemoteConfigExperiments,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  clearDismissedIpmIds,
  getPendingLoggerCdpEventStats,
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab, waitForAssertion } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  updateUrlCohort,
  updateUrlVersions,
  updateAdBlockCohort,
  updateAdblockPlusCohort,
} from "../../utils/urls.js";
import {
  commandReceivedEvent,
  tabCommandReadyEvent,
  tabCreatedEvent,
  tabLoadedEvent,
} from "../../utils/events.js";
import { initOptionsGeneralTab } from "../../utils/page.js";
import { expectedIPMCommands } from "../../utils/ipms.js";

export default () => {
  before(async function () {
    await setIPMCooldowns(initOptionsGeneralTab);

    // `suppress_update_page` must be set to false before running tests,
    // so that newtabs can be triggered. This setting is otherwise set to true
    // to prevent real newtab IPMs from opening and interfering with the tests.
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", false);
  });

  beforeEach(async function () {
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await clearDismissedIpmIds(initOptionsGeneralTab);
    await resetRemoteConfig(initOptionsGeneralTab);
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updateSettings(initOptionsGeneralTab, "suppress_update_page", true);
    await resetRemoteConfig(initOptionsGeneralTab);
  });

  it("dismisses a command (if no longer present in remote config)", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.versions);

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_none");
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not execute invalid command", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_invalid_command");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    // The command is not stored due to invalid commands
    // causing the entire remote config to be invalid
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not execute command with unknown command name", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_unknown_command");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.error_unknown_command);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not execute command with wrong version", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_wrong_version");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not execute command with missing parameters", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_error_missing_params");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    // The command is not stored due to missing parameters
    // causing the entire remote config to be invalid
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("executes only commands with matching cohorts", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigCohorts(initOptionsGeneralTab, [
      {
        name: "Test country",
        conditions: {
          all: [
            {
              fact: "countryCode",
              operator: "equal",
              value: "xx",
            },
          ],
        },
        event: {
          type: "test-countrycode",
        },
      },
    ]);
    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_cohort");

    await setRemoteConfigCountryCode(initOptionsGeneralTab, "xy");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cohort);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlCohort, { exists: false });

    await setRemoteConfigCountryCode(initOptionsGeneralTab, "xx");
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cohort);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlCohort, { exists: true });
  });

  it("with multiple ipm configs, executes only commands with matching extension cohorts", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigCohorts(initOptionsGeneralTab, [
      {
        name: "Test AdBlock",
        conditions: {
          all: [
            {
              fact: "extName",
              operator: "equal",
              value: "adblock",
            },
          ],
        },
        event: {
          type: "test-adblock",
        },
      },
      {
        name: "Test Adblock Plus",
        conditions: {
          all: [
            {
              fact: "extName",
              operator: "equal",
              value: "adblockplus",
            },
          ],
        },
        event: {
          type: "test-adblockplus",
        },
      },
    ]);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_extension_cohort_with_multiple_commands",
    );

    await syncRemoteConfig(initOptionsGeneralTab);

    await findUrl(updateAdBlockCohort, { exists: true, mustLoad: true });
    await findUrl(updateAdblockPlusCohort, { exists: false });

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmIdAdblock = "test_adblock_cohort_with_multiple_commands";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdAdblock}`, 1);
      expect(counts).toHaveProperty(`${tabCommandReadyEvent}:${ipmIdAdblock}`, 1);
      expect(counts).toHaveProperty(`${tabCreatedEvent}:${ipmIdAdblock}`, 1);
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmIdAdblock}`, 1);

      const ipmIdAdblockPlus = "test_adblockplus_cohort_with_multiple_commands";
      expect(counts).toHaveProperty(`${commandReceivedEvent}:${ipmIdAdblockPlus}`, 1);
      expect(counts).not.toHaveProperty(`${tabCommandReadyEvent}:${ipmIdAdblockPlus}`);
      expect(counts).not.toHaveProperty(`${tabCreatedEvent}:${ipmIdAdblockPlus}`);
      expect(counts).not.toHaveProperty(`${tabLoadedEvent}:${ipmIdAdblockPlus}`);
    });
  });

  it("does not execute commands on Firefox", async function () {
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  describe("variant-scoped ipmCommands", function () {
    function makeVariantCommand(ipmId) {
      return {
        ipm_id: ipmId,
        command_name: "create_on_page_dialog",
        timing: "after_navigation",
        version: 8,
        // Using a reserved (RFC 2606) domain so the OPD never fires on
        // navigation in subsequent tests — these tests only assert on
        // getIpmCommands() output, not on actual rendering.
        domain_list: "variant-test-only.invalid",
        content: {
          en: {
            sub_title: `OPD ${ipmId} title`,
            lower_body: `ipmID: ${ipmId}`,
            upper_body: `Variant-scoped OPD: ${ipmId}`,
            button_label: "CTA variant",
          },
        },
        button_target: "/premium",
        display_duration: 1,
      };
    }

    it("returns ipmCommands carried by an assigned experiment variant", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }

      const ipmId = "test_adblock_variant_ipm";

      // Single-variant experiment with mods [0, 1000] so every seed lands on it.
      // Confirms variant-scoped ipmCommands surface through getIpmCommands.
      await setRemoteConfigExperiments(initOptionsGeneralTab, [
        {
          experimentId: ipmId,
          variants: [
            {
              variantId: "only-variant",
              flags: {},
              mods: [0, 1000],
              ipmCommands: [makeVariantCommand(ipmId)],
            },
          ],
        },
      ]);
      await syncRemoteConfig(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
      expect(ipmCommands).toHaveProperty(ipmId);
    });

    it("merges top-level ipmCommands with the assigned variant's ipmCommands", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }

      const variantIpmId = "test_adblock_merge_variant";

      await setRemoteConfigIpmCommands(initOptionsGeneralTab, "test_adblock_versions");
      await setRemoteConfigExperiments(initOptionsGeneralTab, [
        {
          experimentId: variantIpmId,
          variants: [
            {
              variantId: "only-variant",
              flags: {},
              mods: [0, 1000],
              ipmCommands: [makeVariantCommand(variantIpmId)],
            },
          ],
        },
      ]);
      await syncRemoteConfig(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
      // Top-level commands stay; variant commands are added on top.
      expect(ipmCommands).toHaveProperty("test_adblock_versions");
      expect(ipmCommands).toHaveProperty(variantIpmId);
    });

    it("returns only the assigned variant's ipmCommands when multiple variants carry them", async function () {
      // IPMs are not supported in Firefox
      if (browserDetails.browserName === "firefox") {
        this.skip();
      }

      const variantAIpmId = "test_adblock_variant_a_ipm";
      const variantBIpmId = "test_adblock_variant_b_ipm";

      // Mods [0, 1] and [1, 1000] cover the full range without overlap. The
      // assertion below holds regardless of which bucket the seed lands in.
      await setRemoteConfigExperiments(initOptionsGeneralTab, [
        {
          experimentId: "test_adblock_two_variants",
          variants: [
            {
              variantId: "variant-a",
              flags: {},
              mods: [0, 1],
              ipmCommands: [makeVariantCommand(variantAIpmId)],
            },
            {
              variantId: "variant-b",
              flags: {},
              mods: [1, 1000],
              ipmCommands: [makeVariantCommand(variantBIpmId)],
            },
          ],
        },
      ]);
      await syncRemoteConfig(initOptionsGeneralTab);

      const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
      const present = [variantAIpmId, variantBIpmId].filter((id) =>
        Object.prototype.hasOwnProperty.call(ipmCommands, id),
      );
      expect(present).toHaveLength(1);
    });
  });
};
