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

import {Page, Popup} from "./utils.js";

describe("Diagnostics", () =>
{
  afterEach(() =>
  {
    Page.removeCurrent();
    Popup.removeCurrent();
  });

  async function checkLogging(filter, callback)
  {
    let fake = sinon.fake();

    ABP.onFilterMatch.addListener(fake);
    ABP.filters.add(filter);

    try
    {
      await callback();
    }
    finally
    {
      ABP.onFilterMatch.removeListener(fake);
    }

    expect(fake.called).toBeTruthy();
    expect(fake.firstArg).toEqual({details: expect.any(Object), filter});
  }

  function checkRequestLogging(page, filter)
  {
    return checkLogging(filter, () => new Page(page).loaded());
  }

  it("logs blocking request filter", async() =>
  {
    await checkRequestLogging("image.html", "/image.png^$image");
  });

  it("logs allowlisting request filter", async() =>
  {
    ABP.filters.add("/image.png^$image");
    await checkRequestLogging("image.html", "@@$image");
  });

  it("logs blocking $header filter", async() =>
  {
    await checkRequestLogging("header.html", "*$header=x-header=whatever");
  });

  it("logs allowlisting $header filter", async() =>
  {
    ABP.filters.add("*$header=x-header=whatever");
    await checkRequestLogging("header.html", "@@$header");
  });

  it("logs blocking $csp filter", async() =>
  {
    await checkRequestLogging("csp.html", "*$csp=img-src 'none'");
  });

  it("logs allowlisting $csp filter", async() =>
  {
    ABP.filters.add("*$csp=img-src 'none'");
    await checkRequestLogging("csp.html", "@@$csp");
  });

  for (let option of ["$document", "$elemhide",
                      "$genericblock", "$generichide"])
  {
    it(`logs allowlisting ${option} filter`, () =>
      checkRequestLogging("image.html", `@@${option}`)
    );
  }

  function checkPopupLogging(filter)
  {
    return checkLogging(filter, () =>
      new Popup("link", new Page("popup-opener.html")).blocked
    );
  }

  it("logs blocking popup filter", async() =>
  {
    await checkPopupLogging("*popup.html^$popup");
  });

  it("logs allowlisting popup filter", async() =>
  {
    ABP.filters.add("*popup.html^$popup");
    await checkPopupLogging("@@$popup");
  });
});
