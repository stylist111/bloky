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

export function getDefaultFilterLists(manifestVersion) {
  return [
    {
      name: manifestVersion === 3 ? "ABP filters (compliance)" : "ABP filters",
      enabled: true
    },
    { name: "EasyList", enabled: true },
    { name: "Allow nonintrusive advertising", enabled: true }
  ];
}

export function getBuiltinFilterLists(manifestVersion) {
  return [
    manifestVersion === 3
      ? "ABP filters (compliance) (ABP Anti-Circumvention Filter List)"
      : "ABP filters (ABP Anti-Circumvention Filter List)",
    "Fanboy's Notifications Blocking List (Block push notifications)",
    "EasyPrivacy (Block additional tracking)",
    "Fanboy's Social Blocking List (Block social media icons tracking)",
    "Free - Distraction Control (Basic distraction control)",
    "Liste AR+Liste FR+EasyList (العربية + English)",
    // Some non-ascii characters of the Indian list title seem to vary on
    // different environments. Simplifying the title as a workaround
    "IndianList+EasyList",
    "Bulgarian list+EasyList (български + English)",
    "Global Filters+EasyList (bosanski, ελληνικά, Filipino, Hrvatski, slovenščina, српски, ภาษาไทย + English)",
    "EasyList Czech and Slovak+EasyList (čeština, slovenčina + English)",
    "Dandelion Sprout's Nordic Filters+EasyList (norsk, dansk, íslenska, føroyskt, kalaallisut, svenska, suomi + English)",
    "EasyList Germany+EasyList (Deutsch + English)",
    "EasyList (English)",
    "EasyList Spanish+EasyList (español + English)",
    "Liste FR+EasyList (français + English)",
    "EasyList Hebrew+EasyList (עברית + English)",
    "Hufilter Basic+EasyList (magyar + English)",
    "ABPindo+EasyList (Bahasa Indonesia, Melayu + English)",
    "EasyList Italy+EasyList (italiano + English)",
    "Japanese Filters+EasyList (日本語 + English)",
    "KoreanList+EasyList (한국어 + English)",
    "EasyList Lithuania+EasyList (lietuvių kalba + English)",
    "Latvian List+EasyList (latviešu valoda + English)",
    "EasyList Dutch+EasyList (Nederlands + English)",
    "EasyList Polish+EasyList (polski + English)",
    "EasyList Portuguese+EasyList (português + English)",
    "ROList+EasyList (română + English)",
    "RU, UA, UZ, KZ+EasyList (Русский, українська, o’zbek, Қазақ тілі + English)",
    "Turkish Filters+EasyList (Türkçe + English)",
    "ABPVN List+EasyList (Tiếng Việt + English)",
    "EasyList China+EasyList (中文 + English)"
  ];
}

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
