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
/* global browser, DOMPurify, storageSet, translate */

/* eslint-disable import/extensions */
import { getTabId, closePopup, sendMessageWithNoResponse } from "./utils.js";

const headerAdblockUIServerLogger = new modulesAsGlobal.ewe.telemetry.ServerLogger("adblock_ui");

let template;

const openHomePage = async () => {
  headerAdblockUIServerLogger.behavior("titletext_clicked");
  const homepageURL = "https://github.com/stylist111/bloky";
  await browser.runtime.sendMessage({ command: "openTab", urlToOpen: homepageURL });
  closePopup();
};

const openOptionsPage = async () => {
  const popupMenuDCCtaClosedKey = "popup_menu_dc_cta_closed";
  storageSet(popupMenuDCCtaClosedKey, true);
  headerAdblockUIServerLogger.behavior("options_clicked");
  await browser.runtime.sendMessage({
    command: "openTab",
    urlToOpen: browser.runtime.getURL("options.html#general"),
  });
  closePopup();
};

const openHelp = (pageInfo, tabId) => {
  headerAdblockUIServerLogger.behavior("support_icon_clicked");
  if (!pageInfo.disabledSite) {
    // This navigates to the index and starts the help SPA
    const currentURL = new URL(window.location.href);
    currentURL.pathname = "/adblock-button-popup.html";
    currentURL.search = "?command=showHelp";
    // Add tabId if it exists
    if (tabId) {
      currentURL.searchParams.set("tabId", tabId);
    }
    window.location.href = currentURL.toString();
  } else {
    sendMessageWithNoResponse({
      command: "openTab",
      urlToOpen: "https://github.com/stylist111/bloky/issues",
    });
  }
};

const loadTemplate = function () {
  return fetch("./button/header.html")
    .then((response) => response.text())
    .then((text) => {
      template = DOMPurify.sanitize(text, { SAFE_FOR_JQUERY: true });
    });
};

// Bloky: one light look; a theme saved by an older version is ignored
// (body#default_theme comes from the HTML).
const addLogoAndTheme = (info, $template) => {
  // Bloky: one flat logo (see header.html)
  $template.find(".header-logo").attr("alt", translate("adblock_logo"));
};

const checkAnddisableOnPageOptions = (info, $template) => {
  const states = ["disabledSite", "domainPaused", "paused", "whitelisted"];

  if (states.some((state) => info[state])) {
    $template.find("#filtering_options_wrapper").addClass("disabled");
  }
};

// Bloky: everything is free, so there is no "Premium" badge in the header.
const checkAndShowPremium = () => {};

const addTranslationsAndActions = (info, tabId, $template) => {
  const tabSupportText = translate("tabsupport");
  const optionsText = translate("options");
  const moreOptionsText = translate("more_options_hover");

  // Add a11y labls
  $template.find("#header-logo").attr("aria-label", translate("adblock_logo"));
  $template.find("#help_link i").attr("aria-label", tabSupportText);
  $template.find("#svg_options i").attr("aria-label", optionsText);
  $template.find("#filtering_options_wrapper i").attr("aria-label", moreOptionsText);

  // Translate hover labels
  $template.find("#help-icon-tooltip").text(tabSupportText);
  $template.find("#options-icon-tooltip").text(optionsText);
  $template.find("#more-icon-tooltip").text(moreOptionsText);

  // Add actions to buttons
  $template.find("#header-logo").on("click", openHomePage);
  $template.find("#svg_options").on("click", openOptionsPage);
  $template.find("#help_link").on("click", openHelp.bind(null, info, tabId));
};

const initialize = async function () {
  const tabId = getTabId();
  const info = await browser.runtime.sendMessage({ command: "getCurrentTabInfo", tabId });
  const $template = $(template);

  addLogoAndTheme(info, $template);
  checkAndShowPremium(info, $template);
  addTranslationsAndActions(info, tabId, $template);
  checkAnddisableOnPageOptions(info, $template);

  // Append everything
  const $wrapper = $("#wrapper");
  $wrapper.prepend($template);
  if (tabId) {
    $("#filtering_options_wrapper").attr(
      "href",
      `adblock-button-filtering-options.html?tabId=${tabId}`,
    );
  }
};

loadTemplate().then(async () => {
  await initialize();
});
