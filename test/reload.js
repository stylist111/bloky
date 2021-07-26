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
import browser from "webextension-polyfill";

import {wait} from "./utils.js";
import {addFilter, runInBackgroundPage} from "./messaging.js";

const VALID_FILTER_TEXT = "reload.test^$image";
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: false,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

describe(`Reload (${phase})`, function()
{
  this.timeout(5000);

  it("persists storage data", async() =>
  {
    if (start)
    {
      await addFilter(VALID_FILTER_TEXT);

      await wait(async() =>
      {
        return await runInBackgroundPage([
          {op: "getGlobal", arg: "EWE"},
          {op: "getProp", arg: "debugging"},
          {op: "pushArg", arg: VALID_FILTER_TEXT},
          {op: "callMethod", arg: "isInFilterStorage"},
          {op: "await"}
        ]);
      }, 2000, "The added filter didn't reach storage");

      await browser.storage.local.set({"reload-test-running": true});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    try
    {
      let filters = await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "filters"},
        {op: "callMethod", arg: "getUserFilters"}
      ]);
      expect(filters).toEqual(expect.arrayContaining([VALID_FILTER]));
    }
    finally
    {
      await browser.storage.local.remove("reload-test-running");
      await runInBackgroundPage([
        {op: "getGlobal", arg: "EWE"},
        {op: "getProp", arg: "filters"},
        {op: "pushArg", arg: VALID_FILTER_TEXT},
        {op: "callMethod", arg: "remove"}
      ]);
    }
  });
});
