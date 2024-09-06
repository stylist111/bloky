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

import {isFeatureEnabled} from "adblockpluscore/lib/features.js";
import {Uploader as uploader2} from "./cdp-metrics-uploader-2.js";
import {Uploader as uploader3} from "./cdp-metrics-uploader-3.js";
import {MILLIS_IN_HOUR} from "adblockpluscore/lib/time.js";

const FEATURE_FLAG = "cdpPhase3";

function getUploader() {
  return isFeatureEnabled(FEATURE_FLAG) ? uploader3 : uploader2;
}

/**
 * Starts CDP, which will trigger sending aggregated metrics to the CDP
 * server on a schedule.
 *
 * @param {Object} cdp CDP configuration (URLs, bearer)
 * @param {number} errorRetryDelay
 *        Error retry interval in milliseconds
 * @ignore
 */
export async function start(cdp, errorRetryDelay = 1 * MILLIS_IN_HOUR) {
  await getUploader().start(cdp, errorRetryDelay);
}

/**
 * @ignore
 */
export function stop() {
  // feature flag might be reset, but we might need to stop
  // exactly the uplaoder that was started. Just stopping both.
  uploader2.stop();
  uploader3.stop();
}

/**
 * @ignore
 */
export async function reset() {
  await getUploader().reset();
}
