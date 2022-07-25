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

import browser from "webextension-polyfill";
import expect from "expect";

import {isMV3, setMinTimeout} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";

if (isMV3()) {
  describe("MV3 Service Workers", function() {
    // https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/307
    after(async function() {
      setMinTimeout(this, 6000);
      // From our observations, after a service worker is suspended it starts
      // up again when a message is sent to it. However, that restart seems to
      // cause lag spikes a few seconds after the service worker restarts.
      // Sleeping is a workaround to ensure the API is fully responsive on
      // subsequent tests.
      await new Promise(r => setTimeout(r, 5000));
    });

    it("state is cleared when service worker is suspended", async function() {
      let testData = "This is some test data";
      await browser.runtime.sendMessage({type: "ewe-test:setInMemoryState", data: testData});
      expect(await browser.runtime.sendMessage({type: "ewe-test:getInMemoryState"}))
        .toEqual(testData);

      await suspendServiceWorker(this);

      expect(await browser.runtime.sendMessage({type: "ewe-test:getInMemoryState"}))
        .toEqual(null);
    });
  });
}
