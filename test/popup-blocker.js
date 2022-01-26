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

import {Page, Popup, setMinTimeout, isMV3, TEST_PAGES_URL, TEST_PAGES_DOMAIN,
        SITEKEY} from "./utils.js";
import {addFilter} from "./messaging.js";

describe("Pop-up blocking", function()
{
  before(function()
  {
    // https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/102
    if (isMV3())
      this.skip();
  });

  setMinTimeout(this, 3000);

  let opener;
  beforeEach(() => { opener = new Page("popup-opener.html"); });

  it("blocks a link-based popup", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup tab", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-tab", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup window", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-window", opener).blocked).toBeTruthy();
  });

  it("blocks a script-based popup with deferred navigation", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("script-deferred", opener).blocked).toBeTruthy();
  });

  it("blocks a link-based third-party popup", async() =>
  {
    await addFilter(`popup.html^$popup,domain=${TEST_PAGES_DOMAIN}`);
    expect(await new Popup("third-party-link", opener).blocked).toBeTruthy();
  });

  it("does not block a link-based third-party popup " +
     "if the domain is for the opener page", async() =>
  {
    await addFilter("popup.html^$popup,domain=127.0.0.1");
    expect(await new Popup("third-party-link", opener).blocked).toBeFalsy();
  });

  it("does not block an allowlisted popup", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    await addFilter(`@@|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeFalsy();
  });

  it("blocks a variety of popups from the same page", async() =>
  {
    await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
    expect(await new Popup("link", opener).blocked).toBeTruthy();
    expect(await new Popup("link", opener).blocked).toBeTruthy();
    expect(await new Popup("script-tab", opener).blocked).toBeTruthy();
    expect(await new Popup("script-window", opener).blocked).toBeTruthy();
    expect(await new Popup("script-deferred", opener).blocked).toBeTruthy();
  });

  describe("Sitekey allowlisting", () =>
  {
    before(function()
    {
      if (isMV3())
        this.skip();
    });

    it("does not block a popup", async() =>
    {
      await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
      await addFilter(`@@$popup,sitekey=${SITEKEY}`);
      let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
      expect(await popup.blocked).toBeFalsy();
    });

    it("does not block a popup opened by a document", async() =>
    {
      await addFilter(`|${TEST_PAGES_URL}/popup.html^$popup`);
      await addFilter(`@@$document,sitekey=${SITEKEY}`);
      let popup = new Popup("link", new Page("popup-opener.html?sitekey=1"));
      expect(await popup.blocked).toBeFalsy();
    });
  });
});
