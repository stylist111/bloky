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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { info } from "../../info/background";
import { getLocaleInfo } from "../../i18n/background";
import {
  applyLinkTemplating,
  isTabAlreadyOpen
} from "../../notifications/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getPremiumState } from "../../premium/background";
import { reportAndLogError } from "../../logger/background";

const DAYS_IN_WEEK = 7;
const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;

// Locales that the update campaign will target
const targetedLocales = ["en", "fr", "de", "es", "nl"];

/**
 * Opens the update campaign in a new tab
 */
async function openUpdatePage(): Promise<void> {
  const rawURL = Prefs.get("update_campaign_url");
  if (typeof rawURL !== "string") {
    return;
  }

  // Don't open the campaign if its currently already opened
  const tabExists = await isTabAlreadyOpen(rawURL, info);
  if (tabExists) {
    return;
  }

  const parsedURL = applyLinkTemplating(rawURL, info);
  try {
    await browser.tabs.create({ url: parsedURL });
  } catch (error) {
    reportAndLogError(
      error,
      "A new tab couldn't be created for the update campaign"
    );
  }
}

/**
 * Determines current week number
 *
 * Based on https://weeknumber.com/how-to/javascript
 */
function getWeekNumber(date: Date): number {
  date.setHours(0, 0, 0, 0);

  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % DAYS_IN_WEEK));

  // January 4 is always in first week
  const firstWeek = new Date(date.getFullYear(), 0, 4);

  const daysSinceFirstWeek =
    (date.getTime() - firstWeek.getTime()) / MILLIS_IN_DAY;

  // Adjust to Thursday in first week and count number of weeks from given date
  // to firstWeek
  return (
    1 +
    Math.round(
      (daysSinceFirstWeek - 3 + ((firstWeek.getDay() + 6) % DAYS_IN_WEEK)) /
        DAYS_IN_WEEK
    )
  );
}

/**
 * Handle update campaign requests
 */
async function handleUpdateCampaign(): Promise<void> {
  await Prefs.untilLoaded;

  // Only open campaign for Firefox users
  if (info.platform !== "gecko") {
    return;
  }

  const dateOverride = Prefs.get(
    "testing_update_campaign_date_override"
  ) as string;
  const date = dateOverride ? new Date(dateOverride) : new Date();

  // Only open campaign in odd-numbered weeks
  if (getWeekNumber(date) % 2 === 0) {
    return;
  }

  // Don't open campaign more than once in the same week
  const lastShown = Prefs.get("update_campaign_last_shown") as number;
  if (lastShown + DAYS_IN_WEEK * MILLIS_IN_DAY > date.getTime()) {
    return;
  }
  void Prefs.set("update_campaign_last_shown", date.getTime());

  // Don't open campaign if this is the first week in which the extension
  // got installed
  if (lastShown === 0) {
    return;
  }

  // Don't open campaign if user opted out of new tabs
  // For testing purposes, we can block opening campaigns on extension updates
  if (Prefs.get("suppress_first_run_page")) {
    return;
  }

  // Don't open campaign if user opted out of marketing messages
  const ignoredCategories = await ewe.notifications.getIgnoredCategories();
  if (ignoredCategories.includes("*")) {
    return;
  }

  // Only open campaign for targeted locales
  const { locale } = getLocaleInfo();
  const language = locale.substring(0, 2);
  if (!targetedLocales.includes(language)) {
    return;
  }

  // Don't open campaign if we're on a managed installation
  const { installType } = await browser.management.getSelf();
  if ((installType as unknown) === "admin") {
    return;
  }

  // Don't open campaign for Premium users
  if ((await getPremiumState()).isActive) {
    return;
  }

  // wait 10 seconds for users that have opened a new tab
  const waitForUserAction = (): void => {
    browser.tabs.onCreated.removeListener(waitForUserAction);
    setTimeout(() => {
      void openUpdatePage();
    }, 10000); // 10 seconds
  };

  browser.tabs.onCreated.removeListener(waitForUserAction);
  browser.tabs.onCreated.addListener(waitForUserAction);
}

/**
 * Initializes update campaign module
 */
export function start(): void {
  void handleUpdateCampaign();
}
