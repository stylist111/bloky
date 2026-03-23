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
 * Parameters required to initialize the reverse trial background logic.
 *
 * The host extension provides these dependencies when calling `start()`.
 */
export interface StartInfo {
  /**
   * A reference to the Prefs object for reading/writing extension preferences.
   *
   * Must support `get(key: string): any` and `set(key: string, value: any): void`.
   */
  prefs: any;

  /**
   * A reference to the port object for registering message handlers.
   *
   * Must support `on(type: string, handler: Function)`.
   */
  port: any;

  /**
   * Function to register trusted message types for content script origins.
   *
   * Required so the host's message router allows messages from the content script.
   */
  addTrustedMessageTypes: (origin: string | null, types: string[]) => void;

  /**
   * URL to the extension logo image, used in the dialog header.
   *
   * Typically obtained via `browser.runtime.getURL("icons/adblock-20.svg")`.
   */
  logoUrl: string;

  /**
   * URL to the premium subscription page, used as the CTA target
   * for the midpoint and ended dialogs.
   */
  premiumUrl: string;

  /**
   * Returns true if the user currently holds an active premium subscription.
   */
  hasPremium: () => Promise<boolean>;

  /**
   * User has opted out of data collection
   */
  isOptedOut: () => Promise<boolean>;

  /**
   * The current version of the host extension (e.g. "1.2.3").
   * Included as a URL parameter in the premium CTA link for opted-in users.
   */
  addonVersion: string;
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
 * i18n key entry for a body line in a touch point config.
 */
export interface BodyKeyEntry {
  /** i18n message key to resolve via browser.i18n.getMessage() */
  key: string;
  /** How the line should be rendered in the dialog */
  style: "paragraph" | "heading" | "list-item";
}

/**
 * Static configuration for a touch point dialog.
 * Contains only i18n keys — no resolved text.
 */
export interface TouchPointConfig {
  step: number;
  titleKey: string;
  bodyKeys: BodyKeyEntry[];
  buttonKey: string;
  /** Whether this touch point navigates to a target URL on CTA click */
  hasTarget: boolean;
  /** Minimum number of elapsed trial days before this touch point becomes eligible */
  minElapsedDays: number;
  /** i18n key for the "Learn More" link text, if present */
  learnMore?: string;
}

/**
 * Payload returned by the service worker to the content script
 * describing which dialog to render.
 *
 * All text fields are already resolved — the content script renders them
 * directly without any i18n calls.
 */
export interface DialogPayload {
  /** Dialog heading text */
  title: string;

  /** Body content lines with resolved text and rendering styles */
  body: BodyLine[];

  /** Text displayed on the call-to-action button */
  button: string;

  /**
   * URL to open when the CTA button is clicked.
   * Empty string means dismiss only (no navigation).
   */
  target: string;

  /** URL to the extension logo displayed in the dialog */
  logoUrl: string;

  /** Touch point step number, echoed back in the dismiss message */
  touchPointStep: number;

  /**
   * Resolved "Learn More" link shown below the CTA button.
   * Absent when the touch point has no learn more link.
   */
  learnMore?: { text: string; url: string };
}
