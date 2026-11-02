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
const addTestIdAndCheckboxSelector = (el) => ({
  ...el,
  testId: `filters_${el.name}`,
  checkboxSelector: `[data-testid="filters_${el.name}"]`,
});
export const languageFilterLists = [
  {
    name: "easylist_plus_arabic_plus_french",
    text: "Arabic + French + EasyList",
  },
  {
    name: "easylist_plus_bulgarian",
    text: "Bulgarian + EasyList",
  },
  {
    name: "chinese",
    text: "Chinese + EasyList",
  },
  {
    name: "czech",
    text: "Czech & Slovak + EasyList",
  },
  {
    name: "dutch",
    text: "Dutch + EasyList",
  },
  {
    name: "easylist_plus_french",
    text: "French + EasyList",
  },
  {
    name: "easylist_plus_german",
    text: "German + EasyList",
  },
  {
    name: "easylist_plus_global",
    text: "Global + EasyList",
  },
  {
    name: "israeli",
    text: "Hebrew + EasyList",
  },
  {
    name: "easylist_plus_hungarian",
    text: "Hungarian + EasyList",
  },
  {
    name: "easylist_plus_indian",
    text: "IndianList + EasyList",
  },
  {
    name: "easylist_plus_indonesian",
    text: "Indonesian + EasyList",
  },
  {
    name: "italian",
    text: "Italian + EasyList",
  },
  {
    name: "japanese",
    text: "Japanese",
  },
  {
    name: "easylist_plun_korean",
    text: "Korean",
  },
  {
    name: "latvian",
    text: "Latvian + EasyList",
  },
  {
    name: "easylist_plus_lithuania",
    text: "Lithuanian + EasyList",
  },
  {
    name: "nordic",
    text: "Nordic Filters + EasyList",
  },
  {
    name: "easylist_plus_polish",
    text: "Polish",
  },
  {
    name: "easylist_plus_portuguese",
    text: "Portuguese + EasyList",
  },
  {
    name: "easylist_plus_romanian",
    text: "Romanian + EasyList",
  },
  {
    name: "russian",
    text: "Russian & Ukrainian + EasyList",
  },
  {
    name: "easylist_plus_spanish",
    text: "Spanish",
  },
  {
    name: "turkish",
    text: "Turkish",
  },
  {
    name: "easylist_plus_vietnamese",
    text: "Vietnamese + EasyList",
  },
].map(addTestIdAndCheckboxSelector);

export const defaultFilterLists = [
  {
    name: "acceptable_ads",
    text: "Acceptable Ads",
    enabled: true,
  },
  {
    name: "acceptable_ads_privacy",
    text: "Only allow ads without third-party tracking",
    enabled: false,
  },
  {
    name: "anticircumvent",
    text: "Anti-Circumvention filters",
    enabled: true,
  },
  {
    name: "easylist",
    checkboxSelector: "#adblockFilterList_3",
    text: "EasyList",
    enabled: true,
  },
  {
    name: "free_distraction_control",
    text: "Basic Distraction Control",
    enabled: false,
  },
  {
    name: "warning_removal",
    text: "Adblock Warning Removal list",
    enabled: false,
  },
  {
    name: "antisocial",
    text: "Antisocial filter list",
    enabled: false,
  },
  {
    name: "bitcoin_mining_protection",
    text: "Cryptocurrency (Bitcoin) Mining Protection List",
    enabled: false,
  },
  {
    name: "easyprivacy",
    text: "EasyPrivacy (privacy protection)",
    enabled: false,
  },
  {
    name: "annoyances",
    text: "Fanboy's Annoyances",
    enabled: false,
  },
  {
    name: "fb_notifications",
    text: "Fanboy's Notifications (blocks in-page pop-ups, social media and related widgets, and other annoyances)",
    enabled: false,
  },
].map(addTestIdAndCheckboxSelector);

export const premiumFilterLists = [
  { checkboxSelector: "#distraction-control", text: "Distraction Control" },
  { checkboxSelector: "#cookies-premium", text: "Cookie Consent Cutter" },
].map(addTestId);

export const premiumPopupToggleItems = [
  { name: "cookies-premium", action: "confirmCookie" },
  { name: "distraction-control", action: "confirmDistractions" },
].map(addTestId);

/**
 * The free "Hide AI search summaries" filter list and its popup toggle
 * section, shown once the list is a recommended subscription and the option
 * is rolled out to the user.
 */
export const aiSummariesFilterList = {
  // Not part of defaultFilterLists: the row is hidden outside the rollout
  ...addTestIdAndCheckboxSelector({
    name: "ai_summaries",
    text: "Hide AI search summaries",
    enabled: false,
  }),
  // Popup toggle section (free, with a confirmation page like the premium ones)
  popupSectionSelector: '[data-name="aiSummaries"]',
  popupTitle: "Hide AI Summaries",
  popupSubtitle: "Hide AI-generated summaries in search results",
  popupToggleSelector: '[data-name="ai_summaries"]',
  popupConfirmActionSelector: '[data-action="confirmAiSummaries"] > button',
};
