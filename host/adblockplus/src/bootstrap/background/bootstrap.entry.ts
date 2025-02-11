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

import { reportAndLogError } from "../../logger/background";
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
import {
  getExperiments,
  start as startUninstall
} from "~/uninstall/background";
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
import { start as startReadyState } from "../../testing/ready-state/background";
import { start as startYTWallDetection } from "../../yt-wall-detection/background";
import { start as startYTWallDetectionAndAllowlisting } from "@eyeo-fragments/yt-wall-detection/background";
import { start as startInfoInjector } from "../../info-injector/background";
import { start as startUpdateCampaign } from "../../update-campaign/background";
import { start as startPages } from "../../core/pages/background";
import { start as startGlobals } from "../../globals/background";
import { start as startFiltersMigration } from "../../filters/background/";
import { start as startPublicAPI } from "@eyeo-fragments/public-api";
import { port, addTrustedMessageTypes } from "~/core/messaging/background";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  getAuthPayload,
  getPremiumState,
  hasActiveLicense
} from "~/premium/background";
import { getInstallationId } from "~/id/background";
import { info } from "~/info/background";

async function bootstrap(): Promise<void> {
  void ewe.sentry.start(
    webpackDotenvPlugin.SENTRY_DSN,
    webpackDotenvPlugin.SENTRY_ENVIRONMENT,
    info.addonVersion,
    hasActiveLicense()
  );
  try {
    startPages();
    startTabSessionStorage();
    startDevTools();
    startDebug();
    startIPM(
      Prefs,
      logger,
      {
        isLicenseValid() {
          const { isActive } = getPremiumState();
          return isActive;
        }
      },
      {
        async getId() {
          return await getInstallationId();
        },
        getAppName() {
          return info.baseName;
        },
        getBrowserName() {
          return info.application;
        },
        getAppVersion() {
          return info.addonVersion;
        }
      },
      getExperiments
    ).catch(reportAndLogError);
    startReadyState();
    startFilterConfiguration();
    startStats();
    void startSubscriptionInit().catch(reportAndLogError);
    startInit();
    void startRecommendedLanguage().catch(reportAndLogError);
    startComposer();
    startUninstall();
    void startContentFiltering().catch(reportAndLogError);
    startMessageResponder();
    void startAllowListing().catch(reportAndLogError);
    startBypass();
    void startOnPageDialog().catch(reportAndLogError);
    void startNewTab().catch(reportAndLogError);
    startPremiumOnboarding();
    startPremiumSubscriptions();
    startYTWallDetection();
    startYTWallDetectionAndAllowlisting({
      addTrustedMessageTypes,
      ewe,
      logger,
      port,
      prefs: Prefs,
      sendAdWallEvents: undefined
    });
    startInfoInjector();
    startUpdateCampaign();
    startGlobals();
    void startFiltersMigration();
    startPublicAPI({
      ewe,
      port,
      addTrustedMessageTypes,
      isPremiumActive: hasActiveLicense,
      getEncodedLicense: getAuthPayload
    });
  } catch (error) {
    reportAndLogError(error as Error);
  }
}

void bootstrap();
