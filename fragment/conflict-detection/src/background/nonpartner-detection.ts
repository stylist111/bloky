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
import * as ewe from "@eyeo/webext-ad-filtering-solution";
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

const baitsURLs = [
  "*://btloader.com/tag?*",
  "*://ad-delivery.net/px.gif?ch=1*",
  "*://ad-delivery.net/px.gif?ch=2*",
  "*://*.gpt.mail.yahoo.net/sandbox*",
  "*://cdn.adnxs.com/*/trk.js*",
  "*://*.ssl-images-amazon.com/images/S/apesafeframe/ape/sf*",
  "*://*.media-amazon.com/images/S/apesafeframe/ape/sf*",
];

async function getEventName(
  details:
    | browser.WebRequest.OnErrorOccurredDetailsType
    | browser.WebRequest.OnCompletedDetailsType,
  blocked: boolean,
): Promise<string | null> {
  const { url, type, tabId } = details;
  if (url.includes("btloader.com/tag")) {
    return blocked ? "bt_loader_blocked" : "bt_loader_success";
  }

  if (url.includes("ad-delivery.net/px.gif?ch=1")) {
    return blocked ? "aa_bait1_blocked" : "aa_bait1_success";
  }

  if (url.includes("ad-delivery.net/px.gif?ch=2")) {
    return blocked ? "aa_bait2_blocked" : "aa_bait2_success";
  }

  try {
    const tab = await browser.tabs.get(tabId);
    const tabUrl = new URL(tab.url ?? "");
    const hostname = tabUrl.hostname;

    // should match
    // blocking rule ||gpt.mail.yahoo.net/sandbox$subdocument,domain=mail.yahoo.com
    // allowlisting rule @@||gpt.mail.yahoo.net/sandbox$document,subdocument,domain=mail.yahoo.net|mail.yahoo.com|mail.aol.com
    const isYahooFilter =
      url.includes("gpt.mail.yahoo.net/sandbox") &&
      type === "sub_frame" &&
      hostname.includes("mail.yahoo.com");

    // should match
    // blocking rule ||adnxs.com^
    // allowlisting rule @@||cdn.adnxs.com/*/trk.js$script,domain=outlook.live.com|www.msn.com
    const isMicrosoftFilter =
      url.includes("cdn.adnxs.com") &&
      type === "script" &&
      (hostname.includes("outlook.live.com") || hostname.includes("msn.com"));

    // should match
    // blocking rule ||ssl-images-amazon.com/images/S/apesafeframe/ape/sf/$script
    // allowlisting rule @@||ssl-images-amazon.com^*/ape/sf/whitelisted/desktop/$subdocument,document,script,domain=amazon.ie|amazon.se|amazon.com.be|amazon.sg|amazon.pl|amazon.eg|amazon.com|amazon.co.jp|amazon.co.uk|amazon.de|amazon.es|amazon.fr|amazon.in|amazon.it|amazon.ca|amazon.cn|amazon.com.mx|amazon.com.au|amazon.ae|amazon.sa|amazon.com.br|amazon.nl
    const isAmazonFilter =
      (url.includes("ssl-images-amazon.com/images/S/apesafeframe/ape/sf") ||
        url.includes("media-amazon.com/images/S/apesafeframe/ape/sf")) &&
      type === "script" &&
      hostname.includes("amazon.");

    if (isYahooFilter || isMicrosoftFilter || isAmazonFilter) {
      return blocked ? "aa_other_blocked" : "aa_other_success";
    }
  } catch (error) {}

  return null;
}

async function getAAListsStatus(): Promise<number> {
  const [aa, privacy] = await Promise.all([
    ewe.subscriptions.has(ewe.subscriptions.ACCEPTABLE_ADS_URL),
    ewe.subscriptions.has(ewe.subscriptions.ACCEPTABLE_ADS_PRIVACY_URL),
  ]);

  let result = 0;
  if (aa) {
    result |= 1;
  }
  if (privacy) {
    result |= 2;
  }
  return result;
}

const serverLogger = new ewe.telemetry.ServerLogger("conflict_detection");

/**
 * Runs checks to detect if uBo is present in the page context.
 *
 * @param {string} eventName - The name of the event to be dispatched.
 * @returns {boolean} The result of the checks.
 */
function uboDetection(eventName: string): boolean {
  const jsonIn = `{"require":{"0":{"3":{"0":{"__bbox":{"require":[{"3":{"1":{"__bbox":{"result":{"data":{"serpResponse":{"results":{"edges":[{"rendering_strategy":{"view_model":{"story":{"sponsored_data":{"ad_id":"this_will_be_removed"}}}}}]}}}}}}}}]}}}}}}`;

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
  try {
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
  } catch (error) {
    logger.error(
      "[conflict-detection]: Error running MV3 detection script",
      error,
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

  try {
    await browser.tabs.executeScript(tabId, {
      frameId: 0,
      code: executable,
      matchAboutBlank: true,
      runAt: "document_end",
    });
    logger.debug(
      "[conflict-detection]: non-partner extension MV2 detection script was injected",
    );
  } catch (error) {
    logger.error(
      "[conflict-detection]: Error running MV2 detection script",
      error,
    );
  }
}

/**
 * Initializes the conflict resolution main world script.
 * Sets up listeners and injects the page script after the DOM is ready.
 */
export function start(parameters: StartInfo): void {
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

  // Monitor request errors on *://btloader.com/tag?*, if it's blocked and AA is enabled,
  // it indicates that a non-partner extension is present. Save it as a separate data point.
  browser.webRequest.onErrorOccurred.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { tabId, error } = details;
      const eventName = await getEventName(details, true);
      if (!eventName) return;

      const [aaListsStatus, filters] = await Promise.all([
        getAAListsStatus(),
        ewe.filters.getAllowingFilters(tabId),
      ]);
      serverLogger.info(eventName, {
        errorMsg: error,
        isPageAllowlisted: filters.length > 0,
        aaListsStatus,
      });
    },
    { urls: baitsURLs },
  );
  // Monitor successful requests on *://btloader.com/tag?*, to estimate the impact of the non-partner extensions.
  browser.webRequest.onCompleted.addListener(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (details): Promise<void> => {
      const { tabId } = details;
      const eventName = await getEventName(details, false);
      if (!eventName) return;

      const [aaListsStatus, filters] = await Promise.all([
        getAAListsStatus(),
        ewe.filters.getAllowingFilters(tabId),
      ]);
      serverLogger.info(eventName, {
        isPageAllowlisted: filters.length > 0,
        aaListsStatus,
      });
    },
    { urls: baitsURLs },
  );
}
