/**
 * This file is part of eyeo's close-tab fragment,
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
import { closeTabEvent, closeTabAction } from "../shared/constants.js";

/**
 * Handles clicks on elements with data-extension-action="close-tab".
 * Only forwards trusted (user-initiated) click events to the background.
 *
 * @param {Event} event - Click event
 */
function onClick(event) {
  if (!event.isTrusted) {
    return;
  }

  const element = event.target;
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (!element.matches(`[data-extension-action="${closeTabAction}"]`)) {
    return;
  }

  event.stopPropagation();
  event.preventDefault();

  void browser.runtime.sendMessage({ type: closeTabEvent });
}

/**
 * Initializes close-tab content script by listening for click events.
 */
export function start() {
  document.addEventListener("click", onClick);
}
