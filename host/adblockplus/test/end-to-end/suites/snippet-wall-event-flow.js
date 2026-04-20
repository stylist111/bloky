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

const SNIPPET_EVENT_COUNT_KEY = "detection_snippets:snippet_detection_event";
const CSS_WALL_FILTER =
  "localhost#$#log-if-selector-exists #ad-wall test-ad-wall test-specifier";
const CSS_STYLE_WALL_FILTER =
  "localhost#$#log-if-computed-style-matches test-ad-wall test-specifier position fixed z-index 999999";
const SCRIPT_WALL_FILTER =
  "localhost#$#log-if-script-loads ad-wall-loader.js test-ad-wall test-specifier";
const IFRAME_WALL_FILTER =
  "localhost#$#log-if-iframe-loads localhost test-ad-wall test-specifier";
const RACE_WALL_FILTER =
  "localhost#$#race start; log-if-selector-exists #ad-wall test-ad-wall test-selector; log-if-computed-style-matches test-ad-wall test-css position fixed z-index 999999; log-if-script-loads ad-wall-loader.js test-ad-wall test-script; log-if-iframe-loads localhost test-ad-wall test-iframe; race end";

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

  async function assertSnippetDetectionEvent(pageUrl) {
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
    const baselineCount = before?.counts?.[SNIPPET_EVENT_COUNT_KEY] ?? 0;

    await openNewTab(pageUrl);

    // Switch back to the options page to access extension storage, then poll
    // until the snippet_detection_event count exceeds the baseline, confirming
    // the snippet fired env.sendDetectionEvent through the real pipeline.
    await driver.switchTo().window(getOptionsHandle());
    const { counts } = await driver.wait(async () => {
      const result = await getPendingLoggerCdpEventStats();
      return result?.counts?.[SNIPPET_EVENT_COUNT_KEY] > baselineCount
        ? result
        : null;
    }, 5000);
    expect(counts[SNIPPET_EVENT_COUNT_KEY]).toBe(baselineCount + 1);
  }

  it("snippet fires snippet_detection_event when CSS is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, CSS_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, CSS_WALL_FILTER);
    }
  });

  it("snippet fires snippet_detection_event when CSS style is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, CSS_STYLE_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl);
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
      await assertSnippetDetectionEvent(adWallTestPageUrl);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, SCRIPT_WALL_FILTER);
    }
  });

  it("snippet fires snippet_detection_event when iframe is detected", async function () {
    await addFiltersProgrammatically(getOptionsHandle, IFRAME_WALL_FILTER);
    try {
      await assertSnippetDetectionEvent(adWallTestPageUrl);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, IFRAME_WALL_FILTER);
    }
  });

  it("race filter fires snippet_detection_event exactly once when multiple snippets match", async function () {
    await addFiltersProgrammatically(getOptionsHandle, RACE_WALL_FILTER);
    try {
      await driver.switchTo().window(getOptionsHandle());
      const before = await getPendingLoggerCdpEventStats();
      const baselineCount = before?.counts?.[SNIPPET_EVENT_COUNT_KEY] ?? 0;

      await openNewTab(adWallTestPageUrl);

      await driver.switchTo().window(getOptionsHandle());
      // Wait for the first (and only) detection event from the race winner.
      await driver.wait(async () => {
        const result = await getPendingLoggerCdpEventStats();
        return result?.counts?.[SNIPPET_EVENT_COUNT_KEY] > baselineCount
          ? result
          : null;
      }, 5000);

      // Pause to allow any additional events from losing snippets
      // to arrive before asserting the final count.
      await driver.sleep(500);

      const final = await getPendingLoggerCdpEventStats();
      expect(final?.counts?.[SNIPPET_EVENT_COUNT_KEY]).toBe(baselineCount + 1);
    } finally {
      await removeFilterProgrammatically(getOptionsHandle, RACE_WALL_FILTER);
    }
  });
};
