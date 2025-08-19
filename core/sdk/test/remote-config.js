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
import {
  clearEndpointResponse,
  clearRequestLogs,
  delayThenExpectNextPing,
  expectNextPing,
  getRequestLogIntervals,
  getRequestLogs, ISO_DATE_REGEX,
  setMinTimeout,
  waitForAssertion
} from "./utils.js";
import {EWE} from "./messaging.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {
  DEFAULT_CONFIG, ERROR_BACKOFF_MS, PING_INTERVAL_MS,
  REMOTE_CONFIG_URL,
  SCHEMA_ID,
  setConfig,
  startWithTestArgs,
  UPDATED_CONFIG
} from "./fixtures/remote-config.js";

describe("Remote config", function() {
  afterEach(async function() {
    await clearEndpointResponse(REMOTE_CONFIG_URL);
    await startWithTestArgs(true);
  });

  it("returns an empty state before first sync", async function() {
    await EWE.testing.resetRemoteConfig();

    expect(await EWE.remoteConfig.getRevisionId()).toBeNull();
    expect(await EWE.remoteConfig.getCountryCode()).toEqual("unknown");
    expect(await EWE.remoteConfig.getExperimentsConfig()).toEqual([]);
    expect(await EWE.remoteConfig.getCohortsConfig()).toEqual([]);
    expect(await EWE.remoteConfig.getIpmCommands()).toEqual(null);
    expect(await EWE.remoteConfig.getLoggingConfig()).toEqual({});
    expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
      errors: []
    });
  });

  it("returns revision ID", async function() {
    await setConfig({
      schemaId: SCHEMA_ID,
      experiments: []
    });
    await EWE.remoteConfig.sync();

    // Hash corresponding to {"schemaId":"1","experiments":[]}
    expect(await EWE.remoteConfig.getRevisionId()).toEqual("BpNHg1PA");
  });

  it("returns in-product messaging commands", async function() {
    await setConfig({
      schemaId: SCHEMA_ID,
      experiments: [],
      ipmCommands: []
    });
    await EWE.remoteConfig.sync();

    expect(await EWE.remoteConfig.getIpmCommands()).toEqual([]);
  });

  describe("Scheduled updates", function() {
    setMinTimeout(this, 10000);

    beforeEach(async function() {
      await EWE.testing.resetRemoteConfig();
      await clearRequestLogs();
    });

    it("updates remote config on schedule", async function() {
      await setConfig(DEFAULT_CONFIG);
      await startWithTestArgs(false);

      await expectNextPing({
        expectedNewPingCount: 1,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);
      });

      const initialSyncStatus = await EWE.remoteConfig.getSyncStatus();
      expect(initialSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig(UPDATED_CONFIG);
      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);
      });
      const updatedSyncStatus = await EWE.remoteConfig.getSyncStatus();
      expect(updatedSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      expect(updatedSyncStatus.lastDownloaded)
        .not.toBe(initialSyncStatus.lastDownloaded);

      expect(await getRequestLogIntervals(REMOTE_CONFIG_URL))
        .toEqual([PING_INTERVAL_MS]);
    });

    it("waits for the error retry delay if there is a network error", async function() {
      setMinTimeout(this, 15000);

      await setConfig(DEFAULT_CONFIG);
      await startWithTestArgs(false);

      await expectNextPing({
        expectedNewPingCount: 1,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);
      });
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig({}, 500);
      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);
      });
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        lastNetworkError: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await setConfig(UPDATED_CONFIG);
      await delayThenExpectNextPing({
        delay: ERROR_BACKOFF_MS,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);
      });
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await delayThenExpectNextPing({
        delay: PING_INTERVAL_MS,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);
      });

      expect(await getRequestLogIntervals(REMOTE_CONFIG_URL)).toEqual([
        PING_INTERVAL_MS,
        ERROR_BACKOFF_MS,
        PING_INTERVAL_MS
      ]);
    });

    it("pings using the error delay when the service worker is suspended after a server error [mv3-only]", async function() {
      await setConfig({}, 500);
      await startWithTestArgs(false);
      await expectNextPing({
        expectedNewPingCount: 1,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toBeUndefined();
      });

      await suspendServiceWorker(this);
      await startWithTestArgs(false);
      await delayThenExpectNextPing({
        delay: ERROR_BACKOFF_MS,
        url: REMOTE_CONFIG_URL
      });
      await waitForAssertion(async() => {
        expect(await EWE.remoteConfig.getConfig()).toBeUndefined();
      });

      // This one might take longer if the service worker startup is slow. But
      // it absolutely should not happen sooner than the backoff delay.
      expect((await getRequestLogIntervals(REMOTE_CONFIG_URL))[0])
        .toBeGreaterThanOrEqual(ERROR_BACKOFF_MS);
    });

    it("handles HTTP 304 server response", async function() {
      const etagInitial = "initial";
      const etagUpdated = "updated";

      // Initial request
      await setConfig(DEFAULT_CONFIG, 200, etagInitial);
      await EWE.remoteConfig.sync();

      expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);

      let initialSyncStatus = await EWE.remoteConfig.getSyncStatus();
      expect(initialSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      // Request with matching ETag
      await setConfig("", 304, etagInitial);

      // We want to check that our lastDownload timestamp is indeed updated when
      // we get a cached response, but the headers we use only have second
      // precision, so we need to wait a moment to make sure it's actually
      // expected to change.
      await new Promise(r => setTimeout(r, 1000));
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);

      let afterCacheSyncStatus = await EWE.remoteConfig.getSyncStatus();
      expect(afterCacheSyncStatus).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
      expect(afterCacheSyncStatus.lastDownloaded)
        .not.toBe(initialSyncStatus.lastDownloaded);

      // Request with different ETag
      await setConfig(UPDATED_CONFIG, 200, etagUpdated);
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);

      // Request with new matching ETag
      await setConfig("", 304, etagUpdated);
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);

      const logs = await getRequestLogs(REMOTE_CONFIG_URL);
      expect(logs.length).toBe(4);
      expect(logs[1].headers["if-none-match"]).toBe("initial");
      expect(logs[2].headers["if-none-match"]).toBe("initial");
      expect(logs[3].headers["if-none-match"]).toBe("updated");
    });

    it("cohorts update when HTTP 304 server response but facts changed", async function() {
      const etagInitial = "initial";

      // set initial cohorts config, will result in 0 cohorts
      // since the installDate is set to 2 days ago and requires >=7 days
      await EWE.testing.mockFacts({
        installDate: Date.now() - 2 * 24 * 60 * 60 * 1000 // 2 days ago
      });

      // Initial request
      await setConfig(DEFAULT_CONFIG, 200, etagInitial);
      await EWE.remoteConfig.sync();

      // expect cohorts to be empty, since installDate is too recent
      expect(await EWE.cohorts.getAll()).toEqual([]);

      // Request with matching ETag and mock facts updated to 10 days ago
      await setConfig("", 304, etagInitial);
      await EWE.testing.mockFacts({
        installDate: Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
      });
      await EWE.remoteConfig.sync();

      // expect cohorts to be updated based on the new facts
      expect(await EWE.cohorts.getAll()).toEqual(["my-first-cohort"]);
    });

    it("sync fails with error if no remote config URL is given", async function() {
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });

      await EWE.testing.restartRemoteConfig(
        void 0,
        PING_INTERVAL_MS,
        ERROR_BACKOFF_MS
      );
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        lastNetworkError: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
    });
  });

  describe("Data Validation", function() {
    const INVALID = {
      schemaId: SCHEMA_ID,
      experiments: "yo"
    };
    const EXPECTED_ERRORS = ["instance.experiments is not of a type(s) array"];

    it("keeps the old config active when there is a schema error", async function() {
      await setConfig(DEFAULT_CONFIG);
      await EWE.remoteConfig.sync();

      await setConfig(INVALID);
      await EWE.remoteConfig.sync();

      expect(await EWE.remoteConfig.getConfig()).toEqual(DEFAULT_CONFIG);
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: EXPECTED_ERRORS
      });
    });

    it("returns to a no-error state after problems in the config have been fixed", async function() {
      await setConfig(INVALID);
      await EWE.remoteConfig.sync();
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: EXPECTED_ERRORS
      });

      await setConfig(UPDATED_CONFIG);
      await EWE.remoteConfig.sync();

      expect(await EWE.remoteConfig.getConfig()).toEqual(UPDATED_CONFIG);
      expect(await EWE.remoteConfig.getSyncStatus()).toEqual({
        lastDownloaded: expect.stringMatching(ISO_DATE_REGEX),
        errors: []
      });
    });
  });
});
