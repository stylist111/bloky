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
import { start as startDebug } from "../../../adblockpluschrome/lib/debug.js";
import { start as startGetDebugInfo } from "../../debug/background";
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
import { start as startCookieBannerDetection } from "@eyeo-fragments/cookie-banner-detection/background";
import { start as startInfoInjector } from "../../info-injector/background";
import { start as startUpdateCampaign } from "../../update-campaign/background";
import { start as startCloseTab } from "@eyeo-fragments/close-tab";
import { start as startPages } from "../../core/pages/background";
import { start as startGlobals } from "../../globals/background";
import { start as startPublicAPI } from "@eyeo-fragments/public-api";
import { port, addTrustedMessageTypes } from "~/core/messaging/background";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { getPerformanceTimings } from "@eyeo/webext-ad-filtering-solution/all/profiling.js";
import { hasActiveLicense } from "~/premium/background";
import { info } from "~/info/background";
import { start as startTelemetry } from "~/telemetry/background";
import { start as startInProductMessaging } from "~/ipm/background";
import { start as startEWE } from "~/ewe/background";
import { start as startTestingEwe } from "~/testing/ewe/background";

const serverLogger = new ewe.telemetry.ServerLogger("initialization");

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
      startInProductMessaging(),
      startNewTab(),
      startOnPageDialog(),
      startTelemetry()
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
      info.addonVersion
    );
  }

  startFirstRun();
  startUpdateCampaign();
}

/**
 * Runs initialization of each extension functionality
 */
async function bootstrap(): Promise<void> {
  performance.mark("adblockplus.bootstrap");

  bootstrapSync();

  // startEWE is meant to be called in the first turn of the event loop,
  // but it cannot be moved to bootstrapSync() yet, because we need to await
  // its result, this could be moved to bootstrapSync() once webext will support
  // sync function to call start.
  // This function needs to be called before any functionality that might be using it.
  const eweFirstRun = await startEWE();

  startPages();
  startTabSessionStorage();
  startDevTools();
  startDebug();
  startReadyState();
  startFilterConfiguration();
  startStats();
  void startSubscriptionInit(eweFirstRun);
  startInit();
  void startRecommendedLanguage();
  startComposer();
  startUninstall();
  startMessageResponder();
  void startAllowListing();
  startBypass();
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
  startCloseTab({
    port,
    addTrustedMessageTypes,
    trustedOrigins: [
      "https://adblockplus.org",
      "https://new.adblockplus.org",
      "https://welcome.adblockplus.org",
      "https://accounts.adblockplus.org",
      "https://myaccount.adblockplus.org"
    ]
  });
  startGlobals();
  startPublicAPI({
    port,
    addTrustedMessageTypes,
    hasPremium: hasActiveLicense
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
  startGetDebugInfo();

  setReadyState(ReadyState.started);
  performance.measure("adblockplus.bootstrap", "adblockplus.bootstrap");
}

void bootstrap()
  .then(async () => {
    let availableStaticRuleCount = null;
    if (browser.declarativeNetRequest) {
      availableStaticRuleCount =
        await browser.declarativeNetRequest.getAvailableStaticRuleCount();
    }

    serverLogger.debug("initialization_complete", {
      availableStaticRuleCount,
      subscriptionsCount: (await ewe.subscriptions.getSubscriptions()).length,
      timings: getPerformanceTimings()
    });
  })
  .catch((e) => {
    performance.measure("adblockplus.bootstrap.error", "adblockplus.bootstrap");

    serverLogger.debug("initialization_error", {
      errorMsg: e.message,
      hasInternalError: /internal error/i.test(e.message as string),
      timings: getPerformanceTimings()
    });

    throw e;
  });
