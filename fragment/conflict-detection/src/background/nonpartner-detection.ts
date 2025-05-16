/**
 * This file is part of eyeo's Conflict Resolution fragment,
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
import { prepareInlineScriptForInjection } from "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/snippets.js";
import { detectionEvent } from "../shared/index.js";
import {
  type StartInfo,
  uboDetectedKey,
  uboDetectionLastRunKey,
  uboExtensionIds,
} from "./detection.types.js";

const urlMatches = [
  { hostEquals: "www.youtube.com" },
  { hostEquals: "youtube.com" },
  { hostEquals: "www.facebook.com" },
  { hostEquals: "facebook.com" },
];

/**
 * Runs checks to detect if uBo is present in the page context.
 *
 * @param {string} eventName - The name of the event to be dispatched.
 * @returns {boolean} The result of the checks.
 */
function uboDetection(eventName: string): boolean {
  const jsonIn = `{"require":{"0":{"3":{"0":{"__bbox":{"require":[{"3":{"1":{"__bbox":{"result":{"data":[{"ads_data":{"__typename":"this_will_be_removed"}}]}}}}}]}}}}}}`;

  const jsonOut = JSON.stringify(JSON.parse(jsonIn));
  const XHRChanged = XMLHttpRequest.toString().includes("uboLog");
  const result = jsonIn !== jsonOut || XHRChanged;

  if (!result) {
    return false;
  }

  if (eventName) {
    document.dispatchEvent(new CustomEvent(eventName));
  }

  return result;
}

/**
 * Save the detection result in prefs.
 *
 * @param {any} prefs - The prefs object to save the result in.
 * @param {string} key - The key to save the result under.
 */
async function saveResultInPrefs(prefs: any, key: string): Promise<void> {
  await prefs.untilLoaded;
  await prefs.set(key, Date.now());
}

/**
 * Runs the MV3 detection script in the main world.
 *
 * @param {any} logger - The logger object to log messages.
 * @param {any} prefs - The prefs object to save the result in.
 * @param {number} tabId - The ID of the tab to run the script in.
 */
async function runMV3Detection(
  logger: any,
  prefs: any,
  tabId: number,
): Promise<void> {
  const [{ result }] = await browser.scripting.executeScript({
    target: { tabId },
    func: uboDetection,
    world: "MAIN",
  });
  logger.debug(
    "[conflict-detection]: non-partner extension MV3 detection script was injected",
  );

  if (!result) {
    logger.debug(
      "[conflict-detection]: NO non-partner extension was found on MV3",
    );
    return;
  }

  logger.debug("[conflict-detection]: non-partner extension found on MV3");
  await saveResultInPrefs(prefs, uboDetectedKey);
}

/**
 * Runs the MV2 detection script in the main world.
 *
 * @param {any} logger - The logger object to log messages.
 * @param {number} tabId - The ID of the tab to run the script in.
 */
async function runMV2Detection(logger: any, tabId: number): Promise<void> {
  const executable = prepareInlineScriptForInjection(
    uboDetection,
    detectionEvent,
  );

  await browser.tabs.executeScript(tabId, {
    frameId: 0,
    code: executable,
    matchAboutBlank: true,
    runAt: "document_end",
  });

  logger.debug(
    "[conflict-detection]: non-partner extension MV2 detection script was injected",
  );
}

/**
 * Initializes the conflict resolution main world script.
 * Sets up listeners and injects the page script after the DOM is ready.
 */
export function startNonPartnerDetection(parameters: StartInfo): void {
  const { logger, port, addTrustedMessageTypes, prefs } = parameters;

  // Run the detection on the onCompleted event of the webNavigation API
  // to make sure the page is fully loaded before running the detection
  // and that the content script injected from manifest.json is initialized.
  browser.webNavigation.onCompleted.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { tabId, frameId } = details;

      // If the frameId is not 0, it means it's a subframe, so we ignore it.
      // If the tabId is -1, it means it's a non-tab request, so we ignore it.
      if (frameId !== 0 || tabId === -1) {
        return;
      }

      if (
        // @ts-expect-error Property always exists. This is false as on MV2 it does not exist.
        browser.scripting?.executeScript &&
        // @ts-expect-error Property ExecutionWorld does not exist on type Static
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Object.values(browser.scripting.ExecutionWorld ?? {}).includes("MAIN")
      ) {
        await runMV3Detection(logger, prefs, tabId);
      } else {
        await runMV2Detection(logger, tabId);
      }

      await saveResultInPrefs(prefs, uboDetectionLastRunKey);
    },
    {
      url: urlMatches,
    },
  );

  urlMatches.forEach(({ hostEquals: host }): void => {
    addTrustedMessageTypes(`https://${host}`, [detectionEvent]);
  });

  port.on(detectionEvent, async (): Promise<void> => {
    await saveResultInPrefs(prefs, uboDetectedKey);
    logger.debug("[conflict-detection]: non-partner extension found on MV2");
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.tabs.onCreated.addListener(async (tab): Promise<void> => {
    const { url, pendingUrl, title } = tab;
    const tabUrl = url && url !== "" ? url : pendingUrl;

    if (!tabUrl) {
      return;
    }

    const isPartnerExtension = uboExtensionIds.some(
      (extensionId) =>
        tabUrl.includes(`/${extensionId}/`) || title?.includes(extensionId),
    );

    if (isPartnerExtension) {
      logger.debug(
        "[conflict-detection]: non-partner extension found by options page",
      );
      await saveResultInPrefs(prefs, uboDetectionLastRunKey);
      await saveResultInPrefs(prefs, uboDetectedKey);
    }
  });
}
