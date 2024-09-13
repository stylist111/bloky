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

import sinon from "sinon/pkg/sinon.js";
import expect from "expect";
import {Scheduler} from "../../../sdk/all/scheduler.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

describe("Scheduler", function() {
  let sandbox;

  beforeEach(function() {
    sandbox = sinon.createSandbox({
      useFakeTimers: true
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  async function startTheScheduler({
    interval = 12 * MILLIS_IN_HOUR,
    errorRetryDelay = MILLIS_IN_HOUR,
    listener = sandbox.stub().returns(true),
    getNextTimestamp = sandbox.stub().resolves(null)
  }, asyncTickTheClock = true) {
    let scheduler = new Scheduler({
      interval,
      errorRetryDelay,
      listener,
      getNextTimestamp
    });

    if (asyncTickTheClock) {
      await sandbox.clock.tickAsync(0);
    }

    return scheduler;
  }

  it("calls the listener immediately if there isn't a previous timestamp", async function() {
    let listener = sandbox.stub().returns(true);
    await startTheScheduler({listener});
    expect(listener.callCount).toBe(1);
  });

  it("call the listener immediately if it's already time", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(0);
    await startTheScheduler({listener, getNextTimestamp});
    expect(listener.callCount).toBe(1);
  });

  it("call the listener after a delay to make it time", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(1000);
    await startTheScheduler({listener, getNextTimestamp});
    expect(listener.callCount).toBe(0);
    await sandbox.clock.tickAsync(1000);
    expect(listener.callCount).toBe(1);
  });

  it("calls the listener after the interval after a valid ping", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(null);
    await startTheScheduler({listener, getNextTimestamp});
    expect(listener.callCount).toBe(1);

    getNextTimestamp.resolves(12 * MILLIS_IN_HOUR);
    await sandbox.clock.tickAsync(12 * MILLIS_IN_HOUR);
    expect(listener.callCount).toBe(2);
  });

  it("calls the listener after the error retry delay there's an error", async function() {
    let listener = sandbox.stub().returns(false);
    let getNextTimestamp = sandbox.stub().resolves(null);
    await startTheScheduler({listener, getNextTimestamp});
    expect(listener.callCount).toBe(1);

    getNextTimestamp.resolves(1 * MILLIS_IN_HOUR);
    await sandbox.clock.tickAsync(1 * MILLIS_IN_HOUR);
    expect(listener.callCount).toBe(2);
  });

  it("checks the next timestamp after an hour if the next ping is longer in the future", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(12 * MILLIS_IN_HOUR);
    await startTheScheduler({listener, getNextTimestamp});
    expect(getNextTimestamp.callCount).toBe(1);

    await sandbox.clock.tickAsync(1 * MILLIS_IN_HOUR);
    expect(listener.callCount).toBe(0);
    expect(getNextTimestamp.callCount).toBe(2);
  });

  it("does not fire any more events after being stopped", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(12 * MILLIS_IN_HOUR);
    let scheduler = await startTheScheduler({listener, getNextTimestamp});
    expect(getNextTimestamp.callCount).toBe(1);

    scheduler.stop();

    await sandbox.clock.tickAsync(1 * MILLIS_IN_HOUR);
    expect(getNextTimestamp.callCount).toBe(1);
  });

  it("does not throw if it is stopped when there isn't an active timeout", async function() {
    let listener = sandbox.stub().returns(true);
    let getNextTimestamp = sandbox.stub().resolves(12 * MILLIS_IN_HOUR);
    let scheduler = await startTheScheduler({listener, getNextTimestamp},
                                            false);
    expect(listener.callCount).toBe(0);

    scheduler.stop();

    await sandbox.clock.tickAsync(12 * MILLIS_IN_HOUR);
    expect(listener.callCount).toBe(0);
  });
});
