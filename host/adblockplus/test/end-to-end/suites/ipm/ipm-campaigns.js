/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2025-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable camelcase */

import { expect } from "expect";
import {
  getOptionsHandle,
  updatePrefs,
  setRemoteConfigUrl,
  syncRemoteConfig,
  resetRemoteConfig,
  setRemoteConfigCohorts,
  setRemoteConfigCountryCode,
  setRemoteConfigIpmCommands,
  getIPMCommands,
  setIPMCooldowns,
  resetIPMFragment,
  setIPMFragment,
  clearDismissedIpmIds,
  getPendingLoggerCdpEventStats
} from "@eyeo/test-utils/extension";
import { findUrl, openNewTab, waitForAssertion } from "@eyeo/test-utils/driver";
import { localTestPageUrl } from "@eyeo/test-utils/host-urls";
import {
  updateUrlCohort,
  updateUrlVersions,
  updateAdBlockCohort,
  updateAdblockPlusCohort
} from "../../utils/urls.js";
import {
  commandReceivedEvent,
  tabCommandReadyEvent,
  tabCreatedEvent,
  tabLoadedEvent
} from "../../utils/events.js";

import { initOptionsGeneralTab } from "../../utils/page.js";
import { expectedIPMCommands } from "../../utils/ipms.js";

export default (fragmentType) => {
  before(async function () {
    await setIPMCooldowns(initOptionsGeneralTab);

    // `suppress_first_run_page` must be set to false before running tests,
    // so that newtabs can be triggered. This setting is otherwise set to true
    // to prevent real newtab IPMs from opening and interfering with the tests.
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", false);

    await setIPMFragment(initOptionsGeneralTab, fragmentType);
  });

  beforeEach(async function () {
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await clearDismissedIpmIds(initOptionsGeneralTab);
    await resetRemoteConfig(initOptionsGeneralTab);
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await updatePrefs(initOptionsGeneralTab, "suppress_first_run_page", true);
    await resetIPMFragment(initOptionsGeneralTab);
    await resetRemoteConfig(initOptionsGeneralTab);
  });

  it("checks command versions and ping alarm", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // Pings only exist in the legacy fragment
    if (fragmentType === "future") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_versions"
    );
    const payload = await syncRemoteConfig(initOptionsGeneralTab);
    const { capabilities } = payload.ipm;
    let { pingAlarm } = await driver.executeAsyncScript(async (callback) => {
      pingAlarm = await browser.alarms.get("ipm_ping_schedule");
      callback({ pingAlarm });
    });

    expect(pingAlarm.scheduledTime).toBeGreaterThan(Date.now());

    expect(capabilities).toEqual([
      { name: "multi_ipm_response", version: 1 },
      { name: "create_on_page_dialog", version: 7 },
      { name: "create_tab", version: 6 },
      { name: "delete_commands", version: 2 }
    ]);
  });

  it("dismisses a command (using delete_commands command)", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // The delete_commands command is not needed in the future fragment
    if (fragmentType === "future") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_versions"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.versions[fragmentType]);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_delete"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("dismisses a command (if no longer present in remote config)", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // This behavior only exists in the future fragment
    if (fragmentType === "legacy") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_versions"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.versions[fragmentType]);

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

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_error_invalid_command"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    // For future fragment, the command is not stored due to invalid commands
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

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_error_unknown_command"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    if (fragmentType === "legacy") {
      expect(ipmCommands).toEqual({});
    } else {
      expect(ipmCommands).toEqual(
        expectedIPMCommands.error_unknown_command[fragmentType]
      );
    }

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });

  it("does not execute command with wrong version", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_error_wrong_version"
    );
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

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_error_missing_params"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    // For future fragment, the command is not stored due to missing parameters
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

    // This behavior only exists in the future fragment
    if (fragmentType === "legacy") {
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
              value: "xx"
            }
          ]
        },
        event: {
          type: "test-countrycode"
        }
      }
    ]);
    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_cohort"
    );

    await setRemoteConfigCountryCode(initOptionsGeneralTab, "xy");
    await syncRemoteConfig(initOptionsGeneralTab);

    let ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cohort[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlCohort, { exists: false });

    await setRemoteConfigCountryCode(initOptionsGeneralTab, "xx");
    await syncRemoteConfig(initOptionsGeneralTab);

    ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual(expectedIPMCommands.cohort[fragmentType]);

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlCohort, { exists: true });
  });

  it("with multiple ipm configs, executes only commands with matching extension cohorts", async function () {
    // IPMs are not supported in Firefox
    if (browserDetails.browserName === "firefox") {
      this.skip();
    }

    // This behavior only exists in the future fragment
    if (fragmentType === "legacy") {
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
              value: "adblock"
            }
          ]
        },
        event: {
          type: "test-adblock"
        }
      },
      {
        name: "Test Adblock Plus",
        conditions: {
          all: [
            {
              fact: "extName",
              operator: "equal",
              value: "adblockplus"
            }
          ]
        },
        event: {
          type: "test-adblockplus"
        }
      }
    ]);

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_extension_cohort_with_multiple_commands"
    );

    await syncRemoteConfig(initOptionsGeneralTab);

    await findUrl(updateAdBlockCohort, { exists: false });
    await findUrl(updateAdblockPlusCohort, { exists: true, mustLoad: true });

    await initOptionsGeneralTab(getOptionsHandle());
    await waitForAssertion(async () => {
      const { counts } = await getPendingLoggerCdpEventStats();

      const ipmIdAdblock = "test_adblock_cohort_with_multiple_commands";
      expect(counts).toHaveProperty(
        `${commandReceivedEvent}:${ipmIdAdblock}`,
        1
      );
      expect(counts).not.toHaveProperty(
        `${tabCommandReadyEvent}:${ipmIdAdblock}`
      );
      expect(counts).not.toHaveProperty(`${tabCreatedEvent}:${ipmIdAdblock}`);
      expect(counts).not.toHaveProperty(`${tabLoadedEvent}:${ipmIdAdblock}`);

      const ipmIdAdblockPlus = "test_adblockplus_cohort_with_multiple_commands";
      expect(counts).toHaveProperty(
        `${commandReceivedEvent}:${ipmIdAdblockPlus}`,
        1
      );
      expect(counts).toHaveProperty(
        `${tabCommandReadyEvent}:${ipmIdAdblockPlus}`,
        1
      );
      expect(counts).toHaveProperty(
        `${tabCreatedEvent}:${ipmIdAdblockPlus}`,
        1
      );
      expect(counts).toHaveProperty(`${tabLoadedEvent}:${ipmIdAdblockPlus}`, 1);
    });
  });

  it("does not execute commands on Firefox", async function () {
    if (browserDetails.browserName !== "firefox") {
      this.skip();
    }

    await setRemoteConfigIpmCommands(
      initOptionsGeneralTab,
      "test_adblockplus_versions"
    );
    await syncRemoteConfig(initOptionsGeneralTab);

    const ipmCommands = await getIPMCommands(initOptionsGeneralTab);
    expect(ipmCommands).toEqual({});

    await openNewTab(localTestPageUrl);
    await findUrl(updateUrlVersions, { exists: false });
  });
};
