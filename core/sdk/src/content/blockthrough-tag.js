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
import {v4 as uuidv4} from "uuid";

import {ignoreNoConnectionError} from "../all/errors.js";

let sessionId = null;

function onBTAADetectionEvent(event) {
  if (!sessionId) {
    sessionId = uuidv4();
  }

  ignoreNoConnectionError(
    browser.runtime.sendMessage({
      type: "ewe:blockthrough-acceptable-ads-detection-event",
      details: {
        ab: event.detail.ab,
        acceptable: event.detail.acceptable,
        sessionId
      }
    })
  );
}

export function startWatchingBlockthroughTag() {
  window.addEventListener("BTAADetection", onBTAADetectionEvent);
}
