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
import {EventEmitter} from "../../adblockpluscore/lib/events.js";

const KEY_PREFIX = "abp:pref:";

let eventEmitter = new EventEmitter();
let overrides = new Map();
let defaults = new Map([
  ["analytics", {trustedHosts: ["adblockplus.org",
                                "notification.adblockplus.org",
                                "easylist-downloads.adblockplus.org"]}],
  ["notificationdata", {}],
  ["blocked_total", 0],
  ["show_statsinpopup", true],
  ["notificationurl", "https://notification.adblockplus.org/notification.json"],
  ["subscriptions_exceptionsurl", "https://easylist-downloads.adblockplus.org/exceptionrules.txt"],
  ["notifications_ignoredcategories", []],
  ["elemhide_debug", false]
]);

export let Prefs = {
  on(preference, callback)
  {
    eventEmitter.on(preference, callback);
  },
  off(preference, callback)
  {
    eventEmitter.off(preference, callback);
  }
};

function keyToPref(key)
{
  return key.startsWith(KEY_PREFIX) ? key.substr(KEY_PREFIX.length) : null;
}

function prefToKey(pref)
{
  return `${KEY_PREFIX}${pref}`;
}

function addPreference(preference)
{
  Object.defineProperty(Prefs, preference, {
    get()
    {
      return (overrides.has(preference) ? overrides : defaults).get(preference);
    },
    set(value)
    {
      let key = prefToKey(preference);
      if (value === defaults.get(preference))
      {
        overrides.delete(preference);
        browser.storage.local.remove(key);
        return;
      }

      overrides.set(preference, value);
      browser.storage.local.set({[key]: value});
    },
    enumerable: true
  });
}

function onChanged(changes, areaName)
{
  if (areaName != "local")
    return;

  for (let key in changes)
  {
    let pref = keyToPref(key);
    if (pref && defaults.has(pref))
    {
      let change = changes[key];
      if ("newValue" in change && change.newValue != defaults.get(pref))
        overrides.set(pref, change.newValue);
      else
        overrides.delete(pref);

      eventEmitter.emit(pref);
    }
  }
}

async function init()
{
  let prefs = Array.from(defaults.keys());
  prefs.forEach(addPreference);

  let items = await browser.storage.local.get(prefs.map(prefToKey));
  for (let key in items)
    overrides.set(keyToPref(key), items[key]);

  browser.storage.onChanged.addListener(onChanged);
}

init();
