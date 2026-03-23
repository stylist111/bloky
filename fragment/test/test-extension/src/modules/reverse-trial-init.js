/**
 * This file is part of eyeo's Fragment Test Extension,
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

import browser from "webextension-polyfill";
import { start as startReverseTrial } from "@eyeo-fragments/reverse-trial/background";
import * as mocks from "./mocks.js";

export const reverseTrialPrefs = {
  _data: {
    reverse_trial_step: 0,
  },
  get(key) {
    return this._data[key] ?? 0;
  },
  set(key, value) {
    this._data[key] = value;
  },
};

let premiumActive = false;

export function setIsPremium(value) {
  premiumActive = value;
}

export async function startReverseTrialFragment() {
  startReverseTrial({
    addTrustedMessageTypes: mocks.addTrustedMessageTypes,
    prefs: reverseTrialPrefs,
    port: mocks.port,
    logoUrl: browser.runtime.getURL("icons/adblock-20.svg"),
    premiumUrl: "https://example.com",
    hasPremium: () => Promise.resolve(premiumActive),
    isOptedOut: () => Promise.resolve(false),
    addonVersion: "1.0.0",
  });
  return { reverseTrialPrefs };
}
