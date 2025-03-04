/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { start as exampleFragmentStart } from "@eyeo-fragments/example";

function init() {
  const mockAddonInfo = {
    bundledSubscriptions: [],
    bundledSubscriptionsPath: "./",
    telemetry: {
      url: "https://mock-telemetry-url.com",
      bearer: "mock-bearer-token",
    },
    cdp: {
      pingUrl: "https://mock-cdp-url.com",
      publicKeyUrl: "https://mock-cdp-public-key-url.com",
      bearer: "mock-cdp-bearer-token",
    },
  };
  ewe.start(mockAddonInfo);

  exampleFragmentStart();
}

browser.runtime.onInstalled.addListener(() => {
  browser.runtime.openOptionsPage();
});

init();

browser.runtime.onMessage.addListener(async (message) => {
  const { method, args = [] } = message;
  if (method.startsWith("ewe.")) {
    const [_, namespace, methodName] = method.split(".");
    if (ewe[namespace] && typeof ewe[namespace][methodName] === "function") {
      return await ewe[namespace][methodName](...(args || []));
    }
  }
});
