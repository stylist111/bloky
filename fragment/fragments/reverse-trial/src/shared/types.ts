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
 * Minimal view of the host's preferences object. The fragment reads and
 * writes only its own pref keys (trial step, trial start date) so this
 * interface stays intentionally narrow — a larger host Prefs shape still
 * satisfies it structurally.
 */
export interface Prefs {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => Promise<void> | void;
  reset: (key: string) => Promise<void> | void;

  /**
   * Resolves once the host's preferences have finished loading from
   * storage. `start()` awaits this before registering handlers so the
   * trial step / start date are never read as defaults (which would
   * re-enroll a mid-trial user).
   */
  untilLoaded: Promise<void>;
}

/**
 * Minimal view of the host's port object used to register message
 * handlers. The host router decides which origin / trusted-type rules
 * apply; here we only need to subscribe handlers by message type.
 */
export interface Port {
  on: (type: string, handler: (message: any) => unknown) => void;
}

/**
 * Parameters required to initialize the reverse trial background logic.
 *
 * The host extension provides these dependencies when calling `start()`.
 */
export interface StartInfo {
  /** Prefs object used to persist trial step and start date. */
  prefs: Prefs;

  /** Host-supplied port used to register content-script message handlers. */
  port: Port;

  /**
   * Registers trusted message types for an origin with the host's router
   * so the content script's messages are accepted.
   */
  addTrustedMessageTypes: (origin: string | null, types: string[]) => void;

  /**
   * The host extension's logo, shown in the dialog header. Provide it as an
   * inlined `data:` URI (each host imports its own SVG via the webpack
   * `?uri` asset loader, e.g. `import logo from "…/logo.svg?uri"`) so the
   * page never observes a logo request that could reveal the extension.
   */
  logoUrl: string;

  /** Returns true if the user has opted out of data collection. */
  isOptedOut: () => Promise<boolean>;

  /**
   * Current version of the host extension (e.g. "1.2.3"). Substituted
   * into `{addon_version}` URL template variables for opted-in users.
   */
  addonVersion: string;

  /**
   * Allowed URL hostnames for NAVIGATE actions. Each host must match the
   * full hostname exactly (no subdomain matching). URLs pointing to any
   * other host are rejected during config validation.
   */
  allowedUrlHosts: string[];
}

/**
 * A single body content line with resolved text and its rendering style.
 */
export interface BodyLine {
  /** Resolved display text */
  text: string;
  /** How the line should be rendered in the dialog */
  style: "paragraph" | "heading" | "list-item";
}

/**
 * All action identifiers exchanged between the dialog UI (content
 * script) and the service worker.
 *
 * The configurable subset (`CLOSE`, `END_TRIAL`, `NAVIGATE`) is also
 * usable in the remote config schema on `ctaButton` / link elements —
 * see the `StepAction` union below, which lists their interfaces.
 *
 * `AUTO_DISMISS` is emitted only by the dialog's auto-dismiss timer and
 * has no `StepAction` interface — PMs cannot configure it as an action.
 * The × close button reuses `CLOSE` so built-in clicks and configured
 * CLOSE actions share a telemetry bucket.
 *
 * When adding a new identifier, consumers that branch on `action.type`
 * use `switch (...) { default: assertExhaustive(...) }`, so the
 * compiler flags every switch that forgets to handle the new variant.
 */
export const DialogAction = {
  CLOSE: "CLOSE",
  END_TRIAL: "END_TRIAL",
  NAVIGATE: "NAVIGATE",
  AUTO_DISMISS: "AUTO_DISMISS",
  START_TRIAL: "START_TRIAL",
} as const;

/** All valid dialog action strings (both configurable and built-in). */
export type DialogActionName = (typeof DialogAction)[keyof typeof DialogAction];

/** Action that dismisses the dialog and advances the step. */
export interface CloseAction {
  type: typeof DialogAction.CLOSE;
}

/**
 * Action that ends the reverse trial — sets the step pref to the last
 * configured step and disables lightning snippets for the rest of the
 * experiment enrollment.
 */
export interface EndTrialAction {
  type: typeof DialogAction.END_TRIAL;
}

/**
 * Action that navigates to an https:// URL on the allowlist. When
 * `closeAfter` is true (default) the dialog dismisses and the step
 * advances after the URL opens; when false the URL opens in a new tab
 * and the dialog stays visible on the current step.
 */
export interface NavigateAction {
  type: typeof DialogAction.NAVIGATE;
  url: string;
  closeAfter?: boolean;
}

/**
 * Action that starts the reverse trial — activates Lightning Snippets
 * via the SDK caller-opinion API and stamps `pref:reverse_trial_start_date`
 * with the current time. Only meaningful on opt-in configs
 * (`requireOptIn: true`); on a step containing this action, any other
 * closing interaction is treated as `END_TRIAL`.
 */
export interface StartTrialAction {
  type: typeof DialogAction.START_TRIAL;
}

/**
 * Behavior a ctaButton or link triggers on click. The service worker is
 * the authority on which action a given key maps to; the content script
 * only echoes the key back in a dialog-action message.
 */
export type StepAction =
  | CloseAction
  | EndTrialAction
  | NavigateAction
  | StartTrialAction;

/**
 * Reference to a translation key in the step's i18n map. Wrapped in an
 * object to leave room for future fields (plural forms, contexts) without
 * a schema break.
 */
export interface I18nKeyRef {
  key: string;
}

/** A clickable element (ctaButton or link) configured inside a step. */
export interface StepElement {
  key: string;
  action: StepAction;
}

/**
 * A single step in the remote OPD config.
 *
 * Steps are resolved in id order: given `lastShownStep` and `elapsedDays`,
 * the highest-id step whose window contains `elapsedDays` wins. Windows
 * that have passed are skipped — a user who misses a window never sees
 * that OPD retroactively.
 */
export interface RemoteStepConfig {
  /**
   * Monotonic identifier used as the step pref value. Once the pref
   * reaches this id, this step will never be shown again.
   */
  id: number;

  /** Minimum days since trial start before this step is eligible. */
  minElapsedDays: number;

  /**
   * Maximum days since trial start while this step is eligible. Absent
   * means the step has no upper bound (typical for the trial-ended OPD).
   */
  maxElapsedDays?: number;

  /** When false, hides the × close button. Defaults to true. */
  showCloseButton?: boolean;

  /**
   * Auto-dismiss timeout. A number is the delay in ms; null or absent
   * disables auto-dismiss.
   */
  autoDismissMs?: number | null;

  title: I18nKeyRef;
  body: I18nKeyRef[];
  ctaButton?: StepElement;
  links?: StepElement[];

  /**
   * Locale → key → translated text. The `en` entry is required and acts
   * as the final fallback. Every `key` referenced in title/body/
   * ctaButton/links must be present under `en`; other locales may omit
   * keys and the `en` value will be used.
   */
  i18n: RemoteStepI18n;
}

/**
 * Locale → key → translated text.
 *
 * The `en` entry is required — enforced at schema load time in
 * remote-config.ts so `resolveI18nText`'s final fallback always lands
 * on a defined map. Other locales are optional and fall through to
 * `en` when a key is missing.
 */
export type RemoteStepI18n = Record<string, Record<string, string>>;

/** Top-level remote config read from the `reverse-trial-opd-config` flag. */
export interface RemoteTrialConfig {
  trialDurationDays: number;
  steps: RemoteStepConfig[];

  /**
   * When true, the trial is opt-in: the fragment does NOT auto-set
   * `pref:reverse_trial_start_date` on first visit and does NOT activate
   * Lightning Snippets. The first eligible step (typically the opt-in
   * OPD) renders with `elapsedDays = 0`. The user must click a CTA wired
   * to a `START_TRIAL` action to start the trial. Any other closing
   * interaction on that step ends the trial.
   *
   * Defaults to false (auto-enrollment) — preserves variants 1/2 behavior.
   */
  requireOptIn?: boolean;
}

/**
 * A link rendered in the dialog's links row.
 *
 * The `key` identifies the configured action — the service worker looks it
 * up in the step config on click. The content script only knows whether
 * there is a URL to open (via `url`).
 */
export interface DialogLink {
  text: string;
  key: string;
  url?: string;
}

/**
 * Payload returned by the service worker to the content script
 * describing which dialog to render. All text fields are already resolved
 * — the content script renders them directly without any i18n calls.
 */
export interface DialogPayload {
  /** Dialog heading text */
  title: string;

  /** Body content lines with resolved text and rendering styles */
  body: BodyLine[];

  /**
   * Call-to-action button. The `key` is the configured i18n key — sent as
   * `action` in the dialog-action message so the service worker can
   * resolve the configured behavior. `url` is empty when the action is
   * not a NAVIGATE (or a NAVIGATE that failed runtime validation).
   */
  ctaButton?: { text: string; key: string; url: string };

  /** The extension logo (a `data:` URI) displayed in the dialog header */
  logoUrl: string;

  /** Touch point step number, echoed back in dialog-action messages */
  touchPointStep: number;

  /** Whether the × close button is rendered. Defaults to true when absent. */
  showCloseButton: boolean;

  /** Auto-dismiss timeout in milliseconds */
  autoDismissMs?: number;

  /** Resolved links shown below the CTA button */
  links?: DialogLink[];
}
