/**
* This file is part of eyeo's browser extension host
 * debug information fragment,
 * Copyright (C) 2025-present eyeo GmbH

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

import { type UserAgentInfo, BrowserName } from "./user-agent-info.types";

let info: UserAgentInfo;

function parseUserAgent(): UserAgentInfo {
  let browserName = BrowserName.unknown; // default to Unknown
  // RegEx to obtain the OS and OS Version
  let match = navigator.userAgent.match(
    /(CrOS \w+|Windows NT|Mac OS X|Linux|Android) ([\d._]+)?/,
  );
  const os = (match ?? [])[1] ?? "Unknown";
  const osVersion = (match ?? [])[2] ?? "Unknown";
  // RegEx for the Chrome browser version
  const chromeMatch = navigator.userAgent.match(/(?:Chrome|Version)\/([\d.]+)/);
  // RegEx for the Edge browser
  const edgeMatch = navigator.userAgent.match(/(?:Edg|Version)\/([\d.]+)/);
  // RegEx for the Firefox browser
  const firefoxMatch = navigator.userAgent.match(/(?:Firefox)\/([\d.]+)/);
  // RegEx for the Opera browser version
  const operaMatch = navigator.userAgent.match(/(?:OPR|Version)\/([\d.]+)/);
  if (edgeMatch) {
    match = edgeMatch;
    browserName = BrowserName.edge;
  } else if (firefoxMatch) {
    match = firefoxMatch;
    browserName = BrowserName.firefox;
  } else if (operaMatch) {
    match = operaMatch;
    browserName = BrowserName.opera;
  } else if (chromeMatch) {
    match = chromeMatch;
    browserName = BrowserName.chrome;
  }
  const browserVersion = (match ?? [])[1] ?? "Unknown";

  return {
    browserName,
    os,
    osVersion,
    browserVersion,
  };
}

export function getUserAgentInfo(): UserAgentInfo {
  if (!info) {
    info = parseUserAgent();
  }
  return info;
}
