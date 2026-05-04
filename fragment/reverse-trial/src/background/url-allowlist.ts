/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Validates that a URL is safe to navigate to from the reverse-trial
 * dialog: https, no embedded credentials, and an exact hostname match
 * against the host-provided allowlist.
 *
 * Used in two places:
 * - config load time, so PMs cannot ship configs pointing to untrusted
 *   hosts, and
 * - runtime after URL-template substitution, as defense-in-depth against
 *   a future template variable that could change the hostname.
 *
 * Subdomain matching is deliberately rejected — every allowlisted host
 * must be listed explicitly to prevent a subdomain takeover from
 * silently gaining trust.
 */
export function isUrlAllowed(url: string, allowedUrlHosts: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return false;
  }
  return allowedUrlHosts.includes(parsed.hostname.toLowerCase());
}
