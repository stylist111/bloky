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

import {SITEKEY} from "../test-server-urls.js";

describe("Frame state", function() {
  let api;

  beforeEach(async function() {
    env.configure();
    env.browser.runtime = {
      id: 1,
      getManifest() {
        return {
          name: "manifest v2",
          version: 2.0
        };
      }
    };

    // don't mock the core as we need encryption functions working
    api = await mock("frame-state.js", ["adblockpluscore", "./sitekey.js"], ["debugging.js"]);
  });

  afterEach(function() {
    env.browser.runtime = void 0;
  });

  let tabId = 1;
  let frameId = 2;

  it("records the frame information from onSitekeyReceived event", async function() {
    api.onSitekeyReceived(
      tabId,
      frameId,
      "http://url1.com",
      SITEKEY
    );
    let frame = api.getFrameInfo(tabId, frameId);
    expect(frame).toBeDefined();
    expect(frame.sitekey).toEqual(SITEKEY);
  });
});
