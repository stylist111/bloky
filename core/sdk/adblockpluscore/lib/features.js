/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/** @module */

"use strict";

/**
 * Modes of operation for the filterEngine.
 *
 * @type {Object}
 *
 * @public
 */
exports.Features = {
  // Default features: Manifest v2.
  DEFAULT: 0,
  // We have DeclarativeNetRequest
  DNR: 1
};

let featureFlags = {};

/**
 * Resets all known feature flags back to their default values.
 */
let resetFeatureFlags =
exports.resetFeatureFlags = function() {
  // Add new feature flags here!

  featureFlags.example = false;  // example feature used by tests
  featureFlags.inlineCss = false;
  featureFlags.eyeometryUcid = false;
};

resetFeatureFlags();

/**
 * Sets the active set of feature flags.
 *
 * @param {Object} newFlags An object where each property is a feature to be
 * set.
 * @throws {Error} If any of the feature are not known, and so could not be
 * set. Any known features will still be set.
 */
exports.setFeatureFlags = function(newFlags) {
  let unknownFeatures = [];

  for (let feature in newFlags) {
    if (!Object.hasOwnProperty.call(featureFlags, feature)) {
      unknownFeatures.push(feature);
    }
    else {
      featureFlags[feature] = newFlags[feature];
    }
  }

  if (unknownFeatures.length > 0) {
    throw new Error(`Unknown feature flags: ${unknownFeatures.join(", ")}`);
  }
};

/**
 * Gets the current status of a feature flag. Used to determine which codepath
 * to take.
 *
 * @param {string} feature The name of the feature.
 * @returns {bool} The value of the feature flag, either from its default value
 * or as set by `setFeatureFlags`.
 * @throws {Error} If the feature is not one of the features set in
 * `resetFeatureFlags`.
 */
exports.isFeatureEnabled = function(feature) {
  if (typeof featureFlags[feature] == "undefined") {
    throw new Error(`Unknown feature flag: ${feature}`);
  }

  return featureFlags[feature];
};
