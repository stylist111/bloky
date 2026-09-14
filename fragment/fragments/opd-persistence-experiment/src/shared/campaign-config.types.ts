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

/**
 * Prefix of the experiment flag that carries per-campaign on-page dialog
 * overrides. Each experiment appends its own id to the base name, so we match
 * on the prefix rather than the exact name.
 */
export const CAMPAIGN_CONFIG_FLAG_PREFIX = "crumbs-opd-config";

/**
 * Per-campaign on-page dialog overrides, read from the experiment flag
 */
export interface CampaignConfig {
  /**
   * Whether the campaign sits outside the global on-page dialog cooldown, in
   * both directions: it is neither blocked by an ongoing cooldown, nor does it
   * start one for other campaigns.
   *
   * No other time-based spacing takes its place. The per-timing
   * `cooldownDuration` only applies to the web-allowlisting timings, so for a
   * campaign using `after_navigation` the dialog becomes eligible again on the
   * very next qualifying page load, with no minimum interval.
   */
  ignoreCooldown?: boolean;
  /**
   * Maximum number of times the dialog can be shown for this campaign,
   * replacing the display count from the host's own timing configuration.
   * Accepted values are 1 to 20; anything outside that leaves the campaign
   * unconfigured.
   *
   * Every qualifying page load spends one impression, and the extension cannot
   * tell a fresh navigation from a refresh of the same page: reloading a
   * matching page three times spends the whole cap without the user ever
   * moving on. Choose the cap knowing that impressions can be spent that way.
   */
  maxImpressions?: number;
}
