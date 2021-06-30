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

import {Page, Popup, setMinTimeout, isFirefox, TEST_PAGES_URL, SITEKEY}
  from "./utils.js";

describe("Pop-up blocking", function()
{
  setMinTimeout(this, 3000);

  let opener;

  before(() => { opener = new Page("popup-opener.html"); });
  after(() => Page.removeCurrent());
  afterEach(() => Popup.removeCurrent());

  it("blocks a link-based popup", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    if (isFirefox())
    {
      Page.removeCurrent();
      opener = new Page("popup-opener.html");
    }
    expect(await new Popup("script-tab", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-window", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-deferred", opener).blocked).toBeTruthy();
  });

  it("does not block an allowlisted popup", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    EWE.filters.add(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    if (isFirefox())
    {
      Page.removeCurrent();
      opener = new Page("popup-opener.html");
    }
    expect(await new Popup("link", opener).blocked).toBeFalsy();
  });

  it("does not block a popup allowlisted by sitekey", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    EWE.filters.add(`@@$popup,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });

  it("does not block a popup opened by " +
     "a document allowlisted by sitekey", async() =>
  {
    EWE.filters.add(`|${TEST_PAGES_URL}/popup.html^$popup`);
    EWE.filters.add(`@@$document,sitekey=${SITEKEY}`);
    let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
    expect(await popup.blocked).toBeFalsy();
  });
});
