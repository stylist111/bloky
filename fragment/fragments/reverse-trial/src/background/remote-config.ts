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

import {
  DialogAction,
  type RemoteStepConfig,
  type RemoteStepI18n,
  type RemoteTrialConfig,
  type StepAction,
  type StepElement,
} from "../shared/types.js";
import {
  ValidationReason,
  type ValidationReasonName,
} from "../shared/validation-reasons.js";
import { isUrlAllowed } from "./url-allowlist.js";

const serverLogger = new ewe.telemetry.ServerLogger("reverse_trial");

/**
 * Records a schema-validation failure and returns null so the caller can
 * short-circuit. Each failure logs exactly once at its originating
 * checkpoint — caller functions that see a null return just propagate
 * it without re-logging so the event fires once per broken config.
 */
function invalid(reason: ValidationReasonName): null {
  serverLogger.info("config_validation_failed", { reason });
  return null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Parses a `StepAction` from a raw value. Returns null on any shape or
 * safety violation — callers reject the whole config on null so PMs
 * cannot ship an OPD with a broken button.
 *
 * When adding a new `DialogAction` schema variant, extend the switch
 * below. The exhaustiveness check in `dialogActionHandler` will flag
 * any downstream consumer that forgot to handle the new variant.
 *
 * NAVIGATE actions are URL-validated here against `allowedUrlHosts`.
 * This is the load-time check; `resolveActionUrl` re-validates after
 * template substitution as defense-in-depth.
 */
function parseAction(
  value: unknown,
  allowedUrlHosts: string[],
): StepAction | null {
  if (!isObject(value)) {
    return invalid(ValidationReason.ACTION_SHAPE_INVALID);
  }

  switch (value.type) {
    case DialogAction.CLOSE:
      return { type: DialogAction.CLOSE };

    case DialogAction.END_TRIAL:
      return { type: DialogAction.END_TRIAL };

    case DialogAction.START_TRIAL:
      return { type: DialogAction.START_TRIAL };

    case DialogAction.NAVIGATE: {
      if (typeof value.url !== "string" || value.url.length === 0) {
        return invalid(ValidationReason.NAVIGATE_URL_MISSING);
      }
      if (!isUrlAllowed(value.url, allowedUrlHosts)) {
        return invalid(ValidationReason.NAVIGATE_URL_NOT_ALLOWLISTED);
      }
      const action: StepAction = {
        type: DialogAction.NAVIGATE,
        url: value.url,
      };
      if (typeof value.closeAfter === "boolean") {
        action.closeAfter = value.closeAfter;
      }
      return action;
    }

    default:
      return invalid(ValidationReason.ACTION_TYPE_UNKNOWN);
  }
}

/**
 * Parses a `StepElement` (ctaButton or link). Thin wrapper that enforces
 * a non-empty `key` plus a valid action. Does not re-log when the nested
 * `parseAction` call fails — that call already logged its own reason.
 */
function parseStepElement(
  value: unknown,
  allowedUrlHosts: string[],
): StepElement | null {
  if (!isObject(value)) {
    return invalid(ValidationReason.STEP_ELEMENT_SHAPE_INVALID);
  }
  if (typeof value.key !== "string" || value.key.length === 0) {
    return invalid(ValidationReason.STEP_ELEMENT_KEY_MISSING);
  }
  const action = parseAction(value.action, allowedUrlHosts);
  if (!action) {
    return null;
  }
  return { key: value.key, action };
}

/**
 * Parses the `body` array: one or more `{ key: string }` entries. Empty
 * bodies are rejected so every dialog has at least one line.
 */
function parseBody(value: unknown): Array<{ key: string }> | null {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid(ValidationReason.STEP_BODY_INVALID);
  }
  const body: Array<{ key: string }> = [];
  for (const entry of value) {
    if (!isObject(entry) || typeof entry.key !== "string") {
      return invalid(ValidationReason.STEP_BODY_ENTRY_INVALID);
    }
    body.push({ key: entry.key });
  }
  return body;
}

/**
 * Parses the `i18n` map. Requires an `en` entry — the fallback chain
 * always terminates at `en`, so the absence of `en` would let keys
 * disappear silently when a user's locale has missing translations.
 */
function parseI18n(value: unknown): RemoteStepI18n | null {
  if (!isObject(value) || !isObject(value.en)) {
    return invalid(ValidationReason.STEP_I18N_EN_MISSING);
  }
  const i18n: Record<string, Record<string, string>> = {};
  for (const [locale, entries] of Object.entries(value)) {
    if (!isObject(entries)) {
      return invalid(ValidationReason.STEP_I18N_ENTRIES_INVALID);
    }
    const localeEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) {
      if (typeof v !== "string") {
        return invalid(ValidationReason.STEP_I18N_VALUE_NOT_STRING);
      }
      localeEntries[k] = v;
    }
    i18n[locale] = localeEntries;
  }
  return i18n as RemoteStepI18n;
}

/**
 * Collects every i18n key referenced by a step's title / body /
 * ctaButton / links and asserts all of them exist under `i18n.en`.
 * Catches PM typos at load time instead of rendering empty strings at
 * runtime.
 */
function allReferencedKeysExistInEn(
  title: { key: string },
  body: Array<{ key: string }>,
  ctaButton: StepElement | undefined,
  links: StepElement[] | undefined,
  i18n: RemoteStepI18n,
): boolean {
  const required = new Set<string>();
  required.add(title.key);
  for (const b of body) {
    required.add(b.key);
  }
  if (ctaButton) {
    required.add(ctaButton.key);
  }
  if (links) {
    for (const l of links) {
      required.add(l.key);
    }
  }
  for (const key of required) {
    if (typeof i18n.en[key] !== "string") {
      return false;
    }
  }
  return true;
}

/**
 * Parses a single step. Rejects the step (and therefore the whole
 * config) on any validation failure so partially-broken OPDs never
 * render. Leaf-level failures log their own reason; this function only
 * logs for checks it performs directly.
 */
function parseStep(
  value: unknown,
  allowedUrlHosts: string[],
): RemoteStepConfig | null {
  if (!isObject(value)) {
    return invalid(ValidationReason.STEP_SHAPE_INVALID);
  }

  if (typeof value.id !== "number" || !Number.isFinite(value.id)) {
    return invalid(ValidationReason.STEP_ID_INVALID);
  }
  if (!isNonNegativeNumber(value.minElapsedDays)) {
    return invalid(ValidationReason.STEP_MIN_ELAPSED_DAYS_INVALID);
  }

  let maxElapsedDays: number | undefined;
  if (value.maxElapsedDays !== undefined) {
    if (!isNonNegativeNumber(value.maxElapsedDays)) {
      return invalid(ValidationReason.STEP_MAX_ELAPSED_DAYS_INVALID);
    }
    if (value.maxElapsedDays < value.minElapsedDays) {
      return invalid(ValidationReason.STEP_MAX_ELAPSED_DAYS_INVALID);
    }
    maxElapsedDays = value.maxElapsedDays;
  }

  if (!isObject(value.title) || typeof value.title.key !== "string") {
    return invalid(ValidationReason.STEP_TITLE_INVALID);
  }
  const title = { key: value.title.key };

  const body = parseBody(value.body);
  if (!body) {
    return null;
  }

  let ctaButton: StepElement | undefined;
  if (value.ctaButton !== undefined) {
    const parsed = parseStepElement(value.ctaButton, allowedUrlHosts);
    if (!parsed) {
      return null;
    }
    ctaButton = parsed;
  }

  let links: StepElement[] | undefined;
  if (value.links !== undefined) {
    if (!Array.isArray(value.links)) {
      return invalid(ValidationReason.STEP_LINKS_INVALID);
    }
    const parsedLinks: StepElement[] = [];
    for (const link of value.links) {
      const parsed = parseStepElement(link, allowedUrlHosts);
      if (!parsed) {
        return null;
      }
      parsedLinks.push(parsed);
    }
    links = parsedLinks;
  }

  let showCloseButton: boolean | undefined;
  if (value.showCloseButton !== undefined) {
    if (typeof value.showCloseButton !== "boolean") {
      return invalid(ValidationReason.STEP_SHOW_CLOSE_BUTTON_INVALID);
    }
    showCloseButton = value.showCloseButton;
  }

  let autoDismissMs: number | null | undefined;
  if (value.autoDismissMs !== undefined) {
    if (
      value.autoDismissMs !== null &&
      (typeof value.autoDismissMs !== "number" ||
        !Number.isFinite(value.autoDismissMs))
    ) {
      return invalid(ValidationReason.STEP_AUTO_DISMISS_MS_INVALID);
    }
    autoDismissMs = value.autoDismissMs;
  }

  const i18n = parseI18n(value.i18n);
  if (!i18n) {
    return null;
  }

  if (!allReferencedKeysExistInEn(title, body, ctaButton, links, i18n)) {
    return invalid(ValidationReason.STEP_I18N_KEY_MISSING_IN_EN);
  }

  const step: RemoteStepConfig = {
    id: value.id,
    minElapsedDays: value.minElapsedDays,
    title,
    body,
    i18n,
  };
  if (maxElapsedDays !== undefined) {
    step.maxElapsedDays = maxElapsedDays;
  }
  if (ctaButton) {
    step.ctaButton = ctaButton;
  }
  if (links) {
    step.links = links;
  }
  if (showCloseButton !== undefined) {
    step.showCloseButton = showCloseButton;
  }
  if (autoDismissMs !== undefined) {
    step.autoDismissMs = autoDismissMs;
  }

  return step;
}

/**
 * Validates the full OPD config schema against a pre-fetched raw flag
 * value. Returns `null` and logs a `config_validation_failed` telemetry
 * event (with a specific reason) whenever the value is missing or the
 * schema is invalid. The caller is expected to fetch the raw value
 * from the `reverse-trial-opd-config-<experiment-id>` flag via a
 * prefix scan and pass it in here.
 *
 * Callers should first check `show-reverse-trial-opd-<experiment-id>` —
 * when that flag is off the user isn't in the experiment and this
 * function should not be reached at all, otherwise we'd log for every
 * non-enrolled user. The entire config is rejected on any validation
 * failure so PMs cannot ship partially broken OPDs.
 *
 * Every NAVIGATE URL is validated against `allowedUrlHosts` (exact
 * hostname match). Host integrations provide this list so each
 * extension can only navigate to its own trusted hosts.
 */
export function getRemoteOpdConfig(
  raw: unknown,
  allowedUrlHosts: string[],
): RemoteTrialConfig | null {
  if (!isObject(raw)) {
    return invalid(ValidationReason.CONFIG_MISSING);
  }

  if (!isPositiveNumber(raw.trialDurationDays)) {
    return invalid(ValidationReason.TRIAL_DURATION_DAYS_INVALID);
  }

  let requireOptIn: boolean | undefined;
  if (raw.requireOptIn !== undefined) {
    if (typeof raw.requireOptIn !== "boolean") {
      return invalid(ValidationReason.REQUIRE_OPT_IN_INVALID);
    }
    requireOptIn = raw.requireOptIn;
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    return invalid(ValidationReason.STEPS_INVALID);
  }

  const steps: RemoteStepConfig[] = [];
  for (const stepValue of raw.steps) {
    const step = parseStep(stepValue, allowedUrlHosts);
    if (!step) {
      return null;
    }
    steps.push(step);
  }

  const config: RemoteTrialConfig = {
    trialDurationDays: raw.trialDurationDays,
    steps,
  };
  if (requireOptIn !== undefined) {
    config.requireOptIn = requireOptIn;
  }
  return config;
}
