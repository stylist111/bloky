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

import {wait, isEdge, isOldestFirefox} from "./utils.js";

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
    let background = await browser.runtime.getBackgroundPage();

    if (start)
    {
      EWE.filters.add(VALID_FILTER_TEXT);

      await wait(async() =>
      {
        let contents = [];
        try
        {
          contents = await EWE.debugging.getFilterStorageSource();
        }
        catch (e) {} // Error: File does not exist
        return contents.some(line => line.includes(VALID_FILTER_TEXT));
      }, 2000, "The added filter didn't reach storage");

      localStorage.setItem("reload-test-running", "true");

      if (isOldestFirefox() || isEdge()) // let storage consolidate on CI
        await new Promise(r => setTimeout(r, 2000));

      background.chrome.runtime.reload();
      return;
    }

    try
    {
      expect(EWE.filters.getAll()).toEqual(
        expect.arrayContaining([VALID_FILTER])
      );
    }
    finally
    {
      localStorage.removeItem("reload-test-running");
      EWE.filters.remove(VALID_FILTER_TEXT);
    }
  });
});
