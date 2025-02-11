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
  makeFetchTransport
} from "@sentry/browser";
import {v4 as uuidv4} from "uuid";

import browser from "./browser.js";
import {PersistentState} from "./persistence.js";

const defaultSampleRate = 0.01;

let lastEvent;
let sampleRate = defaultSampleRate;
let scope;
let userId;
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
  if (scope) {
    scope.captureException(error);
  }
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
   * Initialize and start Sentry
   *
   * @param {string?} dsn - Sentry DSN URL
   * @param {string?} environment - Sentry environment. Normally "development"
   *                               or "production"
   * @param {string} hostVersion - Host extension version
   * @param {boolean} isPremiumUser - Whether the user is a Premium user
   */
  async start(dsn, environment, hostVersion, isPremiumUser) {
    if (dsn == null || environment == null) {
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
      integrations,
      sampleRate,
      beforeSend(event) {
        lastEvent = event;
        return event;
      }
    });

    scope = new Scope();
    scope.setClient(client);
    client.init();

    self.addEventListener("error", event => {
      const {error} = event;
      if (!(error instanceof Error)) {
        return;
      }

      reportErrorInternal(error);
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

    // We may want to send the premium status (as we do with CDP and IPM) at
    // some point, but for now we are keeping it simple here
    scope.setTag("is_premium", isPremiumUser);
  }
};
