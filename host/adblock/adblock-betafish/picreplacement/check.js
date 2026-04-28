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

/* For ESLint: List any global identifiers used in this file below */
/* global browser */

// Yes, you could hack my code to not check the license.  But please don't.
// Paying for this extension supports the work on AdBlock.  Thanks very much.

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { EventEmitter } from "../../adblockplusui/adblockpluschrome/lib/events";
import { TabSessionStorage } from "../../adblockplusui/adblockpluschrome/lib/storage/tab-session";

import { getUserId } from "../id/background/index";
import { Channels } from "./channels";
import { setSetting } from "~/prefs/background";
import { showIconBadgeCTA, NEW_BADGE_REASONS } from "~/alias/icon";
import { Prefs } from "~/alias/prefs";
import { initialize } from "~/alias/subscriptionInit";
import * as logger from "~/utilities/background";
import SubscriptionAdapter from "../subscriptionadapter";
import {
  chromeStorageSetHelper,
  chromeStorageGetHelper,
  migrateData,
  storageSet,
  reloadOptionsPageTabs,
} from "~/utilities/background";

const licenseNotifier = new EventEmitter();

export const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = "license";
  const installTimestampStorageKey = "install_timestamp";
  const userClosedSyncCTAKey = "user_closed_sync_cta";
  const userSawSyncCTAKey = "user_saw_sync_cta";
  const pageReloadedOnSettingChangeKey = "page_reloaded_on_user_settings_change";
  const sevenDayAlarmName = "sevenDayLicenseAlarm";

  let theLicense;
  const initialized = false;
  let readyComplete;
  const licensePromise = new Promise((resolve) => {
    readyComplete = resolve;
  });
  const themesForCTA = [
    "solarized_theme",
    "solarized_light_theme",
    "watermelon_theme",
    "sunshine_theme",
    "ocean_theme",
  ];
  let currentThemeIndex = 0;
  const mabConfig = {
    prod: {
      licenseURL: "https://myadblock.licensing.getadblock.com/license/",
      subscribeKey: "sub-c-9eccffb2-8c6a-11e9-97ab-aa54ad4b08ec",
      payURL: "https://getadblock.com/premium/enrollment/",
      subscriptionURL: "https://myaccount.getadblock.com/?ref=adblock-options&premium=true",
    },
    dev: {
      licenseURL: "https://dev.myadblock.licensing.getadblock.com/license/",
      subscribeKey: "sub-c-9e0a7270-83e7-11e9-99de-d6d3b84c4a25",
      payURL: "https://getadblock.com/premium/enrollment/?testmode=true",
      subscriptionURL: "https://ab.ua-qa.eyeo.it/?ref=adblock-options&premium=true",
    },
  };

  (async () => {
    // wait for Prefs to be loaded before using them
    await Prefs.untilLoaded;

    const userID = await getUserId();
    mabConfig.prod.payURL = `${mabConfig.prod.payURL}?u=${userID}`;
    mabConfig.dev.payURL = `${mabConfig.dev.payURL}&u=${userID}`;

    const bypassAuthorizedKeys = Prefs.get("bypass_authorizedKeys");
    mabConfig.prod.bypassAuthorizedKeys = bypassAuthorizedKeys;
    mabConfig.dev.bypassAuthorizedKeys = bypassAuthorizedKeys;
  })();

  const MAB_CONFIG = isProd ? mabConfig.prod : mabConfig.dev;

  const sevenDayAlarmIdleListener = function (newState) {
    if (newState === "active") {
      License.checkSevenDayAlarm();
    }
  };

  const removeSevenDayAlarmStateListener = function () {
    browser.idle.onStateChanged.removeListener(sevenDayAlarmIdleListener);
  };

  const addSevenDayAlarmStateListener = function () {
    removeSevenDayAlarmStateListener();
    browser.idle.onStateChanged.addListener(sevenDayAlarmIdleListener);
  };

  const cleanUpSevenDayAlarm = function () {
    removeSevenDayAlarmStateListener();
    browser.storage.local.remove(License.sevenDayAlarmName);
    browser.alarms.clear(License.sevenDayAlarmName);
  };

  const processSevenDayAlarm = function () {
    cleanUpSevenDayAlarm();
    showIconBadgeCTA(NEW_BADGE_REASONS.SEVEN_DAY);
  };

  // check the 7 alarm when the browser starts
  // or is woken up
  const checkSevenDayAlarm = function () {
    browser.alarms.get(License.sevenDayAlarmName).then((alarm) => {
      if (alarm && Date.now() > alarm.scheduledTime) {
        browser.alarms.clear(License.sevenDayAlarmName).then(() => {
          showIconBadgeCTA(NEW_BADGE_REASONS.SEVEN_DAY);
          removeSevenDayAlarmStateListener();
          browser.storage.local.remove(License.sevenDayAlarmName);
        });
      } else if (alarm) {
        // if the alarm should fire in the future,
        // re-add the license so it fires at the correct time
        const originalTime = alarm.scheduledTime;
        browser.alarms.clear(License.sevenDayAlarmName).then((wasCleared) => {
          if (wasCleared) {
            browser.alarms.create(License.sevenDayAlarmName, { when: originalTime });
            browser.storage.local.set({ [License.sevenDayAlarmName]: true });
            License.addSevenDayAlarmStateListener();
          }
        });
      } else {
        // since there's no alarm, we may need to show the 'new' text,
        // check if the temporary seven day alarm indicator is set, and
        // if the install date is 7 days or more than now
        browser.storage.local.get(License.sevenDayAlarmName).then((data) => {
          if (data && data[License.sevenDayAlarmName]) {
            browser.storage.local.get("blockage_stats").then((response) => {
              const { blockage_stats } = response;
              if (blockage_stats && blockage_stats.start) {
                const installDate = new Date(blockage_stats.start);
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
                const diffDays = Math.round((now - installDate) / oneDay);
                if (diffDays >= 7) {
                  showIconBadgeCTA(NEW_BADGE_REASONS.SEVEN_DAY);
                  removeSevenDayAlarmStateListener();
                  browser.storage.local.remove(License.sevenDayAlarmName);
                }
              }
            });
          }
        });
        removeSevenDayAlarmStateListener();
      }
    });
  };
  addSevenDayAlarmStateListener();

  // Load the license from persistent storage
  // Should only be called during startup / initialization
  const loadFromStorage = function (callback) {
    browser.storage.local.get(licenseStorageKey).then((response) => {
      theLicense = response[licenseStorageKey] || {};
      if (typeof callback === "function") {
        callback();
      }
    });
  };
  const checkForManagedSettings = function () {
    return new Promise((resolve) => {
      if ("managed" in browser.storage) {
        browser.storage.managed.get(null).then(
          (items) => {
            for (const key in items) {
              if (key === "suppress_premium_cta") {
                theLicense = License.get();
                theLicense[key] = items[key];
                License.set(theLicense);
              }
            }
            resolve();
          },
          // Opera and FF doesn't support browser.storage.managed, but instead of simply
          // removing the API, it gives an asynchronous error which we ignore here.
          () => {
            resolve();
          },
        );
      } else {
        resolve();
      }
    });
  };

  // Clean up / remove old, unused data in localStorage
  function cleanUpLocalStorage() {
    storageSet(licenseStorageKey);
  }

  return {
    licenseStorageKey,
    userClosedSyncCTAKey,
    userSawSyncCTAKey,
    themesForCTA,
    pageReloadedOnSettingChangeKey,
    initialized,
    sevenDayAlarmName,
    checkSevenDayAlarm,
    processSevenDayAlarm,
    addSevenDayAlarmStateListener,
    removeSevenDayAlarmStateListener,
    cleanUpSevenDayAlarm,
    licenseNotifier,
    MAB_CONFIG,
    isProd,
    enrollUser() {
      loadFromStorage(() => {
        // only enroll users if they were not previously enrolled
        if (typeof theLicense.myadblock_enrollment === "undefined") {
          theLicense.myadblock_enrollment = true;
          License.set(theLicense);
        }
      });
    },
    get() {
      return theLicense;
    },
    set(newLicense) {
      const licenseStatusBefore = theLicense.status;

      if (newLicense) {
        theLicense = newLicense;
        browser.storage.local.set({ license: theLicense });
      }

      if (licenseStatusBefore !== newLicense.status) {
        licenseNotifier.emit("license.status.changed");
      }
    },
    /**
     * Changes configuration to use development licensing server
     */
    setDevConfig() {
      License.MAB_CONFIG = mabConfig.dev;
    },
    initialize(callback) {
      loadFromStorage(() => {
        checkForManagedSettings().then(() => {
          if (typeof callback === "function") {
            callback();
          }
          cleanUpLocalStorage();
          readyComplete();
        });
      });
    },
    getCurrentPopupMenuThemeCTA() {
      const theme = License.themesForCTA[currentThemeIndex];
      const lastThemeIndex = License.themesForCTA.length - 1;
      currentThemeIndex = lastThemeIndex === currentThemeIndex ? 0 : (currentThemeIndex += 1);
      return theme || "";
    },
    async processExpiredLicense() {
      theLicense = License.get();
      theLicense.myadblock_enrollment = true;
      License.set(theLicense);
      setSetting("picreplacement", false);
      licenseNotifier.emit("license.expired");
      setSetting("color_themes", { popup_menu: "default_theme", options_page: "default_theme" });
      SubscriptionAdapter.unsubscribe({ adblockId: "distraction-control" });
      SubscriptionAdapter.unsubscribe({ adblockId: "cookies-premium" });
    },
    ready() {
      return licensePromise;
    },
    async getLicenseInstallationDate() {
      const response = await browser.storage.local.get(installTimestampStorageKey);
      const originalInstallTimestamp = response[installTimestampStorageKey];
      if (originalInstallTimestamp) {
        return new Date(originalInstallTimestamp);
      }
      return undefined;
    },
    async getFormattedActiveSinceDate() {
      if (
        !License ||
        !(await License.isActiveLicense()) ||
        !License.get() ||
        !License.get().createdAtUTC ||
        !Number.isInteger(License.get().createdAtUTC)
      ) {
        return null;
      }
      const dateFormat = { year: "numeric", month: "long" };
      let formattedDate = null;
      try {
        const createdAtUTC = parseInt(License.get().createdAtUTC, 10);
        formattedDate = new Date(createdAtUTC).toLocaleDateString(undefined, dateFormat);
      } catch (e) {
        return null;
      }
      return formattedDate;
    },
    async isActiveLicense() {
      return ewe.account.hasPremium();
    },
    isLicenseCodeValid() {
      return License && License.get().code && typeof License.get().code === "string";
    },
    isMyAdBlockEnrolled() {
      return License && License.get() && License.get().myadblock_enrollment === true;
    },
    async shouldShowMyAdBlockEnrollment() {
      return (
        License.isMyAdBlockEnrolled() &&
        !(await License.isActiveLicense()) &&
        License.shouldShowPremiumCTA()
      );
    },
    async shouldShowPremiumDcCTA() {
      return (
        License && (await License.isActiveLicense()) && License.get().suppress_premium_cta !== true
      );
    },
    shouldShowPremiumCTA() {
      return !(License && License.get().suppress_premium_cta === true);
    },
  };
})();

const replacedByPage = new TabSessionStorage("ab:premium:replaced");

// Records how many ads have been replaced by AdBlock.  This is used
// by the AdBlock to display statistics to the user.
export const replacedCounts = (function getReplacedCount() {
  const adReplacedNotifier = new EventEmitter();
  const key = "replaced_stats";
  migrateData(key, true).then(() => {
    chromeStorageGetHelper(key).then((data) => {
      let replacedCountData = data;
      if (!data) {
        replacedCountData = {};
      }
      if (replacedCountData.start === undefined) {
        replacedCountData.start = Date.now();
      }
      if (replacedCountData.total === undefined) {
        replacedCountData.total = 0;
      }
      replacedCountData.version = 1;
      chromeStorageSetHelper(key, replacedCountData);
      storageSet(key);
    });
  });

  return {
    recordOneAdReplaced(tabId) {
      chromeStorageGetHelper(key).then((replacedCountData) => {
        const data = replacedCountData;
        data.total += 1;
        chromeStorageSetHelper(key, data);
        browser.tabs.get(tabId).then(async (tab) => {
          let replaced = (await replacedByPage.get(tabId)) || 0;
          await replacedByPage.set(tabId, (replaced += 1));
          adReplacedNotifier.emit("adReplaced", tabId, tab.url);
        });
      });
    },
    get() {
      return chromeStorageGetHelper(key);
    },
    async getTotalAdsReplaced(tabId) {
      if (tabId) {
        return replacedByPage.get(tabId);
      }
      return this.get().then((data) => data.total);
    },
    adReplacedNotifier,
  };
})();

// for use in the premium enrollment process
// de-coupled from the `License.ready().then` code below because the delay
// prevents the addListener from being fired in a timely fashion.
const onInstalledPromise = new Promise((resolve) => {
  browser.runtime.onInstalled.addListener((details) => {
    resolve(details);
  });
});

// the order of Promises below dictacts the order of the data in the detailsArray
Promise.all([onInstalledPromise, License.ready(), initialize]).then((detailsArray) => {
  // Enroll existing users in Premium
  if (detailsArray.length > 0 && detailsArray[0].reason) {
    License.enrollUser();
    if (detailsArray[0].reason === "install") {
      // create an alarm that will fire in ~ 7 days to show the "New" badge text
      browser.alarms.create(License.sevenDayAlarmName, { delayInMinutes: 60 * 24 * 7 });
      License.addSevenDayAlarmStateListener();
      browser.storage.local.set({ [License.sevenDayAlarmName]: true });
    }
  }
});

browser.runtime.onStartup.addListener(async () => {
  await License.ready();
  await migrateToUserAccount();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === License.sevenDayAlarmName) {
    License.processSevenDayAlarm();
  }
});

License.ready().then(async () => {
  License.checkSevenDayAlarm();

  // Attempt to migrate from legacy license to user account,
  // when extension starts or SW restarts
  await migrateToUserAccount();
});

License.initialize(() => {
  if (!License.initialized) {
    License.initialized = true;
  }
});

/**
 * Migrates the user's license to a user account if they have an active license
 * @returns {Promise<void>}
 */
async function migrateToUserAccount() {
  await Prefs.untilLoaded;
  await License.ready();

  // feature flag to gradually roll out this migration
  if (!(await ewe.experiments.getFlag("ab_migrate_license"))) {
    logger.debug("License migration feature flag is not enabled, skipping migration");
    return;
  }

  // If the user doesn't have an active legacy license, we don't need to migrate
  if (!License.isLicenseCodeValid() || License.get().status !== "active") {
    logger.debug("Not active legacy license, skipping migration");
    return;
  }

  // If the user already logged in, we don't need to do anything
  if (await ewe.account.isLoggedIn()) {
    logger.debug("Already has premium, skipping migration");
    return;
  }

  // attempt to log in with the license
  try {
    // If there's no valid license code throw an error
    if (!License.isLicenseCodeValid() || !License.get().code) {
      throw new Error("No valid license code for migration");
    }

    const userId = await getUserId();
    await ewe.account.logInWithLicense({
      userId,
      licenseId: License.get().code,
    });
    logger.debug("Migrated license to user account successfully");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Failed to migrate license to user account", e);
    ewe.sentry.reportError(e);
  }
}

ewe.account.onChanged.addListener(async ({ user, oldUser }) => {
  const hasPremium = user && user.hasPremium;
  const oldUserHadPremium = oldUser && oldUser.hasPremium;

  // activate
  if (hasPremium && !oldUserHadPremium) {
    if (await ewe.account.isTrial()) {
      SubscriptionAdapter.subscribe({ adblockId: "distraction-control" });
      SubscriptionAdapter.subscribe({ adblockId: "cookies-premium" });
    }
    reloadOptionsPageTabs();
  }

  licenseNotifier.emit("license.updated", {
    status: hasPremium ? "active" : "expired",
  });

  if (hasPremium !== oldUserHadPremium) {
    // used in allowlisting module to update the authorized keys
    licenseNotifier.emit("license.status.changed");
  }

  // expired
  if (!hasPremium) {
    logger.debug("No premium license, deactivating features");
    await License.processExpiredLicense();
  }
});

// eslint-disable-next-line no-restricted-globals
Object.assign(self, {
  License,
  replacedCounts,
});

export const channels = new Channels(License);
