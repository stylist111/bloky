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
import {addonName, addonVersion} from "./info.js";

const TELEMETRY_STORAGE_KEY = "ewe:telemetry";

let started = false;

export function start(telemetry) {
  if (!telemetry.url) {
    throw new Error("No telemetry `url` provided");
  }

  if (!telemetry.bearer) {
    throw new Error("No telemetry `bearer` provided");
  }

  if (started) {
    return;
  }
  started = true;

  ping(telemetry).catch(console.error);
}

export async function reset() {
  stop();
  await browser.storage.local.remove(TELEMETRY_STORAGE_KEY);
}

export function stop() {
  started = false;
}

async function ping(telemetry) {
  const storageResult = await browser.storage.local.get(
    [TELEMETRY_STORAGE_KEY]
  );
  const telemetryStorage = storageResult[TELEMETRY_STORAGE_KEY];

  if (telemetryStorage && telemetryStorage.firstPing) {
    return;
  }

  const pingToken = await fetchWithBearerToken(
    telemetry.url,
    telemetry.bearer,
    {
      extension_name: addonName,
      extension_version: addonVersion
    }
  );

  await browser.storage.local.set({
    [TELEMETRY_STORAGE_KEY]: {
      firstPing: pingToken
    }
  });
}

async function fetchWithBearerToken(url, token, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Telemetry error. Server responsed with the following status: ${response.status}`
    );
  }

  const data = await response.json();
  let pingToken = data.token;

  if (!pingToken) {
    throw new Error("Telemetry error. Server response did not include a token.");
  }

  return pingToken;
}
