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

import * as ewe from "@eyeo/webext-ad-filtering-solution/ui";
import * as messaging from "~/core/messaging/front";
import { getSourceAttribute } from "../../common.mjs";
import { $ } from "../../dom.mjs";
import { initI18n } from "~/i18n/ui";
import setupBlock from "./block-element.mjs";
import setupToggles from "./toggles.mjs";
import { activeTab, reportIssue, whenPageReady } from "./utils.mjs";

import {
  ANNOYANCE_SUBSCRIPTION_TYPE,
  COOKIES_PREMIUM_SUBSCRIPTION_TYPE
} from "../../../src/premium-subscriptions/shared/index.ts";
import {
  AI_SUMMARIES_SUBSCRIPTION_TYPE,
  isAiSummariesRolledOut
} from "../../../src/core/subscriptions/shared/index.ts";

import "../../../src/popup/ui/popup.css";
import "../../io-circle-toggle.mjs";
import "./notifications.mjs";
import "../../io-popup-footer.mjs";

const extensionsUIServerLogger = new ewe.telemetry.ServerLogger(
  "extensions_ui"
);

initI18n();

/**
 * Reports an error to Sentry and logs it to the console
 *
 * @param {error} error -  The error to send to Sentry, and to log to the console
 */
function reportAndLogError(error) {
  ewe.sentry.reportError(error);
  console.error(error);
}

// info (platform, application and store) dataset bootstrap
//
// "platform" is used to hide the Issue Reporter due EdgeHTML bug
// the Issue Reporter should work once MSEdge ships with Chromium instead
//
// "application" is used to hide all Edge specific things (i.e. 3rd parts links)
//
// "store" is used to specify the extension rating redirect link
messaging.app.getInfo().then((info) => {
  // this won't ever change during ABP lifecycle, which is why
  // it's set ASAP as data-platform attribute, on the most top element,
  // instead of being one of the body classes
  const { dataset } = document.documentElement;
  ["platform", "application", "store"].forEach(
    (key) => (dataset[key] = info[key])
  );
});

activeTab
  .then((tab) => {
    const urlProtocol = tab.url && new URL(tab.url).protocol;
    if (/^https?:$/.test(urlProtocol)) {
      whenPageReady(tab).then(() => {
        document.body.classList.remove("nohtml");
      });
    } else {
      document.body.classList.add("disabled");
      document.body.classList.add("ignore");
      document.body.classList.remove("nohtml");
    }

    document.body.classList.toggle("private", tab.incognito);

    return tab;
  })
  .then(async (tab) => {
    const { url } = tab;
    const defaultDetails = { hostname: "", pathname: "", search: "" };
    const { hostname, pathname, search } = url ? new URL(url) : defaultDetails;
    $("#blocking-domain").textContent = hostname;
    let pageContent = pathname;
    if (!search.includes("&")) {
      pageContent += search;
    } else if (search) {
      pageContent += "?…";
    }

    // Special case for YouTube pages (as they are SPA) the allowlist
    // page is not supported, since snippets are not injected properly,
    // so we hide this section entirely
    if (/\.youtube\.com$/.test(hostname)) {
      $(".status_block.page").style.display = "none";
    }

    $("#blocking-page").textContent = pageContent;
    $("#issue-reporter").addEventListener("click", () => reportIssue(tab));
    // drop the text content but keep it as aria-label
    const options = $("#options");
    options.setAttribute("aria-label", options.textContent);
    options.textContent = "";
    options.addEventListener("click", () => {
      messaging.app.open("options").then(
        // force closing popup which is not happening in Firefox
        // @link https://issues.adblockplus.org/ticket/7017
        () => window.close()
      );
    });

    try {
      await setupPremium();
      setupPremiumToggles();
    } catch (error) {
      reportAndLogError(error);
    }

    setupCookieModal();
    setupAiSummariesToggle().catch(reportAndLogError);
    setupToggles(tab);
    setupStats(tab);
    setupBlock(tab);
    setupFooter();

    // closing the popup when the user focus on a different tab,
    // hence, normalizing the behavior across all browsers
    browser.tabs.onActivated.addListener(() => {
      // force closing popup, after user has clicked a link,
      // which is not happening in Firefox
      // @link https://issues.adblockplus.org/ticket/7017
      // we can't rely on "click" events, as Firefox will end up opening
      // the links in a new window, instead of a new tab
      // @link https://bugzilla.mozilla.org/show_bug.cgi?id=1780550
      window.close();
    });

    document.body.hidden = false;
  });

let receivedBlockedPerPageUpdate = false;

function updateBlockedPerPage(blockedPage) {
  $("#stats-page .amount").textContent = blockedPage.toLocaleString();
}

let receivedBlockedTotalUpdate = false;

function updateBlockedTotal(blockedTotal) {
  const total = blockedTotal.toLocaleString();
  $("#stats-total .amount").textContent = total;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Intializes the Premium state & related UI components
 *
 * @param {number} retryCount - the current retry count, used to avoid a
 *        premium users seeing the incorrect premium status in the popup menu.
 */
async function setupPremium(retryCount = 0) {
  const premium = await messaging.premium.get();
  if (!premium) {
    if (retryCount > 4) {
      throw new Error("Failed to initialize Premium");
    }
    retryCount += 1;
    await wait(200);
    setupPremium(retryCount);
    return;
  }

  setupPremiumBanners();
  updateToggles();

  setPremiumState(premium.isActive);

  messaging.addMessageListener((msg) => {
    if (msg.type !== "premium.respond" || msg.action !== "changed") return;

    setupPremiumBanners();
    setPremiumState(msg.args[0].isActive);
  });

  messaging.premium.listen(["changed"]);
}

async function setupPremiumBanners() {
  const source = getSourceAttribute(document.body);
  const premiumUpgradeUrl = await messaging.ctalinks.get("premium-upgrade", {
    source
  });
  $("#premium-upgrade").setAttribute("href", premiumUpgradeUrl);
  document.querySelectorAll("[data-link='premium']").forEach((element) => {
    element.setAttribute("href", premiumUpgradeUrl);
  });
}

function setPremiumState(premiumIsActive) {
  document.body.classList.toggle("premium", premiumIsActive);
}

function setupStats(tab) {
  messaging.addMessageListener((msg) => {
    if (msg.type !== "stats.respond") return;

    switch (msg.action) {
      case "blocked_per_page":
        if (msg.args[0].tabId === tab.id) {
          receivedBlockedPerPageUpdate = true;
          updateBlockedPerPage(msg.args[0].blocked);
        }
        break;
      case "blocked_total":
        receivedBlockedTotalUpdate = true;
        updateBlockedTotal(msg.args[0]);
        break;
    }
  });

  messaging.stats.listen(["blocked_per_page", "blocked_total"]);

  messaging.stats.getBlockedPerPage(tab).then((blockedPage) => {
    if (!receivedBlockedPerPageUpdate) updateBlockedPerPage(blockedPage);
  });
  messaging.stats.getBlockedTotal().then((blockedTotal) => {
    if (!receivedBlockedTotalUpdate) updateBlockedTotal(blockedTotal);
  });
}

function setupFooter() {
  const footer = document.querySelector("io-popup-footer");

  fetch("data/popup-footer.json")
    .then((res) => res.json())
    .then((msgs) => {
      const msgsToDisplay = msgs.filter(({ exceptions }) => {
        if (!exceptions) return true;

        return !["platform", "application", "store"].some((info) => {
          const { [info]: exceptionsInfo } = exceptions;

          if (!exceptionsInfo) return false;

          const { [info]: browserInfo } = document.documentElement.dataset;

          return exceptionsInfo.includes(browserInfo);
        });
      });

      msgsToDisplay.sort((a, b) => a.order - b.order);

      footer.setState({
        messages: msgsToDisplay,
        current: Math.floor(Math.random() * msgsToDisplay.length)
      });

      footer.startAnimation();
    });
}

async function setupPremiumToggles() {
  const cookieToggle = document.getElementById("premium-cookie-toggle");
  const annoyanceToggle = document.getElementById(
    "premium-distractions-toggle"
  );

  annoyanceToggle.addEventListener("click", async () => {
    const value = annoyanceToggle.getAttribute("checked") !== null;
    if (value) {
      messaging.premium.add(ANNOYANCE_SUBSCRIPTION_TYPE);
    } else {
      messaging.premium.remove(ANNOYANCE_SUBSCRIPTION_TYPE);
    }
  });

  cookieToggle.addEventListener("click", async (event) => {
    const value = cookieToggle.getAttribute("checked") !== null;

    if (value) {
      const modalContainer = document.getElementById("cookie-consent-modal");
      modalContainer.classList.add("visible");
    } else {
      messaging.premium.remove(COOKIES_PREMIUM_SUBSCRIPTION_TYPE);
    }
  });
}

async function updateToggles() {
  const isPremiumEnabled = await messaging.premium.get();
  const premiumSubscriptionsState =
    await messaging.premium.getPremiumSubscriptionsState();

  const annoyanceSubActive =
    isPremiumEnabled && premiumSubscriptionsState[ANNOYANCE_SUBSCRIPTION_TYPE];
  const cookiesSubActive =
    isPremiumEnabled &&
    premiumSubscriptionsState[COOKIES_PREMIUM_SUBSCRIPTION_TYPE];

  const cookieToggle = document.getElementById("premium-cookie-toggle");
  const annoyanceToggle = document.getElementById(
    "premium-distractions-toggle"
  );

  if (cookiesSubActive) {
    cookieToggle.setAttribute("checked", "");
  } else {
    cookieToggle.removeAttribute("checked");
  }

  if (annoyanceSubActive) {
    annoyanceToggle.setAttribute("checked", "");
  } else {
    annoyanceToggle.removeAttribute("checked");
  }
}

/**
 * Returns the recommendation of the free "Hide AI search summaries" filter
 * list, or null while the list is not a recommended subscription
 *
 * @returns {Promise<object|null>}
 */
async function getAiSummariesRecommendation() {
  const recommendations = await messaging.subscriptions.getRecommendations();
  return (
    recommendations.find(
      ({ type }) => type === AI_SUMMARIES_SUBSCRIPTION_TYPE
    ) || null
  );
}

/**
 * Checks whether the given filter list is installed and enabled
 *
 * @param {string} url - Filter list URL
 * @returns {Promise<boolean>}
 */
async function isSubscriptionEnabled(url) {
  const subscriptions = await messaging.subscriptions.get({
    ignoreDisabled: true
  });
  return subscriptions.some((subscription) => subscription.url === url);
}

/**
 * Turns the given filter list on. "add" does nothing for a list that is
 * installed but disabled, and "toggle" would remove a list that is already
 * enabled, so the current state (including disabled lists) is checked first.
 *
 * @param {string} url - Filter list URL
 * @returns {Promise<boolean>} whether the filter list is on afterwards
 */
async function enableSubscription(url) {
  const subscriptions = await messaging.subscriptions.get();
  const subscription = subscriptions.find((item) => item.url === url);
  if (!subscription) {
    return (await messaging.subscriptions.add(url)) === true;
  }
  if (subscription.disabled) {
    return await messaging.subscriptions.toggle(url);
  }
  return true;
}

/**
 * Initializes the toggle for the free "Hide AI search summaries"
 * filter list. The toggle is only shown if the filter list is available
 * as a recommended subscription and the option is rolled out to the user.
 */
async function setupAiSummariesToggle() {
  // The toggle is not shown, and so not reported as shown, on pages the
  // extension cannot act on
  if (document.body.classList.contains("ignore")) return;

  const container = $("#page-free-controls");
  const toggle = $("#ai-summaries-toggle");

  const [recommendation, flags] = await Promise.all([
    getAiSummariesRecommendation(),
    ewe.experiments.getFlags()
  ]);
  if (!recommendation) return;
  if (!isAiSummariesRolledOut(flags)) return;

  const { url } = recommendation;
  // Like allowlisting, a change made from the popup only takes effect once
  // the page is reloaded, so the reload prompt is shown while the state
  // differs from the one the popup opened with
  const wasEnabled = await isSubscriptionEnabled(url);

  const updateToggle = async () => {
    toggle.toggleAttribute("checked", await isSubscriptionEnabled(url));
  };

  toggle.addEventListener("click", async () => {
    const value = toggle.getAttribute("checked") !== null;
    // The event is only logged once the change was applied
    if (value) {
      const enabled = await enableSubscription(url);
      if (!enabled) return;
    } else {
      await messaging.subscriptions.remove(url);
    }
    document.body.classList.toggle("refresh", value !== wasEnabled);
    const action = value ? "opted_in" : "opted_out";
    extensionsUIServerLogger.behavior("ai_summaries_toggled", {
      action,
      source: "popup"
    });
  });

  messaging.addMessageListener((msg) => {
    if (msg.type !== "subscriptions.respond") return;

    const [subscription] = msg.args;
    if (subscription && subscription.url === url) {
      updateToggle();
    }
  });
  messaging.subscriptions.listen(["added", "changed", "removed"]);

  toggle.toggleAttribute("checked", wasEnabled);
  container.hidden = false;
  extensionsUIServerLogger.behavior("ai_summaries_toggle_shown", {
    source: "popup"
  });
}

function setupCookieModal() {
  const modalContainer = document.getElementById("cookie-consent-modal");
  const cookieToggle = document.getElementById("premium-cookie-toggle");

  const closeButton = document.getElementById("cookie-consent-modal-close");
  const acceptButton = document.getElementById("cookie-consent-modal-accept");

  closeButton.addEventListener("click", () => {
    modalContainer.classList.remove("visible");
    cookieToggle.removeAttribute("checked");
  });

  acceptButton.addEventListener("click", async () => {
    messaging.premium.add(COOKIES_PREMIUM_SUBSCRIPTION_TYPE);
    modalContainer.classList.remove("visible");
  });
}
