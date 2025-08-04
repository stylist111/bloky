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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { allowlist } from "../../../adblockpluschrome/lib/allowlisting";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import * as premium from "../../premium/background";
import { FilterOrigin } from "~/filters/shared";

export const trustedDomains = [
  "softonic-ar.com",
  "softonic-id.com",
  "softonic-th.com",
  "softonic.cn",
  "softonic.com",
  "softonic.com.br",
  "softonic.com.tr",
  "softonic.jp",
  "softonic.kr",
  "softonic.nl",
  "softonic.pl",
  "softonic.ru",
  "softonic.vn",
  "softoniclabs.com",
  "fandom.com"
];

/**
 * Return a domain to allowlist based on the hostname
 *
 * @param hostname - hostname to parse
 */
export function getAllowlistingDomain(hostname: string): string {
  // if the hostname is a trusted domain, or a subdomain of a trusted domain,
  // allowlist the root domain, this way we allowlist all subdomains as well.
  for (const trustedDomain of trustedDomains) {
    if (hostname.endsWith(`.${trustedDomain}`) || hostname === trustedDomain) {
      return trustedDomain;
    }
  }

  return hostname.replace(/^www\./, "");
}

/**
 * Function to be called when a valid allowlisting request was received
 *
 * @param domain - Domain to allowlist
 *  @param options Additional options for the allowlisting.
 *  @param options.expiresAt The timestamp when the filter should
 *  expire (allowed 1 day - 365 days in the future).
 *
 */
export async function onAllowlisting(
  domain: string,
  options: ewe.AllowlistingOptions
): Promise<void> {
  if ((await premium.getPremiumState()).isActive) return;

  await allowlist({
    hostname: getAllowlistingDomain(domain),
    origin: FilterOrigin.web,
    expiresAt: options?.expiresAt
  });
}

/**
 * Remove all web based allowlisting filters
 */
async function removeWebAllowlistingFilters(): Promise<void> {
  const allowlistingFilters = (await ewe.filters.getUserFilters()).filter(
    (filter) => filter.type === "allowing"
  );

  const allowlistingFiltersWithMetadata = await Promise.all(
    allowlistingFilters.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return { filter, metadata };
    })
  );

  const webAllowlistingFilters = allowlistingFiltersWithMetadata
    .filter(({ metadata }) => metadata && metadata.origin === FilterOrigin.web)
    .map(({ filter }) => filter);

  await ewe.filters.remove(webAllowlistingFilters.map((filter) => filter.text));
}

/**
 * Initializes experimental allowlisting API
 */
export async function start(): Promise<void> {
  // Make sure the storage was loaded before updating authorized keys and
  // reading the premium state
  await Prefs.untilLoaded;

  const authorizedKeys = Prefs.get("allowlisting_authorizedKeys") as string[];
  void ewe.allowlisting.setAuthorizedKeys(authorizedKeys);
  ewe.allowlisting.setAllowlistingCallback(onAllowlisting);

  if ((await premium.getPremiumState()).isActive) {
    void removeWebAllowlistingFilters();
  }

  premium.emitter.on("activated", async () => {
    void ewe.allowlisting.setAuthorizedKeys([]);
    void removeWebAllowlistingFilters();
  });

  premium.emitter.on("deactivated", () => {
    void ewe.allowlisting.setAuthorizedKeys(authorizedKeys);
  });
}
