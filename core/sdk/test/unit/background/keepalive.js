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
import sinon from "sinon/pkg/sinon.js";
import {MILLIS_IN_SECOND, MILLIS_IN_MINUTE} from "#adblockpluscore/lib/time.js";

const PING_INTERVAL_MILLIS = 20 * MILLIS_IN_SECOND;
const MAX_LIFETIME_MILLIS = 10 * MILLIS_IN_MINUTE;

describe("keepalive", function() {
  let clock;
  let keepAlive;
  let withKeepAlive;

  async function loadModule() {
    let api = await mock("keepalive.js");
    ({keepAlive, withKeepAlive} = api);
  }

  function setMV3(isMV3) {
    env.browser.runtime.manifest.manifest_version = isMV3 ? 3 : 2;
  }

  beforeEach(async function() {
    env.configure();
    await loadModule();
    clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    clock.restore();
  });

  describe("on MV2", function() {
    beforeEach(function() {
      setMV3(false);
    });

    it("never pings the browser, even across a long operation", async function() {
      let pingSpy = sinon.spy(env.browser.storage.local, "get");
      let stop = keepAlive();

      await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
      stop();

      expect(pingSpy.callCount).toBe(0);
    });
  });

  describe("on MV3", function() {
    beforeEach(function() {
      setMV3(true);
    });

    it("pings immediately when a new operation starts, rather than " +
      "waiting for the first interval tick", async function() {
        let pingSpy = sinon.spy(env.browser.storage.local, "get");
        let stop = keepAlive();

        expect(pingSpy.callCount).toBe(1);
        stop();
      });

    it("does not ping again immediately for an overlapping operation " +
      "that joins one already running", async function() {
        let pingSpy = sinon.spy(env.browser.storage.local, "get");
        let stopFirst = keepAlive();
        expect(pingSpy.callCount).toBe(1);

        let stopSecond = keepAlive();
        expect(pingSpy.callCount).toBe(1);

        stopFirst();
        stopSecond();
      });

    it("pings the browser periodically while the operation is running", async function() {
      let pingSpy = sinon.spy(env.browser.storage.local, "get");
      let stop = keepAlive();

      await clock.tickAsync(PING_INTERVAL_MILLIS * 3);

      // 1 immediate ping on start, plus 3 interval ticks.
      expect(pingSpy.callCount).toBe(4);
      stop();
    });

    it("stops pinging once stopped", async function() {
      let pingSpy = sinon.spy(env.browser.storage.local, "get");
      let stop = keepAlive();

      await clock.tickAsync(PING_INTERVAL_MILLIS);
      // 1 immediate ping on start, plus 1 interval tick.
      expect(pingSpy.callCount).toBe(2);

      stop();
      await clock.tickAsync(PING_INTERVAL_MILLIS * 5);

      expect(pingSpy.callCount).toBe(2);
    });

    it("tolerates stop() being called more than once", async function() {
      let stop = keepAlive();
      stop();
      expect(() => stop()).not.toThrow();
    });

    it("calls onStopped when the caller stops it itself", function() {
      let onStopped = sinon.spy();
      let stop = keepAlive(onStopped);

      expect(onStopped.callCount).toBe(0);
      stop();
      expect(onStopped.callCount).toBe(1);
    });

    it("does not call onStopped more than once, even if stop() is called " +
      "more than once", function() {
        let onStopped = sinon.spy();
        let stop = keepAlive(onStopped);

        stop();
        stop();
        expect(onStopped.callCount).toBe(1);
      });

    it("stops pinging on its own if stop() is never called, after the " +
      "safety-net lifetime elapses", async function() {
        let pingSpy = sinon.spy(env.browser.storage.local, "get");
        keepAlive();

        await clock.tickAsync(MAX_LIFETIME_MILLIS);
        let countAtSafetyNet = pingSpy.callCount;
        expect(countAtSafetyNet).toBeGreaterThan(0);

        await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
        expect(pingSpy.callCount).toBe(countAtSafetyNet);
      });

    it("calls onStopped when the safety-net lifetime elapses, even though " +
      "the caller never called stop() itself", async function() {
        let onStopped = sinon.spy();
        keepAlive(onStopped);

        expect(onStopped.callCount).toBe(0);
        await clock.tickAsync(MAX_LIFETIME_MILLIS);
        expect(onStopped.callCount).toBe(1);
      });

    it("keeps pinging until every overlapping operation has stopped", async function() {
      let pingSpy = sinon.spy(env.browser.storage.local, "get");
      let stopFirst = keepAlive();
      let stopSecond = keepAlive();

      stopFirst();
      await clock.tickAsync(PING_INTERVAL_MILLIS);
      // 1 immediate ping when the first operation started, plus 1 interval
      // tick - the still-running second operation keeps the interval going.
      expect(pingSpy.callCount).toBe(2);

      stopSecond();
      await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
      expect(pingSpy.callCount).toBe(2);
    });

    it("resumes pinging for a later operation after an earlier one stopped",
      async function() {
        // Started and immediately stopped, so it shouldn't affect the
        // later, independent operation's own ping count below.
        keepAlive()();

        let pingSpy = sinon.spy(env.browser.storage.local, "get");
        let stop = keepAlive();
        await clock.tickAsync(PING_INTERVAL_MILLIS);
        stop();

        // 1 immediate ping when this operation started, plus 1 interval tick.
        expect(pingSpy.callCount).toBe(2);
      });

    describe("withKeepAlive()", function() {
      it("resolves with the wrapped function's return value", async function() {
        await expect(withKeepAlive(async () => "result"))
          .resolves.toBe("result");
      });

      it("rejects with the wrapped function's error", async function() {
        await expect(withKeepAlive(async () => {
          throw new Error("boom");
        })).rejects.toThrow("boom");
      });

      it("stops pinging once the wrapped function settles, even on rejection",
        async function() {
          let pingSpy = sinon.spy(env.browser.storage.local, "get");

          await withKeepAlive(async () => {
            await clock.tickAsync(PING_INTERVAL_MILLIS);
          }).catch(() => {});

          // 1 immediate ping on start, plus 1 interval tick.
          expect(pingSpy.callCount).toBe(2);

          await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
          expect(pingSpy.callCount).toBe(2);
        });
    });
  });
});
