/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { MILLIS_IN_DAY } from "../../shared/constants.js";
import {
  getBaseDomain,
  domainSuffixes,
} from "@eyeo/webext-ad-filtering-solution/adblockpluscore/lib/url.js";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

/**
 * Verifies if the expiration timestamp is valid
 *
 * @param {number} expiresAt - The expiration timestamp.
 * @returns {boolean}
 */
function verifyExpiresAt(expiresAt) {
  if (!Number.isInteger(expiresAt)) {
    throw new Error("Expiration must be an integer.");
  }

  const now = Date.now();
  const minExpiresAt = now + MILLIS_IN_DAY;
  const maxExpiresAt = now + 365 * MILLIS_IN_DAY;

  if (expiresAt < minExpiresAt || expiresAt > maxExpiresAt) {
    throw new Error("Expiration must be between 1 and 365 days from now.");
  }

  return true;
}

/**
 * Validates whether a given partial domain is a string and a valid
 * subdomain of the specified hostname.
 *
 * A partial domain is considered valid if it is a non-empty string
 * and is a substring of the provided hostname.
 *
 * Example:
 * - `test.com` is a valid partial domain for `something.test.com`.
 *
 * @param {string} hostname - The full hostname of the current tab.
 * @param {string} partialDomain - The partial domain to be validated.
 * @throws {Error} - Throws an error if the partial domain is not a string or is invalid.
 */
function throwIfInvalidPartialDomain(hostname, partialDomain) {
  if (typeof partialDomain !== "string") {
    throw new Error("Partial domain must be a string");
  }

  const baseDomain = getBaseDomain(hostname);

  for (let suffix of domainSuffixes(hostname)) {
    if (suffix === partialDomain) {
      return;
    }

    // Allow at least TLD+1
    if (suffix === baseDomain) {
      throw new Error("Invalid partial domain.");
    }
  }

  throw new Error("Invalid partial domain.");
}

/**
 * Handles the allowlisting of a website.
 *
 * @param {Object} params - Input parameter
 * @param {Number} [params.expiresAt] - The expiration timestamp in milliseconds.
 *    Must be between 1 and 365 days from now.
 * @param {string} [params.partialDomain] - The partial domain to allowlist.
 *    Must be a partial domain of the current tab hostname.
 *    If not sent, the hostname will be allowlisted
 * @returns {Promise<Object>} - The metadata result of the allowlisting command
 */
export async function allowlistWebsite({ expiresAt, partialDomain } = {}) {
  const metadata = {
    origin: "web",
    created: Date.now(),
  };

  if (expiresAt && verifyExpiresAt(expiresAt)) {
    metadata.expiresAt = expiresAt;
  }

  const parsedUrl = new URL(this.sender.tab.url);
  const { hostname } = parsedUrl;

  if (partialDomain) {
    throwIfInvalidPartialDomain(hostname, partialDomain);

    await ewe.filters.add([`@@||${partialDomain}^$document`], metadata);
  } else {
    await ewe.filters.add([`@@||${hostname}^$document`], metadata);
  }

  return {
    ...metadata,
    status: true,
  };
}
