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

import * as info from "info";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { start as startCookieBannerDetection } from "@eyeo-fragments/cookie-banner-detection/background";

import { Prefs } from "~/alias/prefs";
import { start as startSettings } from "~/prefs/background";
import * as logger from "~/utilities/background";
import { start as startInProductMessaging } from "../../ipm/background";
import { start as startGrowthExperiments } from "../../growth-experiments/background";
import { start as startNewTab } from "../../../adblock-betafish/new-tab/background";
import { start as startOnPageDialog } from "../../../adblock-betafish/onpage-dialog/background";
import { start as startPageviewMetrics } from "../../pageview-metrics/background";
import { start as startTelemetry } from "../../telemetry/background";
import { start as startAddBTRequestHeader } from "../../blockthrough/background";
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

    await Promise.all([startPageviewMetrics(), startTelemetry()]);
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
}

async function bootstrap(): Promise<void> {
  bootstrapSync();

  startSettings();
  void startGrowthExperiments();

  // Features depending on IPM need to wait for fragment to be selected,
  // even if they don't need to be await-ed themselves
  await startInProductMessaging();
  void startOnPageDialog();
  void startNewTab();
  void startAddBTRequestHeader();

  await bootstrapAsync();
}

void bootstrap();
