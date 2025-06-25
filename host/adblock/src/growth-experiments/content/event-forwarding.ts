/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import { messageIdentifier, cookieBannerEventNames } from "../shared";

/**
 * Forwards an event to the ServiceWorker.
 *
 * @param name The name of the event to forward
 */
function forwardEvent(name: string): void {
  void browser.runtime.sendMessage({ type: messageIdentifier, name });
}

/**
 * Starts the growth experiments event forwarding feature.
 */
export function start(): void {
  [
    cookieBannerEventNames.cpmMessageDetected,
    cookieBannerEventNames.buttonInjected,
    cookieBannerEventNames.buttonClicked,
  ].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      forwardEvent(eventName);
    });
  });
}

start();
