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

import {Page} from "./utils.js";
import * as runner from "./mocha/mocha-runner.js";

describe("Subscribe links (runner only)", () =>
{
  let page;
  let callback;

  function onSubscribeLinkClicked(subscription)
  {
    callback(subscription);
  }

  before(async function()
  {
    if (!await runner.isConnected())
      this.skip();

    EWE.onSubscribeLinkClicked.addListener(onSubscribeLinkClicked);

    page = new Page("subscribe.html");
    await page.loaded();
  });

  after(() =>
  {
    EWE.onSubscribeLinkClicked.removeListener(onSubscribeLinkClicked);
    Page.removeCurrent();
  });

  async function checkSubscribeLink(selector)
  {
    runner.click(page.url, selector);
    let subscription = await new Promise(resolve => { callback = resolve; });
    expect(subscription).toEqual({url: "https://example.org/",
                                  title: "Sample Filter List"});
  }

  it("subscribes to a link", () =>
    checkSubscribeLink("#subscribe")
  );

  it("subscribes to a legacy link", () =>
    checkSubscribeLink("#subscribe-legacy")
  );
});
