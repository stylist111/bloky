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

/* eslint-env webextensions, browser */
/* global EWE */

"use strict";

function mockGetUILanguage(api)
{
  let {getUILanguage} = api.i18n;
  api.i18n.getUILanguage = () => self.uiLanguageOverride || getUILanguage();
}

mockGetUILanguage(chrome);
if (typeof browser != "undefined")
  mockGetUILanguage(browser);

EWE.start().then(async() =>
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
