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
 * @param {?string} topLevelDomain - Top-level page hostname from
 *   filtersConfig, or null if unavailable
 * @returns {Function} sendSnippetHitEvent(filter, domain)
 */
export function createSnippetHitEventSender(
  snippetLogger, sentryReporter, topLevelDomain
) {
  return function sendSnippetHitEvent(filter, domain) {
    if (typeof filter !== "string" || typeof domain !== "string") {
      console.error(
        `sendSnippetHitEvent: filter and domain are required strings. Received filter=${typeof filter}, domain=${typeof domain}.`
      );
      return;
    }

    const data = {
      filter,
      domain,
      topLevelDomain: topLevelDomain || domain
    };

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

/**
 * Creates a function that sends detection events via the logger without
 * including domain. Domain is intentionally excluded for GDPR compliance —
 * this event supports user-level retention signals without per-domain
 * identification. Do not add domain to the payload.
 *
 * @param {Object} snippetLogger - ServerLogger instance
 * @param {Object} sentryReporter - Sentry module with reportError method
 * @returns {Function} sendDetectionDomainlessEvent(type, domain, specifier?)
 */
export function createSnippetDetectionDomainlessSender(
  snippetLogger, sentryReporter
) {
  return function sendDetectionDomainlessEvent(type, _domain, specifier) {
    if (typeof type !== "string") {
      console.error(
        "sendDetectionDomainlessEvent: type is a required string. " +
        `Received type=${typeof type}.`
      );
      return;
    }

    let validSpecifier = null;
    if (specifier != null) {
      if (typeof specifier !== "string") {
        console.error(
          "sendDetectionDomainlessEvent: specifier must be a string if provided. " +
          `Received ${typeof specifier}.`
        );
      }
      else {
        validSpecifier = specifier;
      }
    }

    try {
      snippetLogger.behavior("snippet_detection_domainless", {
        type,
        specifier: validSpecifier
      });
    }
    catch (e) {
      // Workaround: the logger doesn't guarantee it won't throw.
      // Ideally error handling would live inside the logger itself.
      sentryReporter.reportError(e);
    }
  };
}

const NOOP = () => {};

/**
 * Gates a snippet event sender behind an experiment flag so that
 * no event processing or wrapper overhead occurs when the feature
 * is disabled.
 *
 * @param {boolean} enabled - Whether the experiment flag is on
 * @param {Function} sender - The event sender function to gate
 * @returns {Function} The sender if enabled, or a no-op function
 */
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

/**
 * Wraps a sendDetectionEvent function so that detection events from
 * iframes report the top-level page domain instead of the iframe
 * domain. When the domains already match (main frame) or no
 * top-level domain is available, the event passes through unchanged.
 *
 * @param {?string} topLevelDomain - Hostname from getTopLevelDomain,
 *   or null if unavailable
 * @param {Function} sender - The sendDetectionEvent function to wrap
 * @returns {Function} Wrapped sender, or the original if no
 *   replacement is needed
 */
export function withTopLevelDomain(topLevelDomain, sender) {
  if (!topLevelDomain) {
    return sender;
  }
  return function(type, domain, ...rest) {
    if (topLevelDomain === domain) {
      return sender(type, domain, ...rest);
    }
    return sender(type, topLevelDomain, ...rest);
  };
}
