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
import * as runner from "./mocha/mocha-runner.js";

describe("Subscribe links (runner only)", function()
{
  setMinTimeout(this, 3000);

  before(async() =>
  {
    if (!await runner.isConnected())
      this.skip();
  });

  afterEach(() =>
  {
    Page.removeCurrent();
  });

  async function checkSubscribeLink(selector)
  {
    let fake = await addFakeListener("onSubscribeLinkClicked");
    let page = new Page("subscribe.html");
    await page.loaded();

    runner.click(page.url, selector);
    await wait(() => fake.called, 2000, "Listener was not called");

    expect(fake.callCount).toBe(1);
    expect(fake.firstArg).toEqual({url: "https://example.org/",
                                   title: "Sample Filter List"});
  }

  it("subscribes to a link", () =>
    checkSubscribeLink("#subscribe")
  );

  it("subscribes to a legacy link", () =>
    checkSubscribeLink("#subscribe-legacy")
  );
});
