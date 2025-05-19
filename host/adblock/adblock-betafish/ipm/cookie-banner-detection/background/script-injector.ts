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
 * Returns an MV2 script to inject into the page.
 *
 * @param injectedFunction - The function to be injected into the page.
 * @param params - The parameters for the function.
 * @returns The code to be injected into the main world context.
 */
function getMV2ScriptToInject(
  injectedFunction: (...args: unknown[]) => unknown,
  ...params: unknown[]
): string {
  const args = JSON.stringify([...params]);
  const stringified = JSON.stringify(injectedFunction.toString());
  const wrapped = `"(${stringified.slice(1, -1)}).apply(null,${JSON.stringify(args).slice(1, -1)});"`;
  return `
    function injectScriptInMainContext(executable) {
      let script = document.createElement("script");
      script.type = "application/javascript";
      script.async = false;

      // Firefox 58 only bypasses site CSPs when assigning to 'src',
      // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
      // only bypass site CSPs when using 'textContent'.
      if (typeof netscape != "undefined" && typeof browser != "undefined") {
        let url = URL.createObjectURL(new Blob([executable]));
        script.src = url;
        document.documentElement.appendChild(script);
        URL.revokeObjectURL(url);
      } else {
        script.textContent = executable;
        document.documentElement.appendChild(script);
      }

      document.documentElement.removeChild(script);
    };
    {
      const executable = ${wrapped};
      injectScriptInMainContext(executable);
    }
  `;
}

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
): Promise<unknown> {
  // Prefer new API, if available
  if (browser.scripting?.executeScript) {
    const world: browser.Scripting.ExecutionWorld = "MAIN";
    const injection = {
      target: { tabId, frameIds: [frameId] },
      world,
      injectImmediately: true,
      func,
      args,
    };
    // eslint-disable-next-line no-return-await
    return await browser.scripting.executeScript(injection);
  }

  // If not available, fall back to old API.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const code = getMV2ScriptToInject(func, ...args);
  // eslint-disable-next-line no-return-await
  return await browser.tabs.executeScript(tabId, {
    frameId,
    code,
    matchAboutBlank: true,
    runAt: "document_start",
  });
}
