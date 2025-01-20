/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
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

const addTestId = (el) => ({ ...el, testId: `filters_${el.name}` });
export const languageFilterLists = [
  {
    name: "easylist_plus_arabic_plus_french",
    text: "Arabic + French + EasyList",
    checkboxSelector: "#languageFilterList_0",
  },
  {
    name: "easylist_plus_bulgarian",
    text: "Bulgarian + EasyList",
    checkboxSelector: "#languageFilterList_1",
  },
  {
    name: "chinese",
    text: "Chinese + EasyList",
    checkboxSelector: "#languageFilterList_2",
  },
  {
    name: "czech",
    text: "Czech & Slovak + EasyList",
    checkboxSelector: "#languageFilterList_3",
  },
  {
    name: "dutch",
    text: "Dutch + EasyList",
    checkboxSelector: "#languageFilterList_4",
  },
  {
    name: "easylist_plus_french",
    text: "French + EasyList",
    checkboxSelector: "#languageFilterList_5",
  },
  {
    name: "easylist_plus_german",
    text: "German + EasyList",
    checkboxSelector: "#languageFilterList_6",
  },
  {
    name: "easylist_plus_global",
    text: "Global + EasyList",
    checkboxSelector: "#languageFilterList_7",
  },
  {
    name: "israeli",
    text: "Hebrew + EasyList",
    checkboxSelector: "#languageFilterList_8",
  },
  {
    name: "easylist_plus_hungarian",
    text: "Hungarian + EasyList",
    checkboxSelector: "#languageFilterList_9",
  },
  {
    name: "easylist_plus_indian",
    text: "IndianList + EasyList",
    checkboxSelector: "#languageFilterList_10",
  },
  {
    name: "easylist_plus_indonesian",
    text: "Indonesian + EasyList",
    checkboxSelector: "#languageFilterList_11",
  },
  {
    name: "italian",
    text: "Italian + EasyList",
    checkboxSelector: "#languageFilterList_12",
  },
  {
    name: "japanese",
    text: "Japanese",
    checkboxSelector: "#languageFilterList_13",
  },
  {
    name: "easylist_plun_korean",
    text: "Korean",
    checkboxSelector: "#languageFilterList_14",
  },
  {
    name: "latvian",
    text: "Latvian + EasyList",
    checkboxSelector: "#languageFilterList_15",
  },
  {
    name: "easylist_plus_lithuania",
    text: "Lithuanian + EasyList",
    checkboxSelector: "#languageFilterList_16",
  },
  {
    name: "nordic",
    text: "Nordic Filters + EasyList",
    checkboxSelector: "#languageFilterList_17",
  },
  {
    name: "easylist_plus_polish",
    text: "Polish",
    checkboxSelector: "#languageFilterList_18",
  },
  {
    name: "easylist_plus_portuguese",
    text: "Portuguese + EasyList",
    checkboxSelector: "#languageFilterList_19",
  },
  {
    name: "easylist_plus_romanian",
    text: "Romanian + EasyList",
    checkboxSelector: "#languageFilterList_20",
  },
  {
    name: "russian",
    text: "Russian & Ukrainian + EasyList",
    checkboxSelector: "#languageFilterList_21",
  },
  {
    name: "easylist_plus_spanish",
    text: "Spanish",
    checkboxSelector: "#languageFilterList_22",
  },
  {
    name: "turkish",
    text: "Turkish",
    checkboxSelector: "#languageFilterList_23",
  },
  {
    name: "easylist_plus_vietnamese",
    text: "Vietnamese + EasyList",
    checkboxSelector: "#languageFilterList_24",
  },
].map(addTestId);

export function getDefaultFilterLists(aaEnabled) {
  return [
    {
      name: "acceptable_ads",
      checkboxSelector: "#adblockFilterList_0",
      text: "Acceptable Ads",
      enabled: aaEnabled,
    },
    {
      name: "acceptable_ads_privacy",
      checkboxSelector: "#adblockFilterList_1",
      text: "Only allow ads without third-party tracking",
      enabled: false,
    },
    {
      name: "anticircumvent",
      checkboxSelector: "#adblockFilterList_2",
      text: "Anti-Circumvention filters",
      enabled: true,
    },
    { name: "easylist", checkboxSelector: "#adblockFilterList_3", text: "EasyList", enabled: true },
    {
      name: "warning_removal",
      checkboxSelector: "#otherFilterList_0",
      text: "Adblock Warning Removal list",
      enabled: false,
    },
    {
      name: "antisocial",
      checkboxSelector: "#otherFilterList_1",
      text: "Antisocial filter list",
      enabled: false,
    },
    {
      name: "bitcoin_mining_protection",
      checkboxSelector: "#otherFilterList_2",
      text: "Cryptocurrency (Bitcoin) Mining Protection List",
      enabled: false,
    },
    {
      name: "easyprivacy",
      checkboxSelector: "#otherFilterList_3",
      text: "EasyPrivacy (privacy protection)",
      enabled: false,
    },
    {
      name: "annoyances",
      checkboxSelector: "#otherFilterList_4",
      text: "Fanboy's Annoyances",
      enabled: false,
    },
    {
      name: "fb_notifications",
      checkboxSelector: "#otherFilterList_5",
      text: "Fanboy's Notifications (blocks in-page pop-ups, social media and related widgets, and other annoyances)",
      enabled: false,
    },
    {
      name: "idcac",
      checkboxSelector: "#otherFilterList_6",
      text: "I Don't Care About Cookies",
      enabled: false,
    },
  ].map(addTestId);
}

export const premiumFilterLists = [
  { checkboxSelector: "#distraction-control", text: "Distraction Control" },
  { checkboxSelector: "#cookies-premium", text: "Cookie Consent Cutter" },
].map(addTestId);

export const premiumPopupToggleItems = [
  { name: "cookies-premium", action: "confirmCookie" },
  { name: "distraction-control", action: "confirmDistractions" },
].map(addTestId);
