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
  EXPERIMENT_FLAG,
  GET_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  OPT_OUT_MESSAGE_TYPE,
  FEEDBACK_MESSAGE_TYPE,
  FEEDBACK_URL,
  STEP_PREF_KEY,
  TRIAL_START_DATE_PREF_KEY,
  MS_PER_DAY,
  OPD_KILL_SWITCH,
} from "../shared/constants.js";
import type { StartInfo, DialogPayload } from "../shared/types.js";
import {
  resolveNextTouchPoint,
  getTouchPoint,
  LAST_TOUCH_POINT_STEP,
} from "./touchpoints.js";

const serverLogger = new ewe.telemetry.ServerLogger("reverse_trial");

async function toDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/**
 * Checks if a trial is currently in progress, and if it is ends it immediately
 * by setting the current step to the last one. This is used to end the trial if
 * a user has purchased premium or if the kill switch is active.
 *
 * Note the users without premium may be excluded by the feature flag, that
 * would only target non-premium users. Updating the step is necessary so that
 * if they ever cancel their premium, they won't then see an OPD saying that
 * their trial has ended.
 */
async function ensureTrialIsNotInProgress(params: StartInfo): Promise<void> {
  const trialStartDate: number =
    params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0;
  if (trialStartDate) {
    await advanceTrialStep(params, LAST_TOUCH_POINT_STEP);
  }
}

/**
 * Set the trial step to the new value. Enforces that the trial step can only
 * ever increase.
 */
async function advanceTrialStep(
  params: StartInfo,
  newStep: number,
): Promise<void> {
  const currentStep: number = params.prefs.get(STEP_PREF_KEY) ?? 0;
  if (currentStep < newStep) {
    await params.prefs.set(STEP_PREF_KEY, newStep);
  }
}

/**
 * Handles a dialog request from the content script.
 *
 * Checks whether the reverse trial experiment is enabled, determines the
 * next eligible touch point, and returns a fully resolved {@link DialogPayload}.
 * On the first visit (step 0, no start date), sets the trial start date.
 * Does NOT advance the step — that happens when the user dismisses the dialog.
 *
 * @param params - Host-provided dependencies (prefs, URLs, logger)
 * @returns The dialog payload for the next touch point, or null
 */
async function requestDialogHandler(
  message: { ytPremium?: boolean },
  params: StartInfo,
): Promise<DialogPayload | null> {
  const opdKillSwitch = Boolean(await ewe.experiments.getFlag(OPD_KILL_SWITCH));

  if ((await params.hasPremium()) || opdKillSwitch) {
    await ensureTrialIsNotInProgress(params);
    return null;
  }

  const lastShown: number = params.prefs.get(STEP_PREF_KEY) ?? 0;
  let trialStartDate: number = params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0;
  const flagEnabled = Boolean(await ewe.experiments.getFlag(EXPERIMENT_FLAG));

  // The flag must be enabled for the trial to start. However, after it has
  // started, we let it run to its conclusion regardless of the flag's status.
  // The last opd step can be shown after more than 14 days when the user
  // is not in the experiment anymore
  if (!flagEnabled && !trialStartDate) {
    return null;
  }

  // If the user has YouTube Premium and the trial hasn't started yet,
  // don't start it — treat this session as if the visit didn't happen.
  if (message.ytPremium && !trialStartDate) {
    return null;
  }

  if (!trialStartDate) {
    trialStartDate = Date.now();
    await params.prefs.set(TRIAL_START_DATE_PREF_KEY, trialStartDate);
  }

  const elapsedDays = Math.floor((Date.now() - trialStartDate) / MS_PER_DAY);

  const config = await resolveNextTouchPoint(lastShown, elapsedDays);
  if (!config) {
    return null;
  }

  // If the user has YouTube Premium and a dialog would have been shown,
  // skip it without advancing the step. Log the skip for analytics.
  // Exception: advance the step for the final touch point so the trial
  // is marked as ended — otherwise the user would see a stale "trial
  // ended" OPD if they later log out of their Premium account.
  if (message.ytPremium) {
    if (config.step === LAST_TOUCH_POINT_STEP) {
      await ensureTrialIsNotInProgress(params);
    }
    serverLogger.debug("dialog_skipped_yt_premium", {
      touchPointStep: config.step,
      installDate: params.prefs.get("installDate") ?? 0,
      reverseTrialStartDate: trialStartDate,
    });
    return null;
  }

  if (config.showOnce) {
    await advanceTrialStep(params, config.step);
  }

  // We convert the logo to a data url so that fetching it happens in the
  // service worker. Otherwise the page would be able to detect our request.
  const logoUrl = await toDataUrl(params.logoUrl);

  serverLogger.info("dialog_shown", {
    touchPointStep: config.step,
    installDate: params.prefs.get("installDate") ?? 0,
    reverseTrialStartDate: trialStartDate,
  });

  const urlParams = new URLSearchParams();
  urlParams.set("trialStarted", String(trialStartDate));

  const isOptedOut = await params.isOptedOut();

  if (!isOptedOut) {
    urlParams.set("s", "reverse_trial_opd");
    urlParams.set("opdStep", String(config.step));
    urlParams.set("rcid", await ewe.telemetry.getRotatingClientId());
    urlParams.set("av", params.addonVersion);
    urlParams.set("er", String(await ewe.remoteConfig.getRevisionId()));
    urlParams.set("ev", await ewe.experiments.getEncodedExperiments());
    urlParams.set("ca", await ewe.cohorts.getEncodedCohorts());
  }

  const premiumUrl = `${params.premiumUrl}?${urlParams.toString()}`;

  let target = "";
  if (config.hasTarget) {
    target = premiumUrl;
  }

  let learnMore;
  if (config.learnMore) {
    learnMore = {
      text: browser.i18n.getMessage(config.learnMore),
      url: premiumUrl,
    };
  }

  const dismiss = config.showDismissLink
    ? { text: browser.i18n.getMessage("reverse_trial_midpoint_decide_later") }
    : undefined;

  const optOut = config.optOutKey
    ? { text: browser.i18n.getMessage(config.optOutKey) }
    : undefined;

  let feedback;
  if (config.showFeedback) {
    feedback = {
      text: browser.i18n.getMessage("reverse_trial_submit_feedback"),
      url: FEEDBACK_URL + `&entry.1742752836=${config.step}`,
    };
    if (!isOptedOut) {
      feedback.url += `&entry.400370027=${params.addonVersion}`;
    }
  }

  return {
    title: browser.i18n.getMessage(config.titleKey),
    body: config.bodyKeys.map((entry) => ({
      text: browser.i18n.getMessage(entry.key),
      style: entry.style,
    })),
    button: config.buttonKey
      ? browser.i18n.getMessage(config.buttonKey)
      : undefined,
    target,
    logoUrl,
    touchPointStep: config.step,
    learnMore,
    dismiss,
    optOut,
    showOnce: config.showOnce,
    autoDismissMs: config.autoDismissMs,
    feedback,
  };
}

/**
 * Handles a dialog dismiss action from the content script.
 *
 * Advances the step if the reported touch point is ahead of the current step.
 * This ensures idempotency — multiple tabs showing the same dialog won't
 * double-advance.
 *
 * After advancing the step, broadcasts DISMISS_DIALOG_MESSAGE_TYPE to all open
 * tabs so that any other tab still showing the same dialog closes it.
 * Errors from tabs that have no content script are intentionally swallowed.
 *
 * @param message - The dismiss message with touchPointStep and action.
 *   `action` is `"close"` when the user clicked the × button,
 *   or `"cta"` when the user clicked the call-to-action button.
 * @param params - Host-provided dependencies
 */
async function dialogActionHandler(
  message: { touchPointStep: number; action: string; silent?: boolean },
  params: StartInfo,
): Promise<void> {
  await advanceTrialStep(params, message.touchPointStep);

  serverLogger.info("dialog_action", {
    action: message.action,
    touchPointStep: message.touchPointStep,
    installDate: params.prefs.get("installDate") ?? 0,
    reverseTrialStartDate: params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0,
  });

  if (!message.silent) {
    await dismissOpenDialogs();
  }
}

/**
 * Handles a check from the content script asking whether a currently-visible
 * dialog should still be shown.
 *
 * @param message - Contains the touch point step
 * @param params - Host-provided dependencies
 */
async function dialogShouldStillShowHandler(
  message: { touchPointStep: number },
  params: StartInfo,
): Promise<boolean> {
  const touchpoint = await getTouchPoint(message.touchPointStep);
  const currentStep: number = params.prefs.get(STEP_PREF_KEY) ?? 0;

  // showOnce touchpoints increment the step immediately when they are shown, so if the step isn't still the current step then the user has moved on.
  let shouldStillShow: boolean;
  if (touchpoint?.showOnce) {
    shouldStillShow = currentStep === message.touchPointStep;
  } else {
    shouldStillShow = currentStep < message.touchPointStep;
  }

  serverLogger.debug("dialog_should_still_show_checked", {
    touchPointStep: message.touchPointStep,
    shouldStillShow,
    installDate: params.prefs.get("installDate") ?? 0,
    reverseTrialStartDate: params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0,
  });

  return shouldStillShow;
}

async function optOutHandler(
  message: { touchPointStep: number },
  params: StartInfo,
): Promise<void> {
  await advanceTrialStep(params, LAST_TOUCH_POINT_STEP);

  serverLogger.info("opt_out", {
    touchPointStep: message.touchPointStep,
    installDate: params.prefs.get("installDate") ?? 0,
    reverseTrialStartDate: params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0,
  });

  await dismissOpenDialogs();
}

async function feedbackHandler(
  message: { touchPointStep: number },
  params: StartInfo,
): Promise<void> {
  serverLogger.info("feedback_clicked", {
    touchPointStep: message.touchPointStep,
    installDate: params.prefs.get("installDate") ?? 0,
    reverseTrialStartDate: params.prefs.get(TRIAL_START_DATE_PREF_KEY) ?? 0,
  });
}

async function dismissOpenDialogs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  // Note: This could be simplified by using Promise.allSettled, but that isn't
  // supported in the oldest Firefox we currently support. It is available from
  // Firefox 71.0 onwards.
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id !== undefined) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: DISMISS_DIALOG_MESSAGE_TYPE,
          });
        } catch (_e) {
          // Errors indicate that the tab isn't one with the reverse trial
          // content script running, safe to ignore.
        }
      }
    }),
  );
}

/**
 * Initializes the reverse trial background logic.
 *
 * Registers a message handler via the port object that responds to dialog
 * requests from the content script and registers the trusted message
 * types for the origins.
 *
 * @param params - Host-provided dependencies (prefs, port, URLs)
 */
export function start(params: StartInfo): void {
  params.port.on(
    GET_DIALOG_MESSAGE_TYPE,
    async (message: { ytPremium?: boolean }) =>
      await requestDialogHandler(message ?? {}, params),
  );
  params.port.on(
    DIALOG_ACTION_MESSAGE_TYPE,
    async (message: {
      touchPointStep: number;
      action: string;
      silent?: boolean;
    }) => {
      await dialogActionHandler(message, params);
    },
  );
  params.port.on(
    GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    async (message: { touchPointStep: number }) =>
      await dialogShouldStillShowHandler(message, params),
  );
  params.port.on(
    OPT_OUT_MESSAGE_TYPE,
    async (message: { touchPointStep: number }) => {
      await optOutHandler(message, params);
    },
  );
  params.port.on(
    FEEDBACK_MESSAGE_TYPE,
    async (message: { touchPointStep: number }) => {
      await feedbackHandler(message, params);
    },
  );

  const trustedTypes = [
    GET_DIALOG_MESSAGE_TYPE,
    GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    DIALOG_ACTION_MESSAGE_TYPE,
    OPT_OUT_MESSAGE_TYPE,
    FEEDBACK_MESSAGE_TYPE,
  ];
  params.addTrustedMessageTypes("https://youtube.com", trustedTypes);
  params.addTrustedMessageTypes("https://www.youtube.com", trustedTypes);

  void params.hasPremium().then(async (premium) => {
    if (premium) {
      await ensureTrialIsNotInProgress(params);
    }
  });
}
