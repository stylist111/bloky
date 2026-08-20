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

import browser from "./browser.js";

import {PersistentState} from "./persistence.js";
import sentry from "./sentry.js";
import {warn} from "./debugging.js";
import {getClientId, getSyncStatus} from "./remote-config/storage.js";

let clientIdData = new PersistentState("ewe:client_ids", browser.storage.local);

const MIN_ENTRIES_FOR_STABILITY = 20;
const MIN_DAYS_FOR_STABILITY = 3;
const ROTATION_BLIP_TOLERANCE_DAYS = 2;

/**
 * @ignore
 */
export async function reset() {
  clientIdData.clearState();
  await clientIdData.save();
}

/**
 * Add the last client ID to the client ID history
 *
 * @ignore
 * @returns {Promise<void>}
 */
export async function sync() {
  try {
    const lastClientId = await getClientId();
    const lastSyncStatus = await getSyncStatus();
    const state = await clientIdData.getStateLoaded();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const clientIds = (state.clientIds || []).filter(
      entry => new Date(entry.date) > thirtyDaysAgo
    );

    if (lastSyncStatus.lastDownloaded && lastClientId) {
      // Bucket by lastDownloaded's own hour, not the real current hour -
      // otherwise a stale lastDownloaded (e.g. downloads failing) would
      // never match the "current" bucket and we'd keep re-adding the
      // same stale entry on every sync.
      const downloadedHour = lastSyncStatus.lastDownloaded.slice(0, 13);
      const alreadyRecordedThisHour = clientIds.some(
        entry => entry.date.startsWith(downloadedHour)
      );
      if (!alreadyRecordedThisHour) {
        clientIds.push({
          date: lastSyncStatus.lastDownloaded,
          clientId: lastClientId
        });
      }
    }

    state.clientIds = clientIds;
    await clientIdData.save();
  }
  catch (e) {
    warn(`Error while synchronizing client IDs: ${e.message}`);
    sentry.reportError(e);
  }
}

/**
 * Retrieves the client ID history.
 *
 * @ignore
 * @returns {Promise<Array<{date: string, clientId: string}>>}
 */
export async function getClientIds() {
  const state = await clientIdData.getStateLoaded();
  return state.clientIds || [];
}

function hasSufficientHistory(history) {
  if (history.length < MIN_ENTRIES_FOR_STABILITY) {
    return false;
  }

  const days = new Set();
  for (const entry of history) {
    days.add(entry.date.slice(0, 10));
  }
  return days.size >= MIN_DAYS_FOR_STABILITY;
}

/**
 * Computes how stable the client's IP address hash has been recently:
 * the frequency of the most common client ID in the history, as a
 * percentage of all entries. Returns 0 if there isn't enough history yet
 * to draw a conclusion (fewer than 20 entries, or the entries don't span
 * at least 3 distinct days).
 *
 * @ignore
 * @returns {Promise<number>}
 */
export async function getClientIdStability() {
  const history = await getClientIds();

  if (!hasSufficientHistory(history)) {
    return 0;
  }

  const counts = new Map();
  for (const entry of history) {
    counts.set(entry.clientId, (counts.get(entry.clientId) || 0) + 1);
  }

  const mostCommonCount = Math.max(...counts.values());
  return (mostCommonCount / history.length) * 100;
}

function getDaySpan(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const start = new Date(startDate.slice(0, 10));
  const end = new Date(endDate.slice(0, 10));
  return Math.round((end - start) / oneDay) + 1;
}

// Groups history into runs per client ID, then absorbs short blips that
// flicker back to the same ID (A -> blip -> A). A short run followed by a
// different ID (A -> blip -> C) still counts as a real rotation.
function buildRuns(history) {
  const runs = [];
  for (const entry of history) {
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.clientId === entry.clientId) {
      lastRun.endDate = entry.date;
    }
    else {
      runs.push({
        clientId: entry.clientId,
        startDate: entry.date,
        endDate: entry.date
      });
    }
  }

  const merged = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const prev = merged[merged.length - 1];
    const next = runs[i + 1];
    const isBlip =
      getDaySpan(run.startDate, run.endDate) <= ROTATION_BLIP_TOLERANCE_DAYS;

    if (isBlip && prev && next && prev.clientId === next.clientId) {
      prev.endDate = next.endDate;
      i++;
      continue;
    }
    merged.push({...run});
  }

  return merged;
}

/**
 * Computes how often the client's IP address hash rotates in days
 * Returns 0 if there isn't enough history yet or no rotation was observed.
 *
 * @ignore
 * @returns {Promise<number>}
 */
export async function getClientIdRotationFrequency() {
  const history = await getClientIds();

  if (!hasSufficientHistory(history)) {
    return 0;
  }

  const runs = buildRuns(history);
  const numRotations = runs.length - 1;
  if (numRotations <= 0) {
    return 0;
  }

  const completedRuns = runs.slice(1, -1);
  if (completedRuns.length > 0) {
    const avgDays = completedRuns.reduce(
      (sum, run) => sum + getDaySpan(run.startDate, run.endDate), 0
    ) / completedRuns.length;
    return Math.max(1, Math.round(avgDays));
  }

  const lastDate = history[history.length - 1].date;
  const totalSpanDays = getDaySpan(history[0].date, lastDate);
  return Math.max(1, Math.round(totalSpanDays / numRotations));
}
