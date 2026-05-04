/**
 * This file is part of eyeo's Reverse Trial fragment,
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

/**
 * Reason strings sent with the `config_validation_failed` telemetry
 * event. These values are exposed as a const map so that:
 *  - Sources and tests can reference the same symbol (no drifting
 *    string literals).
 *  - The telemetry-schema documentation in `core/sdk/events.js` has a
 *    single canonical list to mirror.
 *
 * When adding a new reason, also update the `config_validation_failed`
 * schema description in `core/sdk/events.js`.
 */
export const ValidationReason = {
  /** Config flag is absent or not an object despite the user being
   *  enrolled in a reverse-trial variant. */
  CONFIG_MISSING: "config_missing",
  TRIAL_DURATION_DAYS_INVALID: "trial_duration_days_invalid",
  REQUIRE_OPT_IN_INVALID: "require_opt_in_invalid",
  STEPS_INVALID: "steps_invalid",
  STEP_SHAPE_INVALID: "step_shape_invalid",
  STEP_ID_INVALID: "step_id_invalid",
  STEP_MIN_ELAPSED_DAYS_INVALID: "step_min_elapsed_days_invalid",
  STEP_MAX_ELAPSED_DAYS_INVALID: "step_max_elapsed_days_invalid",
  STEP_TITLE_INVALID: "step_title_invalid",
  STEP_BODY_INVALID: "step_body_invalid",
  STEP_BODY_ENTRY_INVALID: "step_body_entry_invalid",
  STEP_LINKS_INVALID: "step_links_invalid",
  STEP_SHOW_CLOSE_BUTTON_INVALID: "step_show_close_button_invalid",
  STEP_AUTO_DISMISS_MS_INVALID: "step_auto_dismiss_ms_invalid",
  STEP_ELEMENT_SHAPE_INVALID: "step_element_shape_invalid",
  STEP_ELEMENT_KEY_MISSING: "step_element_key_missing",
  STEP_I18N_EN_MISSING: "step_i18n_en_missing",
  STEP_I18N_ENTRIES_INVALID: "step_i18n_entries_invalid",
  STEP_I18N_VALUE_NOT_STRING: "step_i18n_value_not_string",
  STEP_I18N_KEY_MISSING_IN_EN: "step_i18n_key_missing_in_en",
  ACTION_SHAPE_INVALID: "action_shape_invalid",
  ACTION_TYPE_UNKNOWN: "action_type_unknown",
  NAVIGATE_URL_MISSING: "navigate_url_missing",
  NAVIGATE_URL_NOT_ALLOWLISTED: "navigate_url_not_allowlisted",
  /** Emitted by `resolveActionUrl` when a NAVIGATE URL fails the
   *  allowlist check after template substitution (runtime
   *  defense-in-depth; load-time allowlist also rejects the same URL
   *  if the literal template is bad). */
  URL_VALIDATION_FAILED_AFTER_SUBSTITUTION:
    "url_validation_failed_after_substitution",
} as const;

export type ValidationReasonName =
  (typeof ValidationReason)[keyof typeof ValidationReason];
