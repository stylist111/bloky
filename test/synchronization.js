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

import {wait, TEST_ADMIN_PAGES_URL, TEST_MV3_SUBSCRIPTION_3} from "./utils.js";
import {EWE, addFilter} from "./messaging.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";

describe("Synchronization", function() {
  this.timeout(30000);
  const METHOD_HEAD = "HEAD";

  async function configure(properties = {}) {
    await EWE.testing._setSubscriptions([TEST_MV3_SUBSCRIPTION_3]);

    await fetch(`${TEST_ADMIN_PAGES_URL}/clear`);
    let reply = "%5BAdblock%20Plus%5D%0A%21%20Expires%3A%201%20d"; // "! Expires: 1 d"
    await fetch(`${TEST_ADMIN_PAGES_URL}/configure?reply=${reply}`);

    await EWE.testing._removeAllSubscriptions();
    await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION_3.url, properties);

    let downloadables = await EWE.subscriptions.getDownloadable();
    expect(downloadables.length).toEqual(1);
    expect(downloadables).toEqual([expect.objectContaining({
      downloadable: false // Countable Sub
    })]);
  }

  async function requestsSent() {
    await wait(async() => {
      let response = await fetch(`${TEST_ADMIN_PAGES_URL}/list`);
      let requests = await response.json();
      return requests.length > 0;
    }, 20000, "No requests sent", 100);
  }

  it("sends HEAD requests for expired subscriptions after service worker restarts [mv3-only] [fuzz-skip]", async function() {
    await configure();
    await requestsSent();
    await fetch(`${TEST_ADMIN_PAGES_URL}/clear`);

    let now = Date.now();
    let softExpiration = now / 1000; // seconds, not millis
    await EWE.testing._setSubscriptionProperties(
      TEST_MV3_SUBSCRIPTION_3.url, {
        softExpiration, expires: softExpiration,
        lastDownload: 1
      });

    await suspendServiceWorker(this);
    await addFilter("someFilterToAwakeTheSW");

    await requestsSent();

    let response = await fetch(`${TEST_ADMIN_PAGES_URL}/list`);
    let requests = await response.json();

    expect(requests.length).toEqual(1);
    expect(requests).toEqual([expect.objectContaining({
      method: METHOD_HEAD
    })]);
  });
});
