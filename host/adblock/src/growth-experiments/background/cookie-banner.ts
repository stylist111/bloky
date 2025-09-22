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

import { type WebNavigation } from "webextension-polyfill";
import ServerMessages from "~/servermessages";
import { runCookieBannerExperiment } from "../content/cookie-banner";
import { cookieBannerExperimentStorageKey, experimentDomain } from "./cookie-banner.types";
import { executeFunction } from "./script-injector";
import { cookieBannerEventNames } from "../shared";
import { Prefs } from "~/alias/prefs";
import { License } from "~/picreplacement/check";

import LogoIcon from "../content/icons/logo.js";

/**
 * The navigation listener we attach to browser.webNavigation.onCommitted
 *
 * @param details The navigation details as passed from the webNavigation.onCommitted event
 */
async function navigationListener(details: WebNavigation.OnCommittedDetailsType): Promise<void> {
  const { tabId, frameId, url } = details;

  if (await License.isActiveLicense()) {
    // Should not show this experiment for already premium users
    return;
  }

  if (frameId !== 0) {
    // Not the tab's top-level browsing context.
    return;
  }

  if (!url.startsWith(experimentDomain)) {
    // Not the site we want to run on.
    return;
  }

  const browserLanguage = browser.i18n.getUILanguage();
  if (!browserLanguage.toLowerCase().startsWith("en")) {
    // Not the language we want to run on.
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.webNavigation.onCommitted.removeListener(navigationListener);
  void Prefs.set(cookieBannerExperimentStorageKey, true);

  // Sending event to legacy AdBlock log server; we could also send to IPM server instead.
  ServerMessages.recordGeneralMessage(cookieBannerEventNames.siteDetected);

  try {
    void executeFunction(tabId, frameId, runCookieBannerExperiment, [
      cookieBannerEventNames.cpmMessageDetected,
      cookieBannerEventNames.buttonInjected,
      cookieBannerEventNames.buttonClicked,
      LogoIcon,
    ]);
  } catch (_) {
    // Can't recover from this.
  }
}

/**
 * Starts the cookie banner experiment module
 */
export function start(): void {
  if (Prefs.get(cookieBannerExperimentStorageKey) === true) {
    // We've run this experiment already.
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  browser.webNavigation.onCommitted.addListener(navigationListener);
}
