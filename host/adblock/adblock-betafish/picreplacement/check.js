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
import postData from "../fetch-util";
import {
  chromeStorageSetHelper,
  chromeStorageGetHelper,
  migrateData,
  log,
  storageSet,
  reloadOptionsPageTabs,
} from "~/utilities/background";

const checkCustomerLifecycleServerLogger = new ewe.telemetry.ServerLogger("customer_lifecycle");

const licenseNotifier = new EventEmitter();

export const License = (function getLicense() {
  const isProd = true;
  const licenseStorageKey = "license";
  const installTimestampStorageKey = "install_timestamp";
  const userClosedSyncCTAKey = "user_closed_sync_cta";
  const userSawSyncCTAKey = "user_saw_sync_cta";
  const pageReloadedOnSettingChangeKey = "page_reloaded_on_user_settings_change";
  const licenseAlarmName = "licenseAlarm";
  const sevenDayAlarmName = "sevenDayLicenseAlarm";

  let theLicense;
  const initialized = false;
  let ajaxRetryCount = 0;
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
    licenseAlarmName,
    sevenDayAlarmName,
    checkSevenDayAlarm,
    processSevenDayAlarm,
    addSevenDayAlarmStateListener,
    removeSevenDayAlarmStateListener,
    cleanUpSevenDayAlarm,
    licenseTimer: undefined, // the license update timer token
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
    // Get the latest license data from the server, and talk to the user if needed.
    async update() {
      // TODO: Remove this when the old license system is fully deprecated
      // Force using the new user account system and ignore the old license
      if (await ewe.experiments.getFlag("ab_legacy_license_disabled")) {
        return;
      }

      const userID = await getUserId();
      licenseNotifier.emit("license.updating");
      const postDataObj = {};
      postDataObj.u = userID;
      postDataObj.cmd = "license_check";
      const licenseStatusBefore = License.get().status;
      // license version
      postDataObj.v = "1";
      postData(License.MAB_CONFIG.licenseURL, postDataObj)
        .then(async (response) => {
          if (response.ok) {
            const responseObj = await response.json();
            ajaxRetryCount = 0;
            const updatedLicense = responseObj;
            licenseNotifier.emit("license.updated", updatedLicense);
            if (!updatedLicense) {
              return;
            }
            // merge the updated license
            theLicense = { ...theLicense, ...updatedLicense };
            theLicense.licenseId = theLicense.code;
            License.set(theLicense);
            // now check to see if we need to do anything because of a status change
            if (
              licenseStatusBefore === "active" &&
              updatedLicense.status &&
              updatedLicense.status === "expired"
            ) {
              void License.processExpiredLicense();
              checkCustomerLifecycleServerLogger.behavior("trial_license_expired");
            }
          } else {
            log("license server error response", response.status, ajaxRetryCount);
            licenseNotifier.emit("license.updated.error", ajaxRetryCount);
            ajaxRetryCount += 1;
            if (ajaxRetryCount > 3) {
              log("Retry Count exceeded, giving up", ajaxRetryCount);
              return;
            }
            const oneMinute = 1 * 60 * 1000;
            setTimeout(() => {
              License.updatePeriodically(`error${ajaxRetryCount}`);
            }, oneMinute);
          }
        })
        .catch((error) => {
          log("license server returned error: ", error);
        });
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
      browser.alarms.clear(licenseAlarmName);
    },
    ready() {
      return licensePromise;
    },
    async create24HourAlarm() {
      if (!(await License.isActiveLicense())) {
        return;
      }

      // If the license is active, we should update it every 24 hours
      // We double check the alarm is set correctly, because it was used with
      // different parameters in the past and we need to migrate it.
      const oneDayInMinutes = 24 * 60;
      const licenseAlarm = await browser.alarms.get(License.licenseAlarmName);
      if (!licenseAlarm || licenseAlarm.periodInMinutes !== oneDayInMinutes) {
        browser.alarms.create(License.licenseAlarmName, { periodInMinutes: oneDayInMinutes });
      }
    },

    async updatePeriodically() {
      if (!(await License.isActiveLicense())) {
        return;
      }
      await License.update();
      await License.create24HourAlarm();

      const response = await browser.storage.local.get(installTimestampStorageKey);
      if (!response[installTimestampStorageKey]) {
        await browser.storage.local.set({ [installTimestampStorageKey]: Date.now() });
      }
    },
    async getLicenseInstallationDate() {
      const response = await browser.storage.local.get(installTimestampStorageKey);
      const originalInstallTimestamp = response[installTimestampStorageKey];
      if (originalInstallTimestamp) {
        return new Date(originalInstallTimestamp);
      }
      return undefined;
    },
    // activate the current license and configure the extension in licensed mode.
    // Call with an optional delay parameter (in milliseconds) if the first license
    // update should be delayed by a custom delay (default is 0 minutes).
    async activate(delayMs) {
      // TODO: Remove this when the old license system is fully deprecated
      // Force using the new user account system and ignore the old license
      if (await ewe.experiments.getFlag("ab_legacy_license_disabled")) {
        return;
      }

      let delay = delayMs;
      const currentLicense = License.get() || {};
      const newLicense = { ...currentLicense };
      newLicense.status = "active";
      License.set(newLicense);
      reloadOptionsPageTabs();
      if (typeof delay !== "number") {
        delay = 0; // 0 minutes
      }
      if (!this.licenseTimer) {
        this.licenseTimer = setTimeout(() => {
          License.updatePeriodically();
        }, delay);
      }
      setSetting("picreplacement", false);
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
      const hasPremium = await ewe.account.hasPremium();

      // TODO: Remove this when the old license system is fully deprecated
      // Force using the new user account system and ignore the old license
      if (await ewe.experiments.getFlag("ab_legacy_license_disabled")) {
        return hasPremium;
      }

      return hasPremium || (License && License.get() && License.get().status === "active");
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

// Make sure the 24 hour license update alarm is set when the browser starts
// just in case it was removed or not set correctly
browser.runtime.onStartup.addListener(async () => {
  await License.ready();
  await License.create24HourAlarm();
  await migrateToUserAccount();
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === License.licenseAlarmName) {
    await License.ready();
    await License.updatePeriodically();
  }

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

  // If the user doesn't have an active license, we don't need to migrate
  if (!(await License.isActiveLicense())) {
    logger.debug("Not active license, skipping migration");
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
