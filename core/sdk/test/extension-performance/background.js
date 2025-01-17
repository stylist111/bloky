/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-env webextensions, serviceworker */

"use strict";

function isMV3() {
  return typeof chrome.declarativeNetRequest != "undefined";
}

if (isMV3()) {
  importScripts("ewe-api.js", "custom-mv3-subscriptions.js", "snippets.js", "polling.js");
}

let startupInfo = {};
if (isMV3()) {
  startupInfo = {
    bundledSubscriptionsPath: "subscriptions",
    bundledSubscriptions: customMV3Subscriptions // eslint-disable-line no-undef
  };
}

EWE.start(startupInfo).then(async firstRun => {
  EWE.testing.enableDebugOutput(true);
  if (firstRun.warnings.length > 0) {
    console.warn("EWE startup warnings: ", firstRun.warnings);
  }

  const subscriptions = isMV3() ? [
    "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/abp-filters-anti-cv.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
    "https://easylist-downloads.adblockplus.org/v3/full/i_dont_care_about_cookies.txt"
  ] : [
    "https://easylist-downloads.adblockplus.org/easylist.txt",
    "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt",
    "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
    "https://easylist-downloads.adblockplus.org/i_dont_care_about_cookies.txt"
  ];

  let errors = [];
  try {
    for (let url of subscriptions) {
      await EWE.subscriptions.add(url);
    }
  }
  catch (err) {
    errors.push(err.message);
  }

  if (errors.length === 0) {
    try {
      await polling.wait(async() => { // eslint-disable-line no-undef
        errors = [];
        const addedSubs = await EWE.subscriptions.getSubscriptions();

        for (let {url, diffURL, downloadStatus, enabled} of addedSubs) {
          if (!enabled || downloadStatus != "synchronize_ok") {
            errors.push(JSON.stringify({
              url, diffURL, downloadStatus, enabled
            }));
          }
        }

        return errors.length == 0;
      }, 5000);
    }
    catch (err) {
      // The errors array will be populated with the error message
      console.warn(err);
    }
  }

  chrome.tabs.create({url: `status.html?errors=${errors.join(";")}`});
});

function initSnippets() {
  EWE.snippets.setLibrary({
    isolatedCode: snippets.isolated, // eslint-disable-line no-undef
    injectedCode: snippets.injected // eslint-disable-line no-undef
  });
}

// importing the snippets script in importScripts() may take a while
setTimeout(initSnippets, 200);
