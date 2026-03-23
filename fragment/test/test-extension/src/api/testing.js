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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import {
  reverseTrialPrefs,
  setIsPremium,
} from "../modules/reverse-trial-init.js";

export async function triggerHandler(port, [eventName, eventData, senderData]) {
  try {
    if (!port || !port.__registry) {
      return { error: "Port or registry is not defined" };
    }

    const handler = port.__registry[eventName];
    if (typeof handler === "function") {
      handler(eventData, senderData);
      return { ok: true };
    }

    return { error: `Handler not found: ${eventName}` };
  } catch (error) {
    return { error: `Error triggering handler: ${error.message}` };
  }
}

export async function getRegisteredHandlers(port) {
  try {
    if (!port || !port.__registry) {
      return [];
    }
    return Object.keys(port.__registry);
  } catch (error) {
    return [];
  }
}

export async function ping() {
  return true;
}

export async function setReverseTrialPref([key, value]) {
  reverseTrialPrefs.set(key, value);
  return { ok: true };
}

export async function getReverseTrialPref([key]) {
  return reverseTrialPrefs.get(key);
}

export async function enableReverseTrialExperiment() {
  await ewe.experiments.overrideFlag("show-reverse-trial-opd", true);
  return { ok: true };
}

export async function setReverseTrialIsPremium([value]) {
  setIsPremium(value);
  return { ok: true };
}
