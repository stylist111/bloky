/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { prefs } from "./context";

/**
 * Constructs a URL based on the given URL and a trusted origin. If `url` is
 * relative, the given origin is used. If `url` is absolute, it's origin will
 * be checked whether it matches the trusted origin.
 *
 * @param url The URL to create the safe origin URL from. Can be relative
 *   or absolute
 *
 * @returns An absolute URL with a trusted origin, or `null` if creating a
 *   safe origin URL was not possible, or if origins did not match.
 */
export function createSafeOriginUrl(url: string): string | null {
  const defaultOrigin: string = prefs.get("ipm_default_origin");
  const safeOrigins: string[] = prefs.get("ipm_safe_origins");
  let safeOriginUrl: URL;

  try {
    // If the url is relative, it will use the default origin
    safeOriginUrl = new URL(url, defaultOrigin);
  } catch (ex) {
    return null;
  }

  // Verify that provided URL origin is in the list of trusted origins
  if (!safeOrigins.includes(safeOriginUrl.origin)) {
    return null;
  }

  return safeOriginUrl.href;
}

/**
 * Parses the domains part of a filter text
 * (e.g. `example.com,~mail.example.com`) into a `Map` object.
 *
 * @param source The domains part of a filter text.
 * @param separator The string used to separate two or more domains in
 *   the domains part of a filter text.
 *
 * @returns A map
 */
function parseDomains(
  source: string,
  separator: string,
): Map<string, boolean> | null {
  let domains;

  if (source[0] !== "~" && !source.includes(separator)) {
    // Fast track for the common one-domain scenario.
    domains = new Map([
      ["", false],
      [source, true],
    ]);
  } else {
    domains = null;

    let hasIncludes = false;
    for (let domain of source.split(separator)) {
      if (domain === "") {
        continue;
      }

      let include;
      if (domain[0] === "~") {
        include = false;
        domain = domain.substring(1);
      } else {
        include = true;
        hasIncludes = true;
      }

      if (!domains) {
        domains = new Map();
      }

      domains.set(domain, include);
    }

    if (domains) {
      domains.set("", !hasIncludes);
    }
  }

  return domains;
}

/**
 * Checks whether a given address is a valid IPv4 address.
 *
 * Only a normalized IPv4 address is considered valid. e.g. `0x7f.0x0.0x0.0x1`
 * is invalid, whereas `127.0.0.1` is valid.
 *
 * @param address The address to check.
 *
 * @returns Whether the address is a valid IPv4 address.
 */
function isValidIPv4Address(address: string): boolean {
  return /^(((2[0-4]|1[0-9]|[1-9])?[0-9]|25[0-5])\.){4}$/.test(address + ".");
}

/**
 * Checks whether a given hostname is valid.
 *
 * This function is used for filter validation.
 *
 * A hostname occurring in a filter must be normalized. For example,
 * <code>&#x1f642;</code> (slightly smiling face) should be normalized to
 * `xn--938h`; otherwise this function returns `false` for such a hostname.
 * Similarly, IP addresses should be normalized.
 *
 * @param hostname The hostname to check.
 *
 * @returns Whether the hostname is valid.
 */
function isValidHostname(hostname: string): boolean {
  if (isValidIPv4Address(hostname)) {
    return true;
  }

  // This does not in fact validate the IPv6 address but it's alright for now.
  if (hostname[0] === "[" && hostname[hostname.length - 1] === "]") {
    return true;
  }

  // Based on
  // https://en.wikipedia.org/wiki/Hostname#Restrictions_on_valid_hostnames
  if (hostname[hostname.length - 1] === ".") {
    hostname = hostname.substring(0, hostname.length - 1);
  }

  if (hostname.length > 253) return false;

  const labels = hostname.split(".");

  for (const label of labels) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) return false;
  }

  // Based on https://tools.ietf.org/html/rfc3696#section-2
  if (!/\D/.test(labels[labels.length - 1])) return false;

  return true;
}

/**
 * Checks whether a comma separated list of domains using the filter
 * format (e.g. `example.com,~mail.example.com`) contains valid entries.
 *
 * @param list The list to check
 * @returns whether the given list is a valid domain list
 */
export function isDomainList(list: string): boolean {
  const domains = parseDomains(list, ",");

  if (domains === null) {
    // This means the list was empty, what we consider valid
    return true;
  }

  return Array.from(domains.keys()).every(
    (domain) => !domain || isValidHostname(domain),
  );
}
