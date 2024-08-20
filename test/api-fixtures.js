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

import {TEST_PAGES_URL, TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";

export const VALID_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
export const COMMENT_FILTER_TEXT = "!comment";
export const SECOND_VALID_FILTER_TEXT = "another-filter";
export const THIRD_VALID_FILTER_TEXT = "yet-another-filter";

export const emptyDiffResponse = JSON.stringify({
  filters: {
    add: [],
    remove: []
  }
});

// 00000000-0000-0000-0000-00000000000X ids are used separately

// Subscriptions listed in test/scripts/custom-subscriptions.json
export const subTestCustom1 = {
  id: "00000000-0000-0000-0000-000000000010",
  type: "ads",
  title: "Test MV3 Custom Subscription 1",
  homepage: `${TEST_PAGES_URL}/subscription.txt`,
  url: `${TEST_PAGES_URL}/subscription.txt`,
  mv2_url: `${TEST_PAGES_URL}/mv2_subscription.txt`
};

export const subTestCustom2 = {
  id: "00000000-0000-0000-0000-000000000020",
  type: "ads",
  title: "Test MV3 Custom Subscription 2",
  homepage: `${TEST_PAGES_URL}/subscription.txt?2`,
  url: `${TEST_PAGES_URL}/subscription.txt?2`,
  mv2_url: `${TEST_PAGES_URL}/mv2_subscription.txt?2`
};

export const subTestCustom3 = {
  id: "00000000-0000-0000-0000-000000000030",
  type: "ads",
  title: "Test MV3 Custom Subscription 3",
  homepage: `${TEST_ADMIN_PAGES_URL}/subscription.txt`,
  url: `${TEST_ADMIN_PAGES_URL}/subscription.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/mv2_subscription.txt`
};

export const subTestNoDNR = {
  id: "00000000-0000-0000-0000-000000000040",
  type: "ads",
  title: "Non DNR filters",
  homepage: `${TEST_ADMIN_PAGES_URL}/subscription-that-shouldnt-be-moved-to-dnr-world.txt`,
  url: `${TEST_ADMIN_PAGES_URL}/subscription-that-shouldnt-be-moved-to-dnr-world.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/mv2_subscription-that-shouldnt-be-moved-to-dnr-world.txt`
};

export const subTestUpdatable1 = {
  id: "00000000-0000-0000-0000-000000000050",
  type: "ads",
  title: "Test MV3 Diff Updatable Subscription 1",
  homepage: `${TEST_ADMIN_PAGES_URL}/updatable_subscription.txt`,
  url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/mv2_updatable_subscription.txt`,
  diff_url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/diff.json`,
  expires: "1 day",
  privileged: true
};

export const subTestAllowingFilter = {
  id: "00000000-0000-0000-0000-000000000070",
  type: "allowing",
  title: "Subscription that contains allowing filter for tests",
  homepage: "TestsAllowingFilterAndSubscription",
  url: `${TEST_PAGES_URL}/subscription-with-allowing-filter.txt`,
  mv2_url: `${TEST_PAGES_URL}/mv2_subscription-with-allowing-filter.txt`
};

export const subAntiCVLocal = {
  id: "00000000-0000-0000-0000-000000000100",
  type: "circumvention",
  title: "ABP filters (localhost)",
  homepage: "https://github.com/abp-filters/abp-filters-anti-cv",
  url: `${TEST_ADMIN_PAGES_URL}/anti-cv-subscription.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/mv2_anti-cv-subscription.txt`,
  diff_url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/diff.json`
  // no ".expires" property provided
};

export const subEasylistLocal = {
  id: "00000000-0000-0000-0000-000000000110",
  type: "ads",
  languages: ["en"],
  title: "EasyList (localhost)",
  homepage: "https://easylist.to/",
  url: `${TEST_ADMIN_PAGES_URL}/easylist.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/easylist.txt`,
  diff_url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/diff.json`
};

export const subAcceptableAdsLocal = {
  id: "00000000-0000-0000-0000-000000000120",
  type: "allowing",
  title: "Allow nonintrusive advertising (localhost)",
  homepage: "https://acceptableads.com/",
  url: `${TEST_ADMIN_PAGES_URL}/exceptionrules.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/exceptionrules.txt`,
  diff_url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/diff.json`
};

// Subscriptions listed in core/data/subscriptions.json

export const subIDontCareAboutCookiesLive = {
  id: "2090F374-29D9-4202-B2CE-139D6492D95E",
  type: "cookies",
  title: "I don't care about cookies",
  homepage: "https://www.i-dont-care-about-cookies.eu/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/i_dont_care_about_cookies.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/i_dont_care_about_cookies.txt",
  diff_url: "https://easylist-downloads.adblockplus.org/v3/diff/i_dont_care_about_cookies/439310a08bc1994e4f9365bd15b3beb975788876.json"
};

// Subscriptions listed in test/scripts/custom-subscriptions.json and
// core/data/subscriptions.json

export const subEasylistLive = {
  id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
  type: "ads",
  languages: ["en"],
  title: "EasyList",
  homepage: "https://easylist.to/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt",
  diff_url: "https://easylist-downloads.adblockplus.org/v3/diff/easylist/439310a08bc1994e4f9365bd15b3beb975788876.json"
};

export const subEasylistPlusGermanyLive = {
  id: "0CD3D105-D3B3-4652-8489-94163DE9A08F",
  type: "ads",
  languages: [
    "de"
  ],
  title: "EasyList Germany+EasyList",
  homepage: "https://easylist.to/",
  includes: [
    "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
    "4337FB2B-A95C-44D5-B78D-11AD40F7711B"
  ],
  url: "https://easylist-downloads.adblockplus.org/v3/full/easylistgermany+easylist.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"
};

export const subAcceptableAdsLive = {
  id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
  type: "allowing",
  title: "Allow nonintrusive advertising",
  homepage: "https://acceptableads.com/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
  diff_url: "https://easylist-downloads.adblockplus.org/v3/diff/exceptionrules/439310a08bc1994e4f9365bd15b3beb975788876.json"
};

export const subAntiCVLive = {
  id: "D4028CDD-3D39-4624-ACC7-8140F4EC3238",
  type: "circumvention",
  title: "ABP filters",
  homepage: "https://github.com/abp-filters/abp-filters-anti-cv",
  url: "https://easylist-downloads.adblockplus.org/v3/full/abp-filters-anti-cv.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt",
  diff_url: "https://easylist-downloads.adblockplus.org/v3/diff/abp-filters-anti-cv/439310a08bc1994e4f9365bd15b3beb975788876.json"
};

// Subscriptions not listed anywhere else
export const subTestUpdatable2 = {
  id: "00000000-0000-0000-0000-000000000060",
  type: "ads",
  title: "Test MV3 Diff Updatable Subscription 2",
  homepage: `${TEST_ADMIN_PAGES_URL}/subscription.txt`,
  url: `${TEST_ADMIN_PAGES_URL}/subscription2.txt`,
  mv2_url: `${TEST_ADMIN_PAGES_URL}/subscription2.txt`,
  diff_url: `${TEST_ADMIN_PAGES_URL}/subscription_diff2.json`
};
