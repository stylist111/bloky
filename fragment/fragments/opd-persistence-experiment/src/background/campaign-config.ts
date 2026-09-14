/*
 * This file is part of eyeo's OPD Persistence Experiment fragment,
 * Copyright (C) 2026-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
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
  CAMPAIGN_CONFIG_FLAG_PREFIX,
  type CampaignConfig,
} from "../shared/campaign-config.types.js";

/**
 * Logger provided by the host, so this fragment's warnings and debug output
 * go through whatever logging/reporting the host itself uses instead of the
 * bare console.
 */
export interface Logger {
  debug: (...data: unknown[]) => void;
  warn: (...data: unknown[]) => void;
}

/**
 * Logger provided by the host via `start()`
 */
let logger: Logger;

/**
 * Campaign configurations, by IPM ID
 */
const knownConfigs = new Map<string, CampaignConfig>();

/**
 * Highest impression cap a campaign can be given. Beyond this the dialog stops
 * being an experiment and starts being a permanent fixture, so a value above it
 * is treated as a misconfiguration rather than an intent.
 */
const maxImpressionsCeiling = 20;

/**
 * Checks whether given candidate is a non-null object
 *
 * @param candidate - Candidate
 *
 * @returns whether candidate is a non-null object
 */
function isObject(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === "object" && candidate !== null;
}

/**
 * Checks whether given candidate is a valid impression cap. Zero is rejected
 * because the timing configuration reads a maximum display count of zero as
 * "unlimited", so accepting it would turn a misconfigured campaign into one
 * that never stops being shown.
 *
 * @param candidate - Candidate
 *
 * @returns whether candidate is a valid impression cap
 */
function isMaxImpressions(candidate: unknown): candidate is number {
  return (
    Number.isInteger(candidate) &&
    (candidate as number) >= 1 &&
    (candidate as number) <= maxImpressionsCeiling
  );
}

/**
 * Extracts the campaign configuration from the given flag entry
 *
 * @param entry - Flag entry for a single campaign
 * @param ipmId - IPM ID of the campaign, for logging
 *
 * @returns campaign configuration, or `null` if the entry is invalid
 */
function parseCampaignConfig(
  entry: unknown,
  ipmId: string,
): CampaignConfig | null {
  if (!isObject(entry)) {
    logger.warn(
      "[opd-persistence-experiment]: Campaign config is not an object",
      ipmId,
    );
    return null;
  }

  const config: CampaignConfig = {};

  if (typeof entry.ignoreCooldown !== "undefined") {
    if (typeof entry.ignoreCooldown !== "boolean") {
      logger.warn(
        "[opd-persistence-experiment]: Invalid ignoreCooldown",
        ipmId,
      );
      return null;
    }

    config.ignoreCooldown = entry.ignoreCooldown;
  }

  if (typeof entry.maxImpressions !== "undefined") {
    if (!isMaxImpressions(entry.maxImpressions)) {
      logger.warn(
        "[opd-persistence-experiment]: Invalid maxImpressions",
        ipmId,
      );
      return null;
    }

    config.maxImpressions = entry.maxImpressions;
  }

  // An entry that configures nothing — because its keys are misspelled, or it
  // is empty — leaves the campaign out of the experiment entirely rather than
  // enrolling it in the telemetry while it runs on the defaults
  if (Object.keys(config).length === 0) {
    logger.warn(
      "[opd-persistence-experiment]: Campaign config has no known fields",
      ipmId,
    );
    return null;
  }

  return config;
}

/**
 * Rebuilds the campaign configurations from the experiment flags.
 *
 * Flag names have to be unique, so an experiment that carries on-page dialog
 * configuration appends its own id to the base name. Every matching flag is
 * read, not just the first, so that two experiments can configure campaigns at
 * the same time. Campaigns belong to one experiment each, so their entries
 * can't collide; if the same campaign does appear twice, the alphabetically
 * first flag wins.
 */
async function initializeConfigs(): Promise<void> {
  const flags = await ewe.experiments.getFlags();

  knownConfigs.clear();

  for (const name of Object.keys(flags).sort()) {
    if (!name.startsWith(CAMPAIGN_CONFIG_FLAG_PREFIX)) {
      continue;
    }

    const value = flags[name];
    if (!isObject(value)) {
      logger.warn(
        "[opd-persistence-experiment]: Campaign config flag is not an object",
        name,
      );
      continue;
    }

    for (const [ipmId, entry] of Object.entries(value)) {
      if (knownConfigs.has(ipmId)) {
        continue;
      }

      const config = parseCampaignConfig(entry, ipmId);
      if (config !== null) {
        knownConfigs.set(ipmId, config);
      }
    }
  }

  logger.debug(
    "[opd-persistence-experiment]: Known campaign configs",
    knownConfigs,
  );
}

/**
 * Retrieves the campaign configuration for the given IPM campaign
 *
 * @param ipmId - IPM ID of the campaign, or `undefined` for dialogs that
 *   don't come from a campaign
 *
 * @returns campaign configuration, or `null` if the campaign isn't configured
 */
export function getCampaignConfig(
  ipmId: string | undefined,
): CampaignConfig | null {
  if (typeof ipmId !== "string") {
    return null;
  }

  return knownConfigs.get(ipmId) ?? null;
}

/**
 * Initializes campaign configurations
 *
 * @param hostLogger - Logger to use for this fragment's warnings and debug
 *   output
 */
export async function start(hostLogger: Logger): Promise<void> {
  logger = hostLogger;

  await initializeConfigs();

  ewe.experiments.onChanged.addListener(() => {
    void initializeConfigs();
  });
}
