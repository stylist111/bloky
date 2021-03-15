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

import browser from "webextension-polyfill";

import {filterEngine} from "../../adblockpluscore/lib/filterEngine.js";
import {synchronizer} from "../../adblockpluscore/lib/synchronizer.js";
import {notifications as _notifications}
  from "../../adblockpluscore/lib/notifications.js";

import * as frameState from "./frame-state.js";
import * as requestFilter from "./request-filter.js";
import * as messageResponder from "./message-responder.js";
import * as popupBlocker from "./popup-blocker.js";
import {configureDefaultSubscriptions} from "./default-subscriptions.js";

export {onSubscribeLinkClicked} from "./subscribe-links.js";
export {default as subscriptions} from "./subscriptions.js";
export {default as filters} from "./filters.js";
export {onFilterMatch} from "./diagnostics.js";

/**
 * The notifications API (only used by Adblock Plus).
 * @see {@link https://eyeo.gitlab.io/adblockplus/adblockpluscore/master/docs/module-notifications.html|Adblock Plus core notifications documentation}
 * @external
 */
// Workaround for documentation.js to parse the JSDocs above
// https://github.com/documentationjs/documentation/issues/1363
export let notifications = _notifications;

let stopped = true;

/**
 * Initializes the filter engine and starts blocking content.
 * @return {Promise.<undefined>}
 */
export async function start()
{
  stopped = false;

  notifications.locale = browser.i18n.getUILanguage();
  notifications.start();
  await filterEngine.initialize();

  if (stopped)
    return;

  synchronizer.start();
  configureDefaultSubscriptions();
  await frameState.start();

  if (stopped)
    return;

  requestFilter.start();
  popupBlocker.start();
  messageResponder.start();
}

/**
 * Stops blocking any content.
 * @return {undefined}
 */
export function stop()
{
  stopped = true;
  synchronizer.stop();
  frameState.stop();
  requestFilter.stop();
  popupBlocker.stop();
  messageResponder.stop();
  notifications.stop();
}
