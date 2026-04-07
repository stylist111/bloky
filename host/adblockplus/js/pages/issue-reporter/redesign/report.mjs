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

import * as messaging from "~/core/messaging/front/index.ts";
import { $, $$ } from "../../../dom.mjs";

let dataGatheringTabId = null;
let isMinimumTimeMet = false;

// Collected data stored temporarily during gathering phase
let collectedRequests = [];
let collectedFilters = [];
let collectedExtensions = [];
let collectedDebugData = null;
let isPremiumUser = false;

function getOriginalTabId() {
  const tabId = parseInt(location.search.replace(/^\?/, ""), 10);
  if (!tabId && tabId !== 0) {
    console.warn("Missing tab id. Try appending '?1' to the end of the url.");
    throw new Error("invalid tab id");
  }

  return tabId;
}

messaging.addMessageListener((message) => {
  if (message.type !== "requests.respond" || message.action !== "hits") return;

  const [request, filter, subscriptions] = message.args;

  // ELEMHIDE hitLog request doesn't contain url
  if (request.url) {
    const url = censorURL(request.url);
    let existingRequest = collectedRequests.find((r) => r.url === url);
    if (!existingRequest) {
      existingRequest = {
        url,
        type: request.type,
        documentDomain: request.docDomain,
        thirdParty: request.thirdParty,
        count: 0,
        matchedFilter: null
      };
      collectedRequests.push(existingRequest);
    }
    existingRequest.count++;
    if (filter) {
      existingRequest.matchedFilter = filter.text;
    }
  }

  if (filter) {
    const existingFilter = collectedFilters.find((f) => f.text === filter.text);
    if (existingFilter) {
      existingFilter.hitCount++;
    } else {
      const subscriptionUrls = subscriptions.map(
        (subscription) => subscription.url
      );
      collectedFilters.push({
        text: filter.text,
        subscriptions: subscriptionUrls,
        hitCount: 1
      });
    }
  }
});

function collectRequests(tabId) {
  // Reset for fresh collection
  collectedRequests = [];
  collectedFilters = [];

  return browser.tabs
    .get(tabId)
    .then((tab) => {
      return browser.tabs.create({ active: false, url: tab.url });
    })
    .then((tab) => {
      dataGatheringTabId = tab.id;
      messaging.requests.listen(["hits"], dataGatheringTabId);

      function minimumTimeMet() {
        if (isMinimumTimeMet) return;

        isMinimumTimeMet = true;
        $("io-steps").dispatchEvent(new CustomEvent("requestcollected"));
      }
      browser.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
        if (
          updatedTabId == dataGatheringTabId &&
          changeInfo.status == "complete"
        )
          minimumTimeMet();
      });
      window.setTimeout(minimumTimeMet, 5000);
      window.addEventListener("beforeunload", (event) => {
        closeRequestsCollectingTab();
      });
    });
}

let closedRequestsCollectingTab;
export function closeRequestsCollectingTab() {
  if (!closedRequestsCollectingTab) {
    if (dataGatheringTabId === null) {
      closedRequestsCollectingTab = Promise.resolve();
    } else {
      closedRequestsCollectingTab = browser.tabs
        .remove(dataGatheringTabId)
        .catch(() => {
          // Tab may have been closed manually by user - ignore error
        });
    }
  }

  return closedRequestsCollectingTab;
}

async function retrieveAddonInfo() {
  const addonVersion = await browser.runtime.sendMessage({
    type: "app.get",
    what: "addonVersion"
  });
  const { locale } = await browser.runtime.sendMessage({
    type: "app.get",
    what: "localeInfo"
  });
  return { version: addonVersion, locale };
}

async function retrieveApplicationInfo() {
  const application = await browser.runtime.sendMessage({
    type: "app.get",
    what: "application"
  });
  const applicationVersion = await browser.runtime.sendMessage({
    type: "app.get",
    what: "applicationVersion"
  });
  return {
    name: capitalize(application),
    version: applicationVersion,
    vendor: navigator.vendor,
    userAgent: navigator.userAgent
  };
}

async function retrievePlatformInfo() {
  const { getBrowserInfo, sendMessage } = browser.runtime;
  const [browserInfo, platform, platformVersion] = await Promise.all([
    getBrowserInfo ? getBrowserInfo() : null,
    sendMessage({ type: "app.get", what: "platform" }),
    sendMessage({ type: "app.get", what: "platformVersion" })
  ]);

  const result = {
    name: capitalize(platform),
    version: platformVersion
  };
  if (browserInfo) {
    result.build = browserInfo.buildID;
  }
  return result;
}

async function retrieveWindowInfo(tabId) {
  const tab = await browser.tabs.get(tabId);
  let openerUrl = null;
  let referrerUrl = null;

  if (tab.openerTabId) {
    const openerTab = await browser.tabs.get(tab.openerTabId);
    openerUrl = openerTab.url;
  }

  if (browser.scripting) {
    const [frameResult] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => document.referrer
    });
    referrerUrl = frameResult.result;
  } else {
    [referrerUrl] = await browser.tabs.executeScript(tabId, {
      code: "document.referrer"
    });
  }

  const result = { url: censorURL(tab.url) };
  if (openerUrl) {
    result.opener = censorURL(openerUrl);
  }
  if (referrerUrl) {
    result.referrer = censorURL(referrerUrl);
  }
  return result;
}

async function retrieveSubscriptions() {
  const subscriptions = await messaging.subscriptions.get({
    ignoreDisabled: true,
    disabledFilters: true
  });

  const now = Math.round(Date.now() / 1000);
  const result = [];

  for (const subscription of subscriptions) {
    if (!/^(http|https|ftp):/.test(subscription.url)) continue;

    const sub = {
      id: subscription.url,
      disabledFilters: subscription.disabledFilters.length
    };

    if (subscription.version) sub.version = subscription.version;
    if (subscription.lastDownload)
      sub.lastDownloadAttempt = subscription.lastDownload - now;
    if (subscription.lastSuccess)
      sub.lastDownloadSuccess = subscription.lastSuccess - now;
    if (subscription.softExpiration)
      sub.softExpiration = subscription.softExpiration - now;
    if (subscription.expires) sub.hardExpiration = subscription.expires - now;
    if (subscription.downloadStatus)
      sub.downloadStatus = subscription.downloadStatus;

    result.push(sub);
  }
  return result;
}

// Chrome doesn't update the JavaScript context to reflect changes in the
// extension's permissions so we need to proxy our calls through a frame that
// loads after we request the necessary permissions
// https://bugs.chromium.org/p/chromium/issues/detail?id=594703
function proxyApiCall(apiId, ...args) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.src = browser.runtime.getURL("proxy.html");
    iframe.onload = () => {
      function callback(...results) {
        document.body.removeChild(iframe);
        resolve(results[0]);
      }

      const proxy = iframe.contentWindow.browser;
      switch (apiId) {
        case "management.getAll":
          if ("getAll" in proxy.management) {
            proxy.management.getAll(...args).then(callback);
          } else {
            callback(null);
          }
          break;
      }
    };
    document.body.appendChild(iframe);
  });
}

async function retrieveExtensions() {
  try {
    const installed = await proxyApiCall("management.getAll");
    const extensions = [];

    for (const extension of installed) {
      if (!extension.enabled || extension.type != "extension") continue;
      extensions.push({
        id: extension.id,
        name: extension.name,
        type: "extension",
        version: extension.version
      });
    }

    const { plugins } = navigator;
    for (const plugin of plugins) {
      extensions.push({
        id: plugin.filename,
        name: plugin.name,
        type: "plugin"
      });
    }

    return extensions;
  } catch (err) {
    console.error("Could not retrieve list of extensions");
    return [];
  }
}

export async function updateConfigurationInfo(isAccessible) {
  if (!isAccessible) {
    collectedExtensions = [];
    return;
  }

  const extensions = await retrieveExtensions();
  collectedExtensions = extensions;
}

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

function censorURL(url) {
  return url.replace(/([?;&/#][^?;&/#]+?=)[^?;&/#]+/g, "$1*");
}

// Handle "Other" issue type - show/hide message input
const otherMessageContainer = $("#otherMessageContainer");

for (const typeElement of $$("#typeSelectorGroup input[name='type']")) {
  typeElement.addEventListener("change", (event) => {
    if (otherMessageContainer) {
      otherMessageContainer.hidden = event.target.value !== "other";
    }
  });
}

function sanitizeDebugData(data) {
  const sanitized = JSON.parse(JSON.stringify(data));
  // Always remove user PII from debug data
  if (sanitized.account && sanitized.account.user) {
    delete sanitized.account.user.email;
    delete sanitized.account.user.displayName;
    delete sanitized.account.user.id;
  }
  return sanitized;
}

export async function updateDebugInfo(include) {
  if (!include) {
    collectedDebugData = null;
    isPremiumUser = false;
    return null;
  }

  try {
    const debugData = await messaging.debug.getInfo();
    collectedDebugData = sanitizeDebugData(debugData);

    if (
      debugData.account &&
      debugData.account.hasPremium &&
      debugData.account.isLoggedIn
    ) {
      isPremiumUser = true;
    }

    return debugData;
  } catch (err) {
    console.error("Failed to get debug info:", err);
    return null;
  }
}

// Stored during initial data gathering
let gatheredAddonInfo = null;
let gatheredApplicationInfo = null;
let gatheredPlatformInfo = null;
let gatheredWindowInfo = null;
let gatheredSubscriptions = null;

export async function gatherInitialData() {
  const tabId = getOriginalTabId();

  const [addonInfo, applicationInfo, platformInfo, windowInfo, subscriptions] =
    await Promise.all([
      retrieveAddonInfo(),
      retrieveApplicationInfo(),
      retrievePlatformInfo(),
      retrieveWindowInfo(tabId),
      retrieveSubscriptions()
    ]);

  gatheredAddonInfo = addonInfo;
  gatheredApplicationInfo = applicationInfo;
  gatheredPlatformInfo = platformInfo;
  gatheredWindowInfo = windowInfo;
  gatheredSubscriptions = subscriptions;

  // Start collecting requests in background
  await collectRequests(tabId);
}

export async function buildReport(screenshotData) {
  // Read current form state
  const typeInput = $("input[name='type']:checked");
  const commentInput = $("#comment");
  const messageInput = $("#otherMessage");
  const emailInput = $("#email");
  const includeConfigCheckbox = $("#includeConfig");
  const includeDebugCheckbox = $("#includeDebug");

  let debugData = null;
  if (
    includeDebugCheckbox &&
    includeDebugCheckbox.checked &&
    collectedDebugData
  ) {
    debugData = sanitizeDebugData(collectedDebugData);
  }

  const report = {
    issue: {
      type: typeInput ? typeInput.value : null,
      description:
        messageInput && messageInput.value ? messageInput.value : null
    },
    product: {
      name: "adblockplus",
      source: "extension",
      version: gatheredAddonInfo?.version || null,
      locale: gatheredAddonInfo?.locale || null
    },
    application: gatheredApplicationInfo,
    platform: gatheredPlatformInfo,
    page: gatheredWindowInfo,
    requests: collectedRequests,
    matchedFiltersSummary: collectedFilters,
    subscriptions: gatheredSubscriptions,
    extensions:
      includeConfigCheckbox && includeConfigCheckbox.checked
        ? collectedExtensions
        : [],
    userComment: commentInput && commentInput.value ? commentInput.value : null,
    contactEmail: null,
    screenshot: screenshotData,
    debugData,
    hasPremium: isPremiumUser
  };

  if (emailInput && emailInput.value.trim()) {
    report.contactEmail = emailInput.value.trim();
  }

  return report;
}
