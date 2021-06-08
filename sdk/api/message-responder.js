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

import browser from "webextension-polyfill";

import {applyContentFilters, injectCSS} from "./content-filter.js";
import {createStyleSheet} from "adblockpluscore/lib/elemHide.js";
import {subscribeLinkClicked, subscribeLinksEnabled}
  from "./subscribe-links.js";
import {logHiddenElements} from "./diagnostics.js";

function onMessage(message, sender)
{
  if (typeof message != "object" || message == null)
    return;

  switch (message.type)
  {
    case "abp:content-hello":
      let filterData = applyContentFilters(sender.tab.id, sender.frameId);
      return Promise.resolve({
        ...filterData,
        subscribeLinks: subscribeLinksEnabled(sender.url)
      });
    case "abp:subscribe-link-clicked":
      subscribeLinkClicked(message.url, message.title);
      break;
    case "abp:trace-elem-hide":
      logHiddenElements(message.selectors, message.filters, sender);
      break;
    case "abp:inject-css":
      let styleSheet = createStyleSheet([message.selector]);
      injectCSS(sender.tab.id, sender.frameId, styleSheet);
      break;
  }
}

export function start()
{
  browser.runtime.onMessage.addListener(onMessage);
}

export function stop()
{
  browser.runtime.onMessage.removeListener(onMessage);
}
