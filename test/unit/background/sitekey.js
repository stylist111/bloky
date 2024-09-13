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

import {TEST_PAGES_URL, SITEKEY} from "../../test-server-urls.js";

describe("Sitekeys", function() {
  let api;

  beforeEach(async function() {
    env.configure();
    // don't mock the core as we need encryption functions working
    api = await mock("sitekey.js", ["adblockpluscore"], ["./debugging.js"]);
  });

  let tabId = 1;
  let frameId = 2;
  let url = `${TEST_PAGES_URL}/element-hiding.html?sitekey=1`;
  let signature = "_gkDVYgtlLxUnfW0Jcq9t1MrUgZ4XhDTOmnkb+IptGQ7cEFM2XgqL2hy7PLTiCALWaRn+mHfV0C/L1NJE59VagA==";
  let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";
  let validSitekeyHeader = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBjGUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ==_gkDVYgtlLxUnfW0Jcq9t1MrUgZ4XhDTOmnkb+IptGQ7cEFM2XgqL2hy7PLTiCALWaRn+mHfV0C/L1NJE59VagA==";
  // corresponds to `url` and `userAgent` above
  // we might want to generate the sitekey instead of hardcoding

  async function configure() {
    // make it Manifest V3
    // env.browser.background = {service_worker: {}}

    // make it Manifest V2
    env.browser.background = null;

    // required for sitekey verification
    env.navigator.userAgent = userAgent;

    // ideally we need to fully reload "sitekey.js" instead of declaring
    // any "reset the state" functions in the tested module
    api.clearAllSitekeys(false);
    await api.start();

    let responseHeaders = [{
      name: "X-Adblock-Key",
      value: validSitekeyHeader
    }];
    return {tabId, frameId, url, responseHeaders};
  }

  it("saves valid sitekey from the headers", async function() {
    let event = await configure();
    env.browser.webRequest.onHeadersReceived._trigger(event);
    expect(api.getSitekey(tabId, frameId, url)).toEqual(SITEKEY);
  });

  it("does NOT save invalid sitekey from the headers", async function() {
    let event = await configure();
    event.url = "https://fakeDomain.com";
    env.browser.webRequest.onHeadersReceived._trigger(event);
    expect(api.getSitekey(tabId, frameId, url)).toBeFalsy();
  });

  it("notifies the listeners", async function() {
    let event = await configure();

    let called = false;
    let callbackArg = {};
    let callback = (_tabId, _frameId, _url, _sitekey) => {
      called = true;
      callbackArg = {
        tabId: _tabId,
        frameId: _frameId,
        url: _url,
        sitekey: _sitekey
      };
    };

    api.addListener(callback);
    env.browser.webRequest.onHeadersReceived._trigger(event);
    expect(called).toEqual(true);
    expect(callbackArg).toEqual({tabId, frameId, url, sitekey: SITEKEY});
  });

  it("saves and loads the sitekeys", async function() {
    api._setSitekey(tabId, frameId, url, SITEKEY, signature);
    api._doSaveSitekeys();
    await api._awaitSavingComplete();
    api.clearAllSitekeys(false);
    await api._loadSitekeys(false);
    expect(api.getSitekey(tabId, frameId, url)).toEqual(SITEKEY);
  });
});

