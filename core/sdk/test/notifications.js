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

import {TEST_PAGES_URL} from "./test-server-urls.js";
import {setMinTimeout} from "./utils.js";
import {wait} from "./polling.js";
import {EWE, runInBackgroundPage, expectTestEvents} from "./messaging.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

describe("Notifications", function() {
  if (isFuzzingServiceWorker()) {
    setMinTimeout(this, 100000);
  }

  afterEach(async function() {
    await EWE.testing._clearNotifications();
  });

  // The test must be the first in this `describe`
  // to avoid `_clearNotifications()` being called before
  it("updates the ignored categories for the first time", async function() {
    // default value
    expect(await EWE.notifications.getIgnoredCategories()).toEqual([]);
    await EWE.notifications.toggleIgnoreCategory("*");

    expect(await EWE.notifications.getIgnoredCategories()).toEqual(["*"]);
  });

  it("supports showing local notifications [fuzz]", async function() {
    let notification = {id: "local-test"};
    await EWE.notifications.addNotification(notification);
    await EWE.notifications.showNext();

    await expectTestEvents("notifications.addShowListener", [[notification]]);
  });

  it("supports showing immediate notifications [fuzz]", async function() {
    let notification = {id: "immediate-test"};
    await EWE.notifications.showNotification(notification);

    await expectTestEvents("notifications.addShowListener", [[notification]]);
  });

  it("supports showing remote notifications [fuzz]", async function() {
    setMinTimeout(this, 8000);
    let notification = {id: "remote-test"};
    await EWE.testing._setPrefs("notificationurl", `${TEST_PAGES_URL}/notification.json`);

    expect(await EWE.notifications.getDownloadCount()).toBe(0);

    await EWE.notifications.start();

    // The download will try to start after a 1s delay. If the
    // system is busy, this might be a few seconds more.
    let maxFetchTimeout = 6000;
    await wait(async() => {
      // Don't fuzz the service worker here, or you'll kill the in
      // progress notifications download.
      let downloadCount = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "notifications"},
        {op: "callMethod", arg: "getDownloadCount"},
        {op: "await"}
      ], false);
      return downloadCount > 0;
    }, maxFetchTimeout, "Notifications were not downloaded");

    await EWE.notifications.showNext();
    await expectTestEvents("notifications.addShowListener", [[notification]]);
    expect(await EWE.notifications.getDownloadCount()).toBe(1);
  });

  it("returns the correct initial state for ignored categories", async function() {
    expect(await EWE.notifications.getIgnoredCategories()).toEqual([]);
    expect(await EWE.notifications.shouldIgnoreNotifications()).toBe(false);
  });

  it("returns the correct state for ignored categories when ignored [fuzz]", async function() {
    await EWE.notifications.toggleIgnoreCategory("*");

    expect(await EWE.notifications.getIgnoredCategories()).toEqual(["*"]);
    expect(await EWE.notifications.shouldIgnoreNotifications()).toBe(true);
  });

  it("returns the correct state for ignored categories after unignoring", async function() {
    if (isFuzzingServiceWorker()) {
      setMinTimeout(this, 300000);
    }

    await EWE.notifications.toggleIgnoreCategory("*");
    await EWE.notifications.toggleIgnoreCategory("*");

    expect(await EWE.notifications.getIgnoredCategories()).toEqual([]);
    expect(await EWE.notifications.shouldIgnoreNotifications()).toBe(false);
  });

  it("shows ignorable notifications when ignoring notifications toggled off", async function() {
    let notification = {id: "ignorable-to-show"};
    await EWE.notifications.showNotification(notification, {ignorable: true});
    await expectTestEvents("notifications.addShowListener", [[notification]]);
  });

  it("ignores ignorable notifications when ignoring notifications is toggled on", async function() {
    if (isFuzzingServiceWorker()) {
      setMinTimeout(this, 300000);
    }
    await EWE.notifications.toggleIgnoreCategory("*");

    let notification = {id: "ignorable-to-ignore"};
    await EWE.notifications.showNotification(notification, {ignorable: true});
    await expectTestEvents("notifications.addShowListener", []);
  });
});
