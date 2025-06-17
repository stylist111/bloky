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

import * as logger from "../../logger/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { start as startContentFiltering } from "../../../adblockpluschrome/lib/contentFiltering.js";
import { start as startDebug } from "../../../adblockpluschrome/lib/debug.js";
import { start as startDevTools } from "../../../adblockpluschrome/lib/devtools.js";
import { start as startFilterConfiguration } from "../../../adblockpluschrome/lib/filterConfiguration.js";
import { start as startMessageResponder } from "../../../adblockpluschrome/lib/messageResponder.js";
import { start as startStats } from "../../../adblockpluschrome/lib/stats.js";
import { start as startTabSessionStorage } from "../../../adblockpluschrome/lib/storage/tab-session";
import { start as startSubscriptionInit } from "../../../adblockpluschrome/lib/subscriptionInit.js";
import { start as startUninstall } from "~/uninstall/background";
import { start as startInit } from "../../../lib/init.js";
import { start as startRecommendedLanguage } from "../../../lib/recommendLanguage.js";
import { start as startAllowListing } from "../../allowlisting/background";
import { start as startBypass } from "../../bypass/background";
import { start as startComposer } from "../../composer/background";
import { start as startIPM } from "@eyeo-fragments/ipm/background";
import { start as startNewTab } from "../../new-tab/background";
import { start as startOnPageDialog } from "../../onpage-dialog/background";
import { start as startPremiumOnboarding } from "../../premium-onboarding/background";
import { start as startPremiumSubscriptions } from "../../premium-subscriptions/background";
import { start as startFirstRun } from "../../first-run/background";
import {
  ReadyState,
  setReadyState,
  start as startReadyState
} from "../../testing/ready-state/background";
import { start as startYTWallDetection } from "@eyeo-fragments/yt-wall-detection/background";
import { start as startConflictDetection } from "@eyeo-fragments/conflict-detection/background";
import { start as startInfoInjector } from "../../info-injector/background";
import { start as startUpdateCampaign } from "../../update-campaign/background";
import { start as startPages } from "../../core/pages/background";
import { start as startGlobals } from "../../globals/background";
import { start as startPublicAPI } from "@eyeo-fragments/public-api";
import { port, addTrustedMessageTypes } from "~/core/messaging/background";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { getAuthPayload, hasActiveLicense } from "~/premium/background";
import { info } from "~/info/background";
import { startInfo as ipmFragmentStartInfo } from "~/ipm/background";

/**
 * Runs initialization that can be done in parallel and doesn't have to be done
 * in the first turn of the event loop
 */
async function bootstrapAsync(): Promise<void> {
  try {
    await Promise.all([startIPM(ipmFragmentStartInfo)]);
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
      info.addonVersion
    );
  }

  startFirstRun();
  startUpdateCampaign();
}

async function bootstrap(): Promise<void> {
  bootstrapSync();

  startPages();
  startTabSessionStorage();
  startDevTools();
  startDebug();
  startReadyState();
  startFilterConfiguration();
  startStats();
  void startSubscriptionInit();
  startInit();
  void startRecommendedLanguage();
  startComposer();
  startUninstall();
  void startContentFiltering();
  startMessageResponder();
  void startAllowListing();
  startBypass();
  void startOnPageDialog();
  void startNewTab();
  startPremiumOnboarding();
  startPremiumSubscriptions();
  startYTWallDetection({
    addTrustedMessageTypes,
    logger,
    port,
    prefs: Prefs,
    sendAdWallEvents: undefined,
    isPremiumActive: hasActiveLicense
  });
  startInfoInjector();
  startGlobals();
  startPublicAPI({
    port,
    addTrustedMessageTypes,
    isPremiumActive: hasActiveLicense,
    getEncodedLicense: getAuthPayload
  });
  void startConflictDetection({
    logger,
    prefs: Prefs,
    port,
    addTrustedMessageTypes,
    onUpdatedPartnerExtensionIds: async (extensionIds: string[]) => {
      await Prefs.untilLoaded;
      void Prefs.set("partnerExtensionFound", {
        extesnionsIdsFound: extensionIds,
        detectionTimestamp: Date.now()
      });
    }
  });

  await bootstrapAsync();

  setReadyState(ReadyState.started);
}

void bootstrap();
