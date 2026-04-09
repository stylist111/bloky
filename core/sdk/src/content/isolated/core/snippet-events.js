/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Creates a function that sends detection events via the logger.
 * Passed to snippets via env.sendDetectionEvent.
 *
 * Detection events are only available to isolated world snippets because
 * the ServerLogger and Sentry dependencies require extension API access
 * (chrome.storage, browser.runtime) which is not available in the main
 * world. If main world snippets need detection events in the future,
 * a message-passing bridge to the isolated world would be required.
 *
 * @param {Object} snippetLogger - ServerLogger instance
 * @param {Object} sentryReporter - Sentry module with reportError method
 * @returns {Function} sendDetectionEvent(type, domain, specifier?)
 */
export function createSnippetDetectionEventSender(
  snippetLogger, sentryReporter
) {
  return function sendDetectionEvent(type, domain, specifier) {
    if (typeof type !== "string" || typeof domain !== "string") {
      console.error(
        "sendDetectionEvent: type and domain are required strings. " +
        `Received type=${typeof type}, domain=${typeof domain}.`
      );
      return;
    }

    let validSpecifier = null;
    if (specifier != null) {
      if (typeof specifier !== "string") {
        console.error(
          "sendDetectionEvent: specifier must be a string if provided. " +
          `Received ${typeof specifier}.`
        );
      }
      else {
        validSpecifier = specifier;
      }
    }

    const data = {type, domain, specifier: validSpecifier};

    try {
      snippetLogger.behavior("snippet_detection_event", data);
    }
    catch (e) {
      // Workaround: the logger doesn't guarantee it won't throw.
      // Ideally error handling would live inside the logger itself.
      sentryReporter.reportError(e);
    }
  };
}

/**
 * Creates a function that sends snippet hit events via the logger.
 * Passed to snippets via env.sendSnippetHitEvent.
 *
 * @param {Object} snippetLogger - ServerLogger instance
 * @param {Object} sentryReporter - Sentry module with reportError method
 * @returns {Function} sendSnippetHitEvent(filter, domain)
 */
export function createSnippetHitEventSender(
  snippetLogger, sentryReporter
) {
  return function sendSnippetHitEvent(filter, domain) {
    if (typeof filter !== "string" || typeof domain !== "string") {
      console.error(
        `sendSnippetHitEvent: filter and domain are required strings. Received filter=${typeof filter}, domain=${typeof domain}.`
      );
      return;
    }

    const data = {filter, domain};

    try {
      snippetLogger.behavior("snippet_hit_event", data);
    }
    catch (e) {
      // Workaround: the logger doesn't guarantee it won't throw.
      // Ideally error handling would live inside the logger itself.
      sentryReporter.reportError(e);
    }
  };
}

const NOOP = () => {};

// Gates a snippet event sender behind an experiment flag
export function gateSnippetEvent(enabled, sender) {
  return enabled ? sender : NOOP;
}

/**
 * Handles an ewe:snippet-hit message detail received from the main world,
 * forwarding it to the provided send function when enabled and valid.
 *
 * @param {object} detail The CustomEvent detail payload
 * @param {boolean} enabled Whether snippet hit event logging is enabled
 * @param {Function} sendFn The function to call to send the hit event
 */
export function handleSnippetHitMessage(detail, enabled, sendFn) {
  if (!enabled) {
    return;
  }
  const {filter, domain} = detail;
  if (typeof filter !== "string" || typeof domain !== "string") {
    return;
  }
  sendFn(filter, domain);
}
