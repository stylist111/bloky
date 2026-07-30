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
  EXPERIMENT_FLAG_PREFIX,
  GET_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DIALOG_SHOWN_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  STEP_PREF_KEY,
  TOUCH_POINT_CONFIG_FLAG_PREFIX,
  TRIAL_START_DATE_PREF_KEY,
  MS_PER_DAY,
} from "../shared/constants.js";
import {
  DialogAction,
  type DialogPayload,
  type RemoteStepConfig,
  type StartInfo,
  type StepAction,
} from "../shared/types.js";
import { assertExhaustive } from "../shared/assert-exhaustive.js";
import { buildDialogPayload, findElementByKey } from "./dialog-payload.js";
import { findFlagByPrefix } from "./flags.js";
import { getRemoteOpdConfig, isObject } from "./remote-config.js";
import { buildTextVariables, buildUrlVariables } from "./templating.js";
import {
  getLastStepId,
  getStepById,
  resolveNextTouchPoint,
} from "./touchpoints.js";
import { advanceTrialStep, endTrial, startTrial } from "./trial-lifecycle.js";

const serverLogger = new ewe.telemetry.ServerLogger("reverse_trial");

/**
 * Handles a dialog request from the content script.
 *
 * Reads the remote OPD config, determines the next eligible step, and
 * builds a fully resolved {@link DialogPayload}. Without a valid remote
 * config no OPD is shown. Does NOT advance the step — that happens when
 * the user dismisses the dialog.
 */
async function requestDialogHandler(
  message: { ytPremium?: boolean },
  params: StartInfo,
): Promise<DialogPayload | null> {
  const flags = await ewe.experiments.getFlags();

  // Gate flag must be on to start a trial or to show OPDs. Each
  // experiment appends its own id to the base flag name; we accept
  // whichever matching flag is present.
  if (!findFlagByPrefix(flags, EXPERIMENT_FLAG_PREFIX)) {
    return null;
  }

  const config = getRemoteOpdConfig(
    findFlagByPrefix(flags, TOUCH_POINT_CONFIG_FLAG_PREFIX),
    params.allowedUrlHosts,
  );
  // Config must be valid to start the trial or to show OPDs
  if (!config) {
    return null;
  }

  // Runtime Premium gate: the experiment enrolls all users regardless of
  // hasPremium, so the fragment is the single source of truth for "don't
  // show OPDs to premium users." End the trial (step → last, caller
  // opinion cleared) so no further OPDs fire and lightning snippets
  // resolve via the hasPremium rung of the precedence chain.
  if (await ewe.account.hasPremium()) {
    const currentStep =
      (params.prefs.get(STEP_PREF_KEY) as number | undefined) ?? 0;
    if (currentStep < getLastStepId(config)) {
      await endTrial(params, config);
    }
    return null;
  }

  const lastShown =
    (params.prefs.get(STEP_PREF_KEY) as number | undefined) ?? 0;
  let trialStartDate =
    (params.prefs.get(TRIAL_START_DATE_PREF_KEY) as number | undefined) ?? 0;

  // YT Premium + no existing trial → treat as if this visit didn't
  // happen so we don't start a trial they won't benefit from.
  if (message.ytPremium && !trialStartDate) {
    return null;
  }

  if (!trialStartDate && !config.requireOptIn) {
    // Auto-enrollment: stamp the trial start and turn lightning snippets
    // on. Opt-in configs skip this — the start happens inside the
    // START_TRIAL action handler when the user accepts.
    await startTrial(params);
    trialStartDate = Date.now();
  }

  // For opt-in configs before acceptance, trialStartDate is 0 so the
  // opt-in step (minElapsedDays: 0) is eligible while later windowed
  // steps are not. Once START_TRIAL fires the date is stamped and day
  // counting runs normally from acceptance time forward.
  const elapsedDays = trialStartDate
    ? Math.floor((Date.now() - trialStartDate) / MS_PER_DAY)
    : 0;
  const step = resolveNextTouchPoint(config, lastShown, elapsedDays);
  if (!step) {
    return null;
  }

  const lastStepId = getLastStepId(config);

  // YT Premium mid-trial: skip the dialog. Exception: if we'd have shown
  // the final touch point, advance to last anyway so the trial is
  // marked ended — otherwise the user would see a stale "trial ended"
  // OPD if they later log out of their Premium account.
  if (message.ytPremium) {
    if (step.id === lastStepId) {
      await endTrial(params, config);
    }
    serverLogger.debug("dialog_skipped_yt_premium", {
      touchPointStep: step.id,
      installDate: (params.prefs.get("installDate") as number | undefined) ?? 0,
      reverseTrialStartDate: trialStartDate,
    });
    return null;
  }

  const isOptedOut = await params.isOptedOut();
  const urlVars = await buildUrlVariables(
    step.id,
    trialStartDate,
    params,
    isOptedOut,
  );
  const textVars = buildTextVariables(config, elapsedDays);
  const locale = browser.i18n.getUILanguage();

  return buildDialogPayload(
    step,
    params.logoUrl,
    locale,
    urlVars,
    textVars,
    params.allowedUrlHosts,
  );
}

/**
 * True if the step exposes a `START_TRIAL` action — i.e. it's the
 * opt-in OPD. Used to route any non-`START_TRIAL` closing interaction
 * through the end-trial path so dismissal doesn't leave the user in a
 * limbo state where later (post-acceptance) steps could still fire.
 */
function stepHasStartTrial(step: RemoteStepConfig | undefined): boolean {
  if (!step) {
    return false;
  }
  if (step.ctaButton?.action.type === DialogAction.START_TRIAL) {
    return true;
  }
  return (
    step.links?.some((l) => l.action.type === DialogAction.START_TRIAL) ?? false
  );
}

/**
 * Resolves a dialog-action message's `action` field to the configured
 * `StepAction`. Built-in uppercase defaults (`CLOSE`, `AUTO_DISMISS`)
 * always mean "close action"; configured i18n keys are looked up in the
 * step config. Unknown keys (e.g. from a stale dialog) default to
 * `CLOSE` so the dialog still dismisses cleanly.
 */
function resolveMessageAction(
  message: { touchPointStep: number; action: string },
  config: ReturnType<typeof getRemoteOpdConfig>,
): StepAction {
  if (
    !config ||
    message.action === DialogAction.CLOSE ||
    message.action === DialogAction.AUTO_DISMISS
  ) {
    return { type: DialogAction.CLOSE };
  }
  const step = getStepById(config, message.touchPointStep);
  const element = findElementByKey(step, message.action);
  return element?.action ?? { type: DialogAction.CLOSE };
}

/**
 * Handles a dialog-action message from the content script.
 *
 * Logs telemetry, resolves the action, and applies its behavior:
 * - `NAVIGATE` with `closeAfter: false` → no step advance, no broadcast
 * - `END_TRIAL` → end the trial (step → last, lightning-snippets caller
 *   opinion cleared), broadcast
 * - `START_TRIAL` → start the trial (stamp start date, activate
 *   lightning snippets), advance the step
 * - On a step that contains a `START_TRIAL` action (the opt-in OPD),
 *   any non-`START_TRIAL` closing interaction (×, auto-dismiss,
 *   configured `CLOSE`, `NAVIGATE` with `closeAfter: true`) is routed
 *   through the end-trial path — without it the user could dismiss the
 *   opt-in OPD and still see post-acceptance OPDs once their day count
 *   drifted into later windows.
 * - Otherwise (`CLOSE`, `NAVIGATE` with `closeAfter: true`, built-in
 *   close/auto-dismiss, or unknown key) → advance step to
 *   `touchPointStep`; if that reaches the last step, end the trial;
 *   broadcast dismiss.
 */
async function dialogActionHandler(
  message: { touchPointStep: number; action: string },
  params: StartInfo,
): Promise<void> {
  serverLogger.info("dialog_action", {
    action: message.action,
    touchPointStep: message.touchPointStep,
    installDate: (params.prefs.get("installDate") as number | undefined) ?? 0,
    reverseTrialStartDate:
      (params.prefs.get(TRIAL_START_DATE_PREF_KEY) as number | undefined) ?? 0,
  });

  const flags = await ewe.experiments.getFlags();
  const config = getRemoteOpdConfig(
    findFlagByPrefix(flags, TOUCH_POINT_CONFIG_FLAG_PREFIX),
    params.allowedUrlHosts,
  );
  const stepAction = resolveMessageAction(message, config);

  const willClose =
    stepAction.type !== DialogAction.NAVIGATE ||
    stepAction.closeAfter !== false;
  const isOptInStep =
    config !== null &&
    stepHasStartTrial(getStepById(config, message.touchPointStep));

  if (
    isOptInStep &&
    willClose &&
    stepAction.type !== DialogAction.START_TRIAL
  ) {
    if (config) {
      await endTrial(params, config);
    }
    await dismissOpenDialogs();
    return;
  }

  // Exhaustiveness check below means adding a new `StepAction`
  // variant triggers a compile error until this switch handles it.
  switch (stepAction.type) {
    case DialogAction.NAVIGATE:
      if (stepAction.closeAfter === false) {
        return;
      }
      break;
    case DialogAction.END_TRIAL:
      if (config) {
        await endTrial(params, config);
      }
      await dismissOpenDialogs();
      return;
    case DialogAction.START_TRIAL:
      await startTrial(params);
      break;
    case DialogAction.CLOSE:
      break;
    default:
      assertExhaustive(stepAction);
  }

  if (config && message.touchPointStep >= getLastStepId(config)) {
    await endTrial(params, config);
  } else {
    await advanceTrialStep(params, message.touchPointStep);
  }
  await dismissOpenDialogs();
}

/**
 * Handles a check from the content script asking whether a
 * currently-visible dialog should still be shown.
 *
 * The dialog is still valid while `currentStep < touchPointStep`. Once
 * the step has been advanced (by this tab or another) the displayed
 * dialog is stale and should be removed.
 */
async function dialogShouldStillShowHandler(
  message: { touchPointStep: number },
  params: StartInfo,
): Promise<boolean> {
  const currentStep =
    (params.prefs.get(STEP_PREF_KEY) as number | undefined) ?? 0;
  const shouldStillShow = currentStep < message.touchPointStep;

  serverLogger.debug("dialog_should_still_show_checked", {
    touchPointStep: message.touchPointStep,
    shouldStillShow,
    installDate: (params.prefs.get("installDate") as number | undefined) ?? 0,
    reverseTrialStartDate:
      (params.prefs.get(TRIAL_START_DATE_PREF_KEY) as number | undefined) ?? 0,
  });

  return shouldStillShow;
}

/**
 * Broadcasts a dismiss message to every tab. Tabs without the
 * reverse-trial content script reject the message, which is expected
 * and swallowed — the broadcast is intentionally best-effort because
 * the service worker cannot efficiently enumerate only relevant tabs.
 *
 * Uses per-message try/catch rather than `Promise.allSettled` because
 * allSettled isn't available in the oldest supported Firefox (pre-71).
 */
async function dismissOpenDialogs(): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id !== undefined) {
        try {
          await browser.tabs.sendMessage(tab.id, {
            type: DISMISS_DIALOG_MESSAGE_TYPE,
          });
        } catch (_e) {
          // Tab without the reverse-trial content script; safe to ignore.
        }
      }
    }),
  );
}

/**
 * Emits the `dialog_shown` telemetry once the content script confirms the
 * dialog was actually rendered. Kept separate from payload building so the
 * impression is only counted for the extension that truly displayed the
 * OPD — when both AdBlock and Adblock Plus are installed, the one that
 * loses the shared-DOM render race never sends this message.
 */
function dialogShownHandler(
  message: { touchPointStep: number },
  params: StartInfo,
): void {
  serverLogger.info("dialog_shown", {
    touchPointStep: message.touchPointStep,
    installDate: (params.prefs.get("installDate") as number | undefined) ?? 0,
    reverseTrialStartDate:
      (params.prefs.get(TRIAL_START_DATE_PREF_KEY) as number | undefined) ?? 0,
  });
}

/**
 * Initializes the reverse trial background logic.
 *
 * Registers port handlers and trusted message types for YouTube.
 * Installs two listeners:
 *   - account.onChanged: ends any in-progress trial when the user
 *     upgrades to Premium and dismisses open OPDs.
 *   - experiments.onChanged: when the config flag is withdrawn (the
 *     user leaves the experiment), clears the lightning-snippets
 *     caller opinion (defense-in-depth — endTrial already clears it)
 *     and resets trial prefs so the user can be re-targeted later.
 */
export async function start(params: StartInfo): Promise<void> {
  // Wait for the host's prefs to finish loading before registering
  // handlers, so the trial step / start date are never read as defaults
  // (which would re-enroll a mid-trial user).
  await params.prefs.untilLoaded;

  params.port.on(
    GET_DIALOG_MESSAGE_TYPE,
    async (message: { ytPremium?: boolean }) =>
      await requestDialogHandler(message ?? {}, params),
  );
  params.port.on(
    DIALOG_ACTION_MESSAGE_TYPE,
    async (message: { touchPointStep: number; action: string }) => {
      await dialogActionHandler(message, params);
    },
  );
  params.port.on(
    GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    async (message: { touchPointStep: number }) =>
      await dialogShouldStillShowHandler(message, params),
  );
  params.port.on(
    DIALOG_SHOWN_MESSAGE_TYPE,
    (message: { touchPointStep: number }) => {
      dialogShownHandler(message, params);
    },
  );

  const trustedTypes = [
    GET_DIALOG_MESSAGE_TYPE,
    GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    DIALOG_ACTION_MESSAGE_TYPE,
    DIALOG_SHOWN_MESSAGE_TYPE,
  ];
  params.addTrustedMessageTypes("https://youtube.com", trustedTypes);
  params.addTrustedMessageTypes("https://www.youtube.com", trustedTypes);

  // When the user upgrades to Premium during an active trial, end it
  // immediately — don't wait until the next YouTube visit (the runtime
  // gate in requestDialogHandler) or for the experiments-facts
  // round-trip. endTrial is Premium-safe: .clear() on lightning
  // snippets lets the precedence chain resolve via hasPremium for a
  // premium user. Trial prefs are NOT reset here — that's reserved for
  // experiment exit via the experiments.onChanged listener below.
  ewe.account.onChanged.addListener(async ({ user, oldUser }) => {
    const becamePremium = user?.hasPremium && !oldUser?.hasPremium;
    if (!becamePremium) {
      return;
    }

    const flags = await ewe.experiments.getFlags();
    const rawConfig = findFlagByPrefix(flags, TOUCH_POINT_CONFIG_FLAG_PREFIX);
    if (!rawConfig) {
      return;
    }

    const config = getRemoteOpdConfig(rawConfig, params.allowedUrlHosts);
    if (!config) {
      return;
    }

    const currentStep =
      (params.prefs.get(STEP_PREF_KEY) as number | undefined) ?? 0;
    if (currentStep < getLastStepId(config)) {
      await endTrial(params, config);
      await dismissOpenDialogs();
    }
  });

  // Clean-up path for users no longer targeted by the OPD: when the
  // OPD config flag is withdrawn (e.g. user buys premium and the
  // experiment conditions drop them, or the remote config is
  // retired), clearing the lightning-snippets caller opinion lets
  // premium / default resolve via the namespace precedence chain.
  // Trial prefs (step, start date) are left in place — they're only
  // read when a valid config is present, so stale values are inert.
  // lightningSnippets.clear() is a no-op when no opinion is set, so
  // calling unconditionally on every experiments change is safe.
  ewe.experiments.onChanged.addListener(async () => {
    const flags = await ewe.experiments.getFlags();
    const config = findFlagByPrefix(flags, TOUCH_POINT_CONFIG_FLAG_PREFIX);
    if (!isObject(config)) {
      // disable lightning snippets, since the trial ended
      await ewe.lightningSnippets.clear();

      // reset trial step and start date, so this user can be re-targeted
      // in the future for another reverse trial
      await params.prefs.reset(STEP_PREF_KEY);
      await params.prefs.reset(TRIAL_START_DATE_PREF_KEY);
    }
  });
}
