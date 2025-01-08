/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

export const defaultFilterLists = [
  { name: "circumvention", enabled: true },
  { name: "ads", enabled: true },
  { name: "allowing", enabled: true }
];

export const premiumLinkButtons = [
  { selector: "#premium-upgrade-description > a", text: "Learn more" },
  {
    selector: '.premium-banner-container [data-i18n="options_upgrade_button"]',
    text: "Upgrade"
  },
  {
    selector: '#content-general [data-i18n="options_upgrade_button"]',
    text: "Upgrade"
  }
];

export const premiumToggles = [
  { name: "cookie", selector: "#premium-cookie-toggle svg", enabled: "false" },
  {
    name: "distractions",
    selector: "#premium-distractions-toggle svg",
    enabled: "true"
  }
];
