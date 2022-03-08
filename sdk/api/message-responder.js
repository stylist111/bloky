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

import browser from "webextension-polyfill";

import {default as initializer} from "./initializer.js";
import {applyContentFilters, injectCSS} from "./content-filter.js";
import {createStyleSheet} from "adblockpluscore/lib/elemHide.js";
import {subscribeLinkClicked, subscribeLinksEnabled}
  from "./subscribe-links.js";
import {logHiddenElements} from "./diagnostics.js";

async function handleMessage(message, sender) {
  await initializer.start();
  switch (message.type) {
    case "ewe:content-hello":
      let filterData = applyContentFilters(sender.tab.id, sender.frameId);
      return {
        ...filterData,
        subscribeLinks: subscribeLinksEnabled(sender.url)
      };
    case "ewe:subscribe-link-clicked":
      subscribeLinkClicked(message.url, message.title);
      break;
    case "ewe:trace-elem-hide":
      logHiddenElements(message.selectors, message.filters, sender);
      break;
    case "ewe:inject-css":
      let styleSheet = createStyleSheet([message.selector]);
      injectCSS(sender.tab.id, sender.frameId, styleSheet);
      break;
  }
}

function onMessage(message, sender) {
  if (typeof message == "object" && message != null &&
      message.type && message.type.startsWith("ewe:"))
    return handleMessage(message, sender);
  return false;
}

export function start() {
  browser.runtime.onMessage.addListener(onMessage);
}

export function stop() {
  browser.runtime.onMessage.removeListener(onMessage);
}
