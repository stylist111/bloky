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
import { port, addTrustedMessageTypes } from "~/core/messaging/background";

/**
 * Initializes close-tab feature
 */
export function start(): void {
  /**
   * Closes the tab that sent the message.
   *
   * @event "app.close"
   */
  port.on("app.close", (message, sender) => {
    if (sender.tab?.id) void browser.tabs.remove(sender.tab.id);
  });

  // Restrict app.close message to trusted origins only
  addTrustedMessageTypes("https://adblockplus.org", ["app.close"]);
  addTrustedMessageTypes("https://new.adblockplus.org", ["app.close"]);
  addTrustedMessageTypes("https://welcome.adblockplus.org", ["app.close"]);
  addTrustedMessageTypes("https://accounts.adblockplus.org", ["app.close"]);
  addTrustedMessageTypes("https://myaccount.adblockplus.org", ["app.close"]);
}
