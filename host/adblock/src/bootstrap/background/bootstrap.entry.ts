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

import { type Runtime } from "webextension-polyfill";

import * as info from "info";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { start as startCookieBannerDetection } from "@eyeo-fragments/cookie-banner-detection/background";
import { start as startFilterExperiments } from "@eyeo-fragments/filter-experiments/background";

import { License } from "~/picreplacement/check";
import { initialize } from "~/alias/subscriptionInit";
import { Prefs } from "~/alias/prefs";
import { start as startSettings } from "~/prefs/background";
import * as logger from "~/utilities/background";
import { start as startInProductMessaging } from "../../ipm/background";
import { start as startNewTab } from "../../../adblock-betafish/new-tab/background";
import { start as startOnPageDialog } from "../../../adblock-betafish/onpage-dialog/background";
import { start as startTelemetry } from "../../telemetry/background";
import { start as startTestingEwe } from "../../testing/ewe/background";

/**
 * Runs initialization that can be done in parallel and doesn't have to be done
 * in the first turn of the event loop
 */
async function bootstrapAsync(): Promise<void> {
  try {
    // although the following calls are not asynchronous by logic,
    // it's part of the initialization that doesn't need to be serialized
    startCookieBannerDetection();
    startTestingEwe();

    await Promise.all([
      startFilterExperiments(),
      startInProductMessaging(),
      startNewTab(),
      startOnPageDialog(),
      startTelemetry(),
    ]);
  } catch (ex) {
    logger.reportAndLogError(ex);
  }
}

/**
 * Runs initalization that must be done in the first turn of the event loop
 */
function bootstrapSync(): void {
  // This early in the initialization, we may not have loaded the preference
  // value from storage yet, and we cannot load it in the first turn of the
  // event loop. However, we can determine its default value. This helps us
  // avoid collecting any data for users who are opted-out by default.
  if (Prefs.get("data_collection_opt_out")) {
    console.warn("Sentry is not initialized");
  } else {
    void ewe.sentry.start(
      webpackDotenvPlugin.SENTRY_DSN,
      webpackDotenvPlugin.SENTRY_ENVIRONMENT,
      info.addonVersion,
    );
  }

  // Premium enrollment and the "New" badge alarm only run after the extension
  // is installed/updated and subscription initialization has completed. The
  // onInstalled listener must be registered in the first turn of the event
  // loop, which is why it lives in this synchronous bootstrap phase.
  const onInstalledPromise = new Promise<Runtime.OnInstalledDetailsType>((resolve) => {
    browser.runtime.onInstalled.addListener((details) => {
      resolve(details);
    });
  });

  // the order of Promises below dictates the order of the data in detailsArray
  void Promise.all([onInstalledPromise, License.ready(), initialize]).then((detailsArray) => {
    // Enroll existing users in Premium
    if (detailsArray.length > 0 && detailsArray[0].reason) {
      License.enrollUser();
      if (detailsArray[0].reason === "install") {
        // create an alarm that will fire in ~ 7 days to show the "New" badge text
        browser.alarms.create(License.sevenDayAlarmName, { delayInMinutes: 60 * 24 * 7 });
        License.addSevenDayAlarmStateListener();
        void browser.storage.local.set({ [License.sevenDayAlarmName]: true });
      }
    }
  });
}

async function bootstrap(): Promise<void> {
  bootstrapSync();

  startSettings();

  await bootstrapAsync();
}

void bootstrap();
