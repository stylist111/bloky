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

import type {
  DialogLink,
  DialogPayload,
  RemoteStepConfig,
  StepElement,
} from "../shared/types.js";
import {
  resolveActionUrl,
  resolveI18nText,
  resolveTextVariables,
} from "./templating.js";

/**
 * Finds the configured `StepElement` (ctaButton or link) by its i18n
 * key. The service worker uses this to resolve a dialog-action message
 * (which carries only the key) back to the full `StepAction` so it can
 * apply the configured behavior.
 */
export function findElementByKey(
  step: RemoteStepConfig | undefined,
  key: string,
): StepElement | undefined {
  if (!step) {
    return undefined;
  }
  if (step.ctaButton?.key === key) {
    return step.ctaButton;
  }
  return step.links?.find((l) => l.key === key);
}

/**
 * Builds a fully-resolved `DialogPayload` from a `RemoteStepConfig`.
 *
 * All text (title, body, button, links) is localized and has its text
 * variables (e.g. `{days_remaining}`) substituted here so the content
 * script receives display-ready strings — it has no access to
 * `browser.i18n` for OPD copy.
 *
 * All action URLs are resolved (template-substituted + revalidated)
 * here. The content script sees a plain `url` string and only decides
 * whether to call `window.open`; the service worker retains authority
 * over dismissing the dialog and advancing the step.
 */
export function buildDialogPayload(
  step: RemoteStepConfig,
  logoUrl: string,
  locale: string,
  urlVars: Record<string, string>,
  textVars: Record<string, string>,
  allowedUrlHosts: string[],
): DialogPayload {
  function resolveText(key: string): string {
    return resolveTextVariables(
      resolveI18nText(step.i18n, key, locale),
      textVars,
    );
  }

  const payload: DialogPayload = {
    title: resolveText(step.title.key),
    body: step.body.map((entry) => ({
      text: resolveText(entry.key),
      style: "paragraph",
    })),
    logoUrl,
    touchPointStep: step.id,
    showCloseButton: step.showCloseButton !== false,
  };

  if (step.ctaButton) {
    payload.ctaButton = {
      text: resolveText(step.ctaButton.key),
      key: step.ctaButton.key,
      url: resolveActionUrl(step.ctaButton.action, urlVars, allowedUrlHosts),
    };
  }

  if (typeof step.autoDismissMs === "number") {
    payload.autoDismissMs = step.autoDismissMs;
  }

  if (step.links && step.links.length > 0) {
    payload.links = step.links.map((link): DialogLink => {
      const url = resolveActionUrl(link.action, urlVars, allowedUrlHosts);
      const dialogLink: DialogLink = {
        text: resolveText(link.key),
        key: link.key,
      };
      if (url) {
        dialogLink.url = url;
      }
      return dialogLink;
    });
  }

  return payload;
}
