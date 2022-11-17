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

import {Page, setMinTimeout, wait} from "./utils.js";
import {getTestEvents, clearTestEvents} from "./messaging.js";
import {isConnected, click, isFuzzingServiceWorker}
  from "./mocha/mocha-runner.js";

describe("Subscribe links (runner only)", function() {
  setMinTimeout(this, isFuzzingServiceWorker() ? 30000 : 5000);

  before(async function() {
    if (!await isConnected())
      this.skip();
  });

  let event = "reporting.onSubscribeLinkClicked";

  async function checkSubscribeLink(selector) {
    await clearTestEvents(event);

    let page = new Page("subscribe.html");
    await page.loaded;

    let delay = isFuzzingServiceWorker() ? 15000 : 2000;
    try {
      await click(page.url, selector);
      await wait(async() => (await getTestEvents(event)).length > 0, delay);
    }
    catch (e) {
      // driver.executeScript in test/runner.js might throw which
      // prevents this click from happening. Retrying usually helps.
      await click(page.url, selector);
      await wait(async() => (await getTestEvents(event)).length > 0, delay,
                 "Listener was not called");
    }

    expect(await getTestEvents(event))
      .toEqual([[expect.objectContaining({
        url: "https://example.org/",
        title: "Sample Filter List"
      })]]);
  }

  it("subscribes to a link", async function() {
    await checkSubscribeLink("#subscribe");
  });

  it("subscribes to a legacy link", async function() {
    await checkSubscribeLink("#subscribe-legacy");
  });
});
