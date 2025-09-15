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

import browser from "webextension-polyfill";

const productMap = {
  adblock: "ab",
  adblockplus: "abp",
  testing: "ewe-test"
};

const manifest = browser.runtime.getManifest();
const extName = manifest && manifest.short_name;
const normalized =
  (extName || "").toLowerCase().replace(/\s+/g, "");
const productPrefix = productMap[normalized] || productMap.testing;

/**
 * Name of the portal used for the login.
 * @type {string}
 */
export const PORTAL_NAME = `${productPrefix}-portal`;

/**
 * Map of header names used for the account API.
 */
export const HEADERS = {
  X_APPLICATION_NAME: "X-Application-Name",
  X_ACCESS_TOKEN: "X-Access-Token",
  X_REFRESH_TOKEN: "X-Refresh-Token",
  X_APPLICATION_ID: "X-Application-ID",
  AUTHORIZATION: "Authorization"
};

/**
 * Map of feature identifiers used in the account management API.
 * @type {{PREMIUM: string}}
 */
export const FEATURES = {
  PREMIUM: `${productPrefix}_premium`
};

/**
 * Available paths for the account management API.
 * @type {Object}
 */
export const ACCOUNT_PATHS = {
  PROFILE: "/profile",
  REFRESH_TOKENS: "/token/refresh",
  LICENSE_LOGIN: `/migration/login-${productPrefix}`
};
