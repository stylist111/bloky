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

import {Page, wait, setMinTimeout} from "./utils.js";
import {addFakeListener} from "./messaging.js";
import {isConnected, click, isFuzzingServiceWorker}
  from "./mocha/mocha-runner.js";

describe("Subscribe links (runner only)", function() {
  setMinTimeout(this, 5000);

  before(function() {
    // https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/325
    if (isFuzzingServiceWorker())
      this.skip();
  });

  before(async function() {
    if (!await isConnected())
      this.skip();
  });

  async function checkSubscribeLink(selector) {
    let fake = await addFakeListener({namespace: "reporting",
                                      eventName: "onSubscribeLinkClicked"});
    let page = new Page("subscribe.html");
    await page.loaded;

    await click(page.url, selector);
    try {
      await wait(() => fake.called, 2000);
    }
    catch (e) {
      // driver.executeScript in test/runner.js might throw which
      // prevents this click from happening. Retrying usually helps.
      await click(page.url, selector);
      await wait(() => fake.called, 2000, "Listener was not called");
    }

    expect(fake.callCount).toBe(1);
    expect(fake.firstArg).toEqual({url: "https://example.org/",
                                   title: "Sample Filter List"});
  }

  it("subscribes to a link", async function() {
    await checkSubscribeLink("#subscribe");
  });

  it("subscribes to a legacy link", async function() {
    await checkSubscribeLink("#subscribe-legacy");
  });
});
