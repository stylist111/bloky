/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

/**
 * @file E2E tests for the main-world snippet → CustomEvent bridge →
 * sendSnippetHitEvent → telemetry pipeline.
 *
 * Flow: a main-world snippet (json-prune) fires on the test page →
 * calls env.sendSnippetHitEvent (provided by SDK) → dispatches
 * ewe:snippet-hit on the comms channel → isolated-world
 * mainWorldMessageListener routes it → sendSnippetHitEvent →
 * logger.behavior() → trackBehaviourEvent() →
 * ewe:telemetry-behaviour-counts in storage.
 */

import { expect } from "expect";

import { openNewTab } from "@eyeo/test-utils/driver";
import {
  getOptionsHandle,
  getPendingLoggerCdpEventStats,
  addFiltersProgrammatically,
  removeFilterProgrammatically,
  setRemoteConfigExperiments,
  setRemoteConfigUrl,
  syncRemoteConfig
} from "@eyeo/test-utils/extension";
import { snippetHitEventTestPageUrl } from "@eyeo/test-utils/host-urls";
import { initOptionsGeneralTab } from "../utils/page.js";

const SNIPPET_HIT_EVENT_COUNT_KEY = "snippets:snippet_hit_event";
const JSON_PRUNE_FILTER = "localhost#$#json-prune snippet-hit-test-property";

export default () => {
  before(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await setRemoteConfigExperiments(getOptionsHandle, [
      {
        experimentId: "snippet-hit-event",
        variants: [
          {
            variantId: "enabled",
            mods: [0, 1000],
            flags: { "snippet-hit-event": true }
          }
        ]
      }
    ]);
    await setRemoteConfigUrl(initOptionsGeneralTab);
    await syncRemoteConfig(initOptionsGeneralTab);
  });

  after(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await setRemoteConfigExperiments(getOptionsHandle, []);
    await syncRemoteConfig(initOptionsGeneralTab);
  });

  it("main-world snippet fires snippet_hit_event through the bridge", async function () {
    await addFiltersProgrammatically(getOptionsHandle, JSON_PRUNE_FILTER);
    try {
      await driver.switchTo().window(getOptionsHandle());
      const before = await getPendingLoggerCdpEventStats();
      const baselineCount = before?.counts?.[SNIPPET_HIT_EVENT_COUNT_KEY] ?? 0;

      await openNewTab(snippetHitEventTestPageUrl);

      await driver.switchTo().window(getOptionsHandle());
      const { counts } = await driver.wait(async () => {
        const result = await getPendingLoggerCdpEventStats();
        return result?.counts?.[SNIPPET_HIT_EVENT_COUNT_KEY] > baselineCount
          ? result
          : null;
      }, 5000);
      expect(counts[SNIPPET_HIT_EVENT_COUNT_KEY]).toBe(baselineCount + 1);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, JSON_PRUNE_FILTER);
    }
  });
};
