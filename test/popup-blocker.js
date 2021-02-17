/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import {Page, Popup, TEST_PAGES_URL, SITEKEY} from "./utils.js";

describe("Pop-up blocking", () =>
{
  let opener;

  before(() => { opener = new Page("popup-opener.html"); });
  after(() => Page.removeCurrent());
  afterEach(() => Popup.removeCurrent());

  it("blocks a link-based popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-tab", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-window", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-deferred", opener).blocked).toBeTruthy();
  });

  it("does not block an allowlisted popup", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeFalsy();
  });

  it("does not block a popup allowlisted by sitekey", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@$popup,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });

  it("does not block a popup opened by " +
     "a document allowlisted by sitekey", async() =>
  {
    ABP.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    ABP.filters.add(`@@$document,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });
});
