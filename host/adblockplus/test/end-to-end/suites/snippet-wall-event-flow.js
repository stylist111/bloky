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
 * @file E2E tests for the snippet → sendDetectionEvent → telemetry pipeline.
 *
 * Flow: snippet detects a condition on the test page → calls
 * env.sendDetectionEvent(type, domain, specifier) → logger.behavior()
 * → trackBehaviourEvent() → ewe:telemetry-behaviour-counts in storage.
 *
 * Each test adds a detection filter before opening the page so the snippet
 * fires for real through the full pipeline.
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
import { adWallTestPageUrl } from "@eyeo/test-utils/host-urls";
import { initOptionsGeneralTab } from "../utils/page.js";

const CSS_WALL_TYPE = "wall-test-css";
const CSS_STYLE_WALL_TYPE = "wall-test-style";
const SCRIPT_WALL_TYPE = "wall-test-script";
const IFRAME_WALL_TYPE = "wall-test-iframe";
const RACE_WALL_TYPE = "wall-test-race";
const DEDUP_WALL_TYPE = "wall-test-dedup";
const CSS_WALL_FILTER = `localhost#$#log-if-selector-exists #ad-wall ${CSS_WALL_TYPE} test-specifier`;
const CSS_STYLE_WALL_FILTER = `localhost#$#log-if-computed-style-matches ${CSS_STYLE_WALL_TYPE} test-specifier position fixed z-index 999999`;
const SCRIPT_WALL_FILTER = `localhost#$#log-if-script-loads ad-wall-loader.js ${SCRIPT_WALL_TYPE} test-specifier`;
const IFRAME_WALL_FILTER = `localhost#$#log-if-iframe-loads localhost ${IFRAME_WALL_TYPE} test-specifier`;
const RACE_WALL_FILTER = `localhost#$#race start; log-if-selector-exists #ad-wall ${RACE_WALL_TYPE} test-selector; log-if-computed-style-matches ${RACE_WALL_TYPE} test-css position fixed z-index 999999; log-if-script-loads ad-wall-loader.js ${RACE_WALL_TYPE} test-script; log-if-iframe-loads localhost ${RACE_WALL_TYPE} test-iframe; race end`;

export default () => {
  before(async function () {
    await initOptionsGeneralTab(getOptionsHandle());
    await setRemoteConfigExperiments(getOptionsHandle, [
      {
        experimentId: "snippet-detection-event",
        variants: [
          {
            variantId: "enabled",
            mods: [0, 1000],
            flags: { "snippet-detection-event": true }
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

  function countKeyForType(type) {
    return `detection_snippets:snippet_detection_event:${type}:localhost`;
  }

  async function assertSnippetDetectionEvent(pageUrl, wallType) {
    const countKey = countKeyForType(wallType);

    // Snapshot before opening the page — the snippet fires on page load so
    // the baseline must be captured first.
    //
    // We cannot simply reset counts between tests because PersistentState
    // (used by trackBehaviourEvent) loads from storage once and caches state
    // in memory for the lifetime of the service worker — writing to storage
    // from outside has no effect on the cached value. Snapshotting lets each
    // test assert a delta of +1 regardless of what prior tests accumulated.
    await driver.switchTo().window(getOptionsHandle());
    const before = await getPendingLoggerCdpEventStats();
    const baselineCount = before?.counts?.[countKey] ?? 0;

    await openNewTab(pageUrl);

    // Switch back to the options page to access extension storage, then poll
    // until the snippet_detection_event count exceeds the baseline, confirming
    // the snippet fired env.sendDetectionEvent through the real pipeline.
    await driver.switchTo().window(getOptionsHandle());
    const { counts } = await driver.wait(async () => {
      const result = await getPendingLoggerCdpEventStats();
      return result?.counts?.[countKey] > baselineCount ? result : null;
    }, 5000);
    expect(counts[countKey]).toBe(baselineCount + 1);
    // ds path (wall detection per-domain counts) is verified by
    // integration tests in core/sdk/test/cdp.js which have direct
    // access to EWE.testing and can call setOptOut properly.
  }

  it("snippet fires snippet_detection_event when CSS is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, CSS_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl, CSS_WALL_TYPE);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, CSS_WALL_FILTER);
    }
  });

  it("snippet fires snippet_detection_event when CSS style is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, CSS_STYLE_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl, CSS_STYLE_WALL_TYPE);
    } finally {
      await removeFilterProgrammatically(
        getOptionsHandle,
        CSS_STYLE_WALL_FILTER
      );
    }
  });

  it("snippet fires snippet_detection_event when script is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, SCRIPT_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl, SCRIPT_WALL_TYPE);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, SCRIPT_WALL_FILTER);
    }
  });

  it("snippet fires snippet_detection_event when iframe is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, IFRAME_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl, IFRAME_WALL_TYPE);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, IFRAME_WALL_FILTER);
    }
  });

  it("de-duplicates same detection type on repeated page loads", async function () {
    const dedupCountKey = countKeyForType(DEDUP_WALL_TYPE);
    const dedupFilter = `localhost#$#log-if-selector-exists #ad-wall ${DEDUP_WALL_TYPE} test-specifier`;
    await addFiltersProgrammatically(getOptionsHandle, dedupFilter);
    try {
      // First page load — event should pass through.
      await driver.switchTo().window(getOptionsHandle());
      const before = await getPendingLoggerCdpEventStats();
      const baselineCount = before?.counts?.[dedupCountKey] ?? 0;

      await openNewTab(adWallTestPageUrl);

      await driver.switchTo().window(getOptionsHandle());
      await driver.wait(async () => {
        const result = await getPendingLoggerCdpEventStats();
        return result?.counts?.[dedupCountKey] > baselineCount ? result : null;
      }, 5000);

      // Second page load — same (type, domain) within 5 minutes, should
      // be de-duplicated. Counter must NOT increment.
      await openNewTab(adWallTestPageUrl);

      // Pause to allow the (de-duplicated) event to arrive if it
      // were going to — matches the race test's negative-assertion pattern.
      await driver.switchTo().window(getOptionsHandle());
      await driver.sleep(500);

      const after = await getPendingLoggerCdpEventStats();
      expect(after?.counts?.[dedupCountKey]).toBe(baselineCount + 1);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, dedupFilter);
    }
  });

  it("race filter fires snippet_detection_event exactly once when multiple snippets match", async function () {
    const raceCountKey = countKeyForType(RACE_WALL_TYPE);
    await addFiltersProgrammatically(getOptionsHandle, RACE_WALL_FILTER);
    try {
      await driver.switchTo().window(getOptionsHandle());
      const before = await getPendingLoggerCdpEventStats();
      const baselineCount = before?.counts?.[raceCountKey] ?? 0;

      await openNewTab(adWallTestPageUrl);

      await driver.switchTo().window(getOptionsHandle());
      // Wait for the first (and only) detection event from the race winner.
      await driver.wait(async () => {
        const result = await getPendingLoggerCdpEventStats();
        return result?.counts?.[raceCountKey] > baselineCount ? result : null;
      }, 5000);

      // Pause to allow any additional events from losing snippets
      // to arrive before asserting the final count.
      await driver.sleep(500);

      const final = await getPendingLoggerCdpEventStats();
      expect(final?.counts?.[raceCountKey]).toBe(baselineCount + 1);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, RACE_WALL_FILTER);
    }
  });
};
