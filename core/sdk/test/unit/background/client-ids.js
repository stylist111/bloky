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

// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

const STORAGE_KEY = "ewe:client_ids";

// Dates are relative to "now" (rather than hardcoded literals) so the
// 30-day retention filter - which does compare against the real
// wall-clock time - doesn't age these fixtures out over time.
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function hoursAgo(hours) {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

describe("client-ids", function() {
  let api;

  async function loadModule() {
    api = await mock(
      "client-ids.js",
      null,
      ["./remote-config/storage.js"]
    );
  }

  beforeEach(async function() {
    env.configure();
    global.__clientId = null;
    global.__lastDownloaded = null;
    await loadModule();
  });

  afterEach(function() {
    delete global.__clientId;
    delete global.__lastDownloaded;
  });

  async function readPersistedState() {
    const result = await env.browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY];
  }

  describe("sync()", function() {
    it("does nothing when there is no client ID or last-downloaded time",
      async function() {
        await api.sync();
        expect(await readPersistedState()).toEqual({clientIds: []});
      });

    it("appends an entry when a client ID and sync timestamp are available",
      async function() {
        const date = daysAgo(0);
        global.__clientId = "AAA";
        global.__lastDownloaded = date;
        await api.sync();

        expect(await api.getClientIds()).toEqual([{date, clientId: "AAA"}]);
      });

    it("caps at 1 entry per hour", async function() {
      global.__clientId = "AAA";
      const downloadedAt = hoursAgo(0);
      for (let i = 0; i < 5; i++) {
        global.__lastDownloaded = downloadedAt;
        await api.sync();
      }

      expect((await api.getClientIds()).length).toBe(1);
    });

    it("does not add a duplicate entry when lastDownloaded stays stale " +
      "across syncs", async function() {
      // Regression test: the cap must bucket by lastDownloaded's own
      // hour, not the real wall-clock hour - otherwise a stale
      // lastDownloaded (e.g. downloads failing, or updateFacts()
      // re-evaluating without a new download) would never match an
      // already-recorded entry's bucket, and sync() would keep
      // re-adding the same stale entry forever.
      global.__clientId = "AAA";
      global.__lastDownloaded = hoursAgo(5);
      await api.sync();
      await api.sync();
      await api.sync();

      expect(await api.getClientIds()).toEqual([
        {date: global.__lastDownloaded, clientId: "AAA"}
      ]);
    });

    it("allows a new entry once the hour changes", async function() {
      global.__clientId = "AAA";
      global.__lastDownloaded = hoursAgo(1);
      await api.sync();

      global.__lastDownloaded = hoursAgo(0);
      await api.sync();

      expect((await api.getClientIds()).length).toBe(2);
    });

    it("drops entries older than 30 days", async function() {
      global.__clientId = "AAA";
      global.__lastDownloaded = daysAgo(40);
      await api.sync();
      expect((await api.getClientIds()).length).toBe(1);

      global.__clientId = "BBB";
      const recentDate = daysAgo(0);
      global.__lastDownloaded = recentDate;
      await api.sync();

      expect(await api.getClientIds()).toEqual([
        {date: recentDate, clientId: "BBB"}
      ]);
    });
  });

  describe("getClientIdStability()", function() {
    // Seed storage directly rather than driving history through
    // repeated sync() calls, since these tests care about the shape of
    // getClientIdStability()'s input, not sync()'s own capping/pruning
    // behavior (covered separately above).
    async function seed(clientIds) {
      await env.browser.storage.local.set({
        [STORAGE_KEY]: {clientIds}
      });
    }

    it("returns 0 when fewer than 20 entries exist", async function() {
      await seed([{date: daysAgo(0), clientId: "AAA"}]);
      expect(await api.getClientIdStability()).toBe(0);
    });

    it("returns 0 when history spans fewer than 3 days", async function() {
      const clientIds = [];
      for (let i = 0; i < 25; i++) {
        clientIds.push({date: daysAgo(0), clientId: "AAA"});
      }
      await seed(clientIds);

      expect(await api.getClientIdStability()).toBe(0);
    });

    it("returns 100 when the same client ID appears in every entry",
      async function() {
        const clientIds = [];
        for (let day = 0; day < 7; day++) {
          for (let i = 0; i < 3; i++) {
            clientIds.push({date: daysAgo(day), clientId: "AAA"});
          }
        }
        await seed(clientIds);

        expect(await api.getClientIdStability()).toBe(100);
      });

    it("computes the percentage of the most common client ID",
      async function() {
        const clientIds = [];
        // 14 entries for "AAA", 7 entries for "BBB", spanning 7 days.
        for (let day = 0; day < 7; day++) {
          clientIds.push({date: daysAgo(day), clientId: "AAA"});
          clientIds.push({date: daysAgo(day), clientId: "AAA"});
          clientIds.push({date: daysAgo(day), clientId: "BBB"});
        }
        await seed(clientIds);

        // 14 out of 21 entries are "AAA".
        expect(await api.getClientIdStability()).toBeCloseTo(66.67, 1);
      });
  });

  describe("reset()", function() {
    it("clears the client ID history", async function() {
      global.__clientId = "AAA";
      global.__lastDownloaded = daysAgo(0);
      await api.sync();
      expect((await api.getClientIds()).length).toBe(1);

      await api.reset();
      expect(await api.getClientIds()).toEqual([]);
    });
  });
});
