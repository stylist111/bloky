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

/* eslint-env webextensions, browser */
/* global ABP */

"use strict";

function mockGetUILanguage(api)
{
  let {getUILanguage} = api.i18n;
  api.i18n.getUILanguage = () => self.uiLanguageOverride || getUILanguage();
}

mockGetUILanguage(chrome);
if (typeof browser != "undefined")
  mockGetUILanguage(browser);

ABP.start().then(async() =>
{
  if (typeof netscape != "undefined")
  {
    let version = /\brv:([^;)]+)/.exec(navigator.userAgent)[1];
    if (parseInt(version, 10) < 86)
      await new Promise(resolve => setTimeout(resolve, 2000));
  }

  chrome.tabs.create({url: "/test/index.html"});
  if (localStorage.getItem("reload-test-running"))
    chrome.tabs.create({url: "/test/reload.html"});
});
