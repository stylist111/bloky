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

import {
  BrowserClient,
  Scope,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  featureFlagsIntegration
} from "@sentry/browser";
import {v4 as uuidv4} from "uuid";

import browser from "./browser.js";
import {PersistentState} from "./persistence.js";

const defaultSampleRate = 0.006;

let hasEncounteredSessionStorageError = false;
let lastEvent;
let sampleRate = defaultSampleRate;
let scope;
let userId;
let _experimentFlags;
let reporterData = new PersistentState(
  "ewe:sentry",
  browser.storage.local
);

/**
 * Returns the last occurred event that got sent to Sentry.
 *
 * @returns {object?} A sentry generated event
 * @ignore
 */
export function getLastEvent() {
  return lastEvent;
}

/**
 * Returns the Sentry user ID.
 *
 * @returns {string?} Sentry user ID
 * @ignore
 */
export function getUserId() {
  return userId;
}

function reportErrorInternal(error) {
  // After we exceed the session storage quota, this error will be thrown each
  // time we're trying to write to session storage, which leads to few users
  // generating a substantial amount of Sentry errors. To avoid this, we're
  // ignoring any subsequent occurrences to ensure that we only get one error
  // per service worker session.
  if (error.message.includes("Session storage quota bytes exceeded.")) {
    if (hasEncounteredSessionStorageError) {
      return;
    }

    hasEncounteredSessionStorageError = true;
  }

  if (!scope) {
    // This is useful in local dev where Sentry auth hasn't been set up, but you
    // want to see the errors that would have been sent to Sentry if it were.
    console.warn(
      "Would have gone to Sentry:",
      {error}
    );
    return;
  }

  scope.captureException(error);
}

/**
 * Sets the sample rate to limit how many events are being sent to Sentry.
 *
 * @param {number?} inputSampleRate - Sample rate (between 0 and 1)
 *    Set to `null` to reset to default sample rate.
 * @ignore
 */
export function setSampleRate(inputSampleRate) {
  if (typeof inputSampleRate === "number") {
    sampleRate = inputSampleRate;
  }
  else {
    sampleRate = defaultSampleRate;
  }
}

/**
 * API to interact with the sentry module
 * @namespace sentry
 */
export default {
  /**
   * Report error to Sentry
   *
   * @param {Error} error - Error to send to Sentry.
   */
  reportError(error) {
    reportErrorInternal(error);
  },

  /**
   * Set feature flags to be included in Sentry error reports
   * @see https://docs.sentry.io/platforms/javascript/configuration/integrations/featureflags/
   *
   * @param {Object} flags - Object containing feature flag key-value pairs
   *    e.g., {featureName: true, anotherFeature: false}
   */
  setFeatureFlags(flags) {
    // Store the flags in a variable so that they can be set once Sentry
    // is initialized and scope is available.
    _experimentFlags = flags;

    if (!scope) {
      console.warn("Sentry is not initialized. Feature flags will not be set.");
      return;
    }

    const client = scope.getClient();
    const flagsIntegration = client && client.getIntegrationByName("FeatureFlags");
    if (!flagsIntegration) {
      console.warn("Sentry FeatureFlags integration is not available.");
      return;
    }

    // Note: At the moment, we only support boolean flag evaluations, so we're
    // converting all values to boolean.
    for (const [key, value] of Object.entries(flags)) {
      flagsIntegration.addFeatureFlag(key, Boolean(value));
    }
  },

  /**
   * Initialize and start Sentry
   *
   * @param {string?} dsn - Sentry DSN URL
   * @param {string?} environment - Sentry environment. Normally "development"
   *                               or "production"
   * @param {string} hostVersion - Host extension version
   */
  async start(dsn, environment, hostVersion) {
    if (!dsn || !environment) {
      console.warn("Sentry is not initialized.");
      return;
    }

    const manifest = browser.runtime.getManifest();

    // filter integrations that use the global variable
    const integrations = getDefaultIntegrations({}).filter(
      defaultIntegration => {
        return ![
          "BrowserApiErrors",
          "TryCatch",
          "Breadcrumbs",
          "GlobalHandlers"
        ].includes(defaultIntegration.name);
      }
    );

    const client = new BrowserClient({
      dsn,
      environment: environment || "development",
      release: hostVersion,
      transport: makeFetchTransport,
      stackParser: defaultStackParser,
      initialScope: {
        tags: {
          manifestVersion: manifest.manifest_version
        }
      },
      integrations: [
        ...integrations,
        featureFlagsIntegration()
      ],
      sampleRate,
      beforeSend(event) {
        lastEvent = event;
        return event;
      }
    });

    scope = new Scope();
    scope.setClient(client);
    client.init();

    // If experiment flags were set before Sentry was initialized,
    // we need to set them again now that the scope is available.
    if (_experimentFlags) {
      this.setFeatureFlags(_experimentFlags);
    }

    self.addEventListener("error", event => {
      const {error} = event;
      if (!(error instanceof Error)) {
        return;
      }

      reportErrorInternal(error);
    });

    self.addEventListener("unhandledrejection", event => {
      const {reason} = event;
      if (!(reason instanceof Error)) {
        return;
      }

      reportErrorInternal(reason);
    });

    const state = await reporterData.getStateLoaded();
    userId = state.userId;
    if (!userId) {
      userId = uuidv4();
      state.userId = userId;
      await reporterData.save();
    }
    scope.setUser({
      id: userId
    });
  }
};
