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

/**
 * Executes the given function in the main world context of a frame.
 *
 * @param tabId The id of the tab to inject the function into
 * @param frameId The id of the frame to inject the function into
 * @param func The function to inject
 * @param [args=[]] Any optional arguments for the function
 */
export async function executeFunction(
  tabId: number,
  frameId: number,
  func: () => void,
  args: unknown[] = [],
): Promise<void> {
  if (
    typeof browser.scripting === "undefined" ||
    typeof browser.scripting.executeScript !== "function"
  ) {
    return;
  }

  const world: browser.Scripting.ExecutionWorld = "MAIN";
  const injection = {
    target: { tabId, frameIds: [frameId] },
    world,
    injectImmediately: true,
    func,
    args,
  };

  await browser.scripting.executeScript(injection);
}
