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

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import browser from "webextension-polyfill";

import {
  DialogAction,
  type RemoteStepI18n,
  type RemoteTrialConfig,
  type StartInfo,
  type StepAction,
} from "../shared/types.js";
import { ValidationReason } from "../shared/validation-reasons.js";
import { isUrlAllowed } from "./url-allowlist.js";

const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const serverLogger = new ewe.telemetry.ServerLogger("reverse_trial");

/**
 * Replaces `{variable}` placeholders in a template string.
 *
 * When `encode` is true, substituted values are passed through
 * `encodeURIComponent` — use this for URLs so values with `+`, `/`, `=`
 * etc. don't alter the URL structure.
 *
 * When `encode` is false, values are inserted verbatim — use this for
 * translated text that will be inserted via `textContent` in the DOM.
 *
 * Unrecognized variables are left as the literal `{name}` text in both
 * modes so typos surface visibly rather than silently disappearing.
 */
function resolveVariables(
  template: string,
  vars: Record<string, string>,
  encode: boolean,
): string {
  return template.replace(VARIABLE_PATTERN, (match: string, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      return match;
    }
    return encode ? encodeURIComponent(vars[name]) : vars[name];
  });
}

/**
 * Replaces `{variable}` placeholders in a URL template, percent-encoding
 * each substituted value. Only the URL-variable table (step, rcid,
 * addon_version, experiments, cohorts, revision_id, trial_start, lang)
 * is recognized; text-template variables like `{days_remaining}` are
 * left as literals.
 */
export function resolveUrlVariables(
  url: string,
  vars: Record<string, string>,
): string {
  return resolveVariables(url, vars, true);
}

/**
 * Replaces `{variable}` placeholders in translated text. Values are
 * inserted verbatim because the content script writes them via
 * `textContent`, so no encoding is needed.
 */
export function resolveTextVariables(
  text: string,
  vars: Record<string, string>,
): string {
  return resolveVariables(text, vars, false);
}

/**
 * Resolves a translation key through the locale fallback chain:
 * exact locale → base language → `en`. Direct key lookups — assumes
 * both the config and `browser.i18n.getUILanguage()` use canonical
 * BCP 47 casing. A config with non-canonical casing
 * silently falls through to the base language or `en`.
 *
 * Every referenced key is guaranteed to exist under `en` by the schema
 * validator, so `en` is the final, always-successful fallback.
 */
export function resolveI18nText(
  i18n: RemoteStepI18n,
  key: string,
  locale: string,
): string {
  const exact = i18n[locale]?.[key];
  if (typeof exact === "string") {
    return exact;
  }

  const language = locale.split(/[-_]/)[0];
  const base = i18n[language]?.[key];
  if (typeof base === "string") {
    return base;
  }
  return i18n.en?.[key] ?? "";
}

/**
 * Resolves a `StepAction` to the URL the content script should open on
 * click. Non-NAVIGATE actions return `""` (no navigation).
 *
 * Runtime defense-in-depth: after template substitution the final URL
 * is re-validated against the allowlist. On failure, logs a
 * `config_validation_failed` telemetry event (with hostname only, since
 * the full URL may contain PII from template vars) and returns `""` so
 * the click becomes a no-op for navigation.
 */
export function resolveActionUrl(
  action: StepAction,
  templateVars: Record<string, string>,
  allowedUrlHosts: string[],
): string {
  if (action.type !== DialogAction.NAVIGATE) {
    return "";
  }

  const substituted = resolveUrlVariables(action.url, templateVars);
  if (isUrlAllowed(substituted, allowedUrlHosts)) {
    return substituted;
  }

  let hostname = "";
  try {
    hostname = new URL(substituted).hostname;
  } catch {
    // Malformed URL after substitution — leave hostname empty rather
    // than risk leaking PII from the pre-parse string.
  }
  serverLogger.info("config_validation_failed", {
    reason: ValidationReason.URL_VALIDATION_FAILED_AFTER_SUBSTITUTION,
    hostname,
  });
  return "";
}

/**
 * Builds the variable map substituted into NAVIGATE URL templates.
 *
 * `addon_version`, `rcid`, `revision_id`, `experiments`, and `cohorts`
 * are opt-out-sensitive: they identify the user or device and resolve
 * to empty strings when the user has opted out of data collection. The
 * remaining variables (`step`, `trial_start`, `lang`) are safe for
 * everyone and are always populated.
 */
export async function buildUrlVariables(
  stepId: number,
  trialStartDate: number,
  params: StartInfo,
  isOptedOut: boolean,
): Promise<Record<string, string>> {
  return {
    step: String(stepId),
    trial_start: String(trialStartDate),
    lang: browser.i18n.getUILanguage(),
    addon_version: isOptedOut ? "" : params.addonVersion,
    rcid: isOptedOut ? "" : await ewe.telemetry.getRotatingClientId(),
    revision_id: isOptedOut
      ? ""
      : String(await ewe.remoteConfig.getRevisionId()),
    experiments: isOptedOut
      ? ""
      : await ewe.experiments.getEncodedExperiments(),
    cohorts: isOptedOut ? "" : await ewe.cohorts.getEncodedCohorts(),
  };
}

/**
 * Builds the variable map substituted into translated text strings.
 *
 * - `{days_elapsed}` — full days since trial start, clamped to 0 so
 *   pre-acceptance opt-in steps don't surface a negative count.
 * - `{days_remaining}` — `trialDurationDays - elapsedDays`, clamped
 *   to 0 so the text reads naturally past trial end.
 */
export function buildTextVariables(
  config: RemoteTrialConfig,
  elapsedDays: number,
): Record<string, string> {
  return {
    days_elapsed: String(Math.max(0, elapsedDays)),
    days_remaining: String(Math.max(0, config.trialDurationDays - elapsedDays)),
  };
}
