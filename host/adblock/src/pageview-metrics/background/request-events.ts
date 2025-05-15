/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
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

import { Prefs } from "~/alias/prefs";
import ServerMessages from "~/servermessages";
import { getMatchingDomain } from "./domains";
import { type RequestOriginDetails } from "./request-events.types";

/**
 * Configuration specifying which requests to record metrics for.
 */
const requestFilter = {
  urls: [],
};

/**
 * Determines domain from which the given request originated.
 *
 * @param details - Request details
 * @returns domain from which the given request originated
 *   (or null, if it cannot be determined)
 */
function getOriginDomain(details: RequestOriginDetails): string | null {
  const url = details.initiator ?? details.documentUrl ?? details.originUrl;
  if (!url) {
    return null;
  }

  return new URL(url).hostname;
}

/**
 * Records metrics related to outgoing requests.
 *
 * @param originDomain - Domain from which the request originated
 */
async function recordRequestCreated(originDomain: string | null): Promise<void> {
  const domain = await getMatchingDomain(originDomain);
  if (!domain) {
    return;
  }

  ServerMessages.recordAnonymousMessage("request_created", "stats", null, {
    misc_text: domain,
  });
}

/**
 * Records metrics related to completed requests.
 *
 * @param originDomain - Domain from which the request originated
 */
async function recordRequestCompleted(originDomain: string | null): Promise<void> {
  const domain = await getMatchingDomain(originDomain);
  if (!domain) {
    return;
  }

  ServerMessages.recordAnonymousMessage("request_completed", "stats", null, {
    misc_text: domain,
  });
}

/**
 * Records metrics related to failing requests.
 *
 * @param originDomain - Domain from which the request originated
 * @param error - Error message
 */
async function recordRequestFailed(originDomain: string | null, error: string): Promise<void> {
  const domain = await getMatchingDomain(originDomain);
  if (!domain) {
    return;
  }

  ServerMessages.recordAnonymousMessage("request_failed", "stats", null, {
    error_msg: error,
    misc_text: domain,
  });
}

/**
 * Initializes functionality to record request metrics.
 */
export async function start(): Promise<void> {
  await Prefs.untilLoaded;
  requestFilter.urls = Prefs.get("pageviewMetrics_requestUrls");

  browser.webRequest.onBeforeRequest.addListener((details) => {
    const originDomain = getOriginDomain(details);
    void recordRequestCreated(originDomain);
    return {};
  }, requestFilter);

  browser.webRequest.onCompleted.addListener((details) => {
    const originDomain = getOriginDomain(details);

    if (details.statusCode >= 400 && details.statusCode <= 599) {
      void recordRequestFailed(originDomain, `HTTP ${details.statusCode}`);
      return;
    }

    void recordRequestCompleted(originDomain);
  }, requestFilter);

  browser.webRequest.onErrorOccurred.addListener((details) => {
    const originDomain = getOriginDomain(details);
    void recordRequestFailed(originDomain, details.error);
  }, requestFilter);
}
