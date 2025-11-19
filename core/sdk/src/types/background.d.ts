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

import type Browser from "webextension-polyfill";

// The declared types are manually generated for now.
// Please update this file when creating or updating a type.
/**
 * Function called when allowlisting succeeds
 *
 * @param domain - The domain to allowlist.
 * @param options - Additional options for the allowlisting.
 */
export type AllowlistingCallback = (
  domain: string,
  options: AllowlistingOptions
) => unknown;

/**
 * Additional options for allowlisting
 */
export interface AllowlistingOptions {
  /**
   * The timestamp when the filter should expire
   * (allowed 1 day - 365 days in the future).
   */
  expiresAt?: number;
}

/**
 * Blockthrough Acceptable Ads detection details
 */
export interface BtaaDetectionDetails {
  /**
   * Indicates whether an ad blocker has been detected on the page
   */
  ab: boolean;
  /**
   * Indicates whether Acceptable Ads has been detected on the page
   */
  acceptable: boolean;
  /**
   * Indicates whether it's an Acceptable Ads pageview
   */
  isAAPV: boolean;
  /**
   * Page session ID
   */
  sessionId: string;
  /**
   * Site ID
   */
  siteId: string;
}

/**
 * The EventDispatcher class allows users to listen to certain events that are emitted.
 */
export interface EventDispatcher<T> {
  /**
   * Attaches a listener function to an event. This listener will be called when the event is emitted. Please note that in an MV3 context this has to happen in the first turn of the event loop. This should happen when your service worker starts.
   *
   * @param listener - Listener function
   */
  addListener: (listener: T) => void;
  /**
   * Removes the added function. The listener will no longer be called by the event.
   *
   * @param listener - Listener function
   */
  removeListener: (listener: T) => void;
}

/**
 * represents the remote configuration
 */
export interface RemoteConfig {
  /**
   * The ID of the schema that is used for the remote config.
   */
  schemaId: string;

  /**
   * The experiments that are currently active.
   */
  experiments?: Experiment[];

  /**
   * The cohorts that are currently active.
   */
  cohorts?: Cohort[];
}

/**
 * Represents a cohort
 */
export interface Cohort {
  /**
   * The cohort details
   */
  name: string;

  /**
   * The cohort conditions
   */
  conditions: any[];

  /**
   * The cohort ID
   */
  event: {
    type: string;
  };
}

/**
 * Represents an experiment
 */
export interface Experiment {
  /**
   * Experiment ID
   */
  id: string;
  /**
   * Experiment variants
   */
  variants: ExperimentVariant[];
}

/**
 * Represents a variant of an experiment
 */
export interface ExperimentVariant {
  /**
   * Experiment variant ID
   */
  id: string;
  /**
   * Indicates whether current user is assigned to the experiment variant
   */
  assigned: boolean;
}

/**
 * Options for retrieving filters
 */
export interface FiltersGetAllowingFiltersOptions {
  /**
   * ID of the frame to look up
   */
  frameId?: number;
  /**
   * Types of filters to consider
   */
  types?: string[];
}

/**
 * Filter match information
 */
export interface FilterMatchInfo {
  /**
   * When the type in request details is undefined, this contains the reason
   * why the request/frame got allowlisted. That is either "document",
   * "elemhide", "genericblock", "generichide", or "extensionInitiated".
   * "extensionInitiated" refers to any web requests initiated by a browser
   * extension rather than a web page (those requests are not blockable).
   */
  allowingReason?:
    | "document"
    | "elemhide"
    | "extensionInitiated"
    | "genericblock"
    | "generichide";
  /**
   * The hostname of the document that caused the request. This will be null
   * for "main_frame" requests since those create the top-level document in
   * the first place.
   */
  docDomain: string | null;
  /**
   * The method used to match this filter. This can be the string "request",
   * "header", "csp", "popup", "elemhide", "snippet", "allowing", or
   * "unmatched".
   */
  method:
    | "allowing"
    | "csp"
    | "elemhide"
    | "header"
    | "popup"
    | "request"
    | "snippet"
    | "unmatched";
  /**
   * The name of the internal resource to which to rewrite the URL.
   */
  rewrittenUrl?: string;
  /**
   * Whether selectors from generic filters should be included.
   */
  specificOnly?: boolean;
}

/**
 * Extra data associated with a filter.
 *
 * The SDK doesn't specify the type allowed for metadata entries.
 */
export type FilterMetadata = Record<string, any>;

/**
 * Represents an item that can be blocked.
 */
export interface BlockableItem {
  /**
   * The filter that matched, if any.
   */
  filter: Filter | null;
  /**
   * Extra information that might be relevant depending on the context.
   */
  matchInfo: FilterMatchInfo;
  /**
   * Either the onBeforeRequest details object or the onHeadersReceived
   * details object from the web extensions API, or an object with the
   * properties frameId , tabId and url.
   */
  request:
    | Browser.WebRequest.OnBeforeRequestDetailsType
    | Browser.WebRequest.OnHeadersReceivedDetailsType
    | VirtualBlockableItemRequest;
}

/**
 * Represents a single filter rule and its state.
 */
export interface Filter {
  /**
   * A {@link https://help.eyeo.com/adblockplus/how-to-write-filters|filter}
   * rule that specifies what content to block or to allow.
   * Used to identify a filter.
   */
  text: string;
  /**
   * Indicates whether this filter would be applied. Filters are enabled by
   * default. For comment filters returned value is null.
   */
  enabled: boolean | null;
  /**
   * For element hiding emulation filters, true if the filter will remove elements from the DOM rather hiding them.
   */
  remove?: boolean;
  /**
   * Indicates that this filter is not subject to an internal optimization.
   * Filters that are considered slow should be avoided.
   * Only URLFilters can be slow.
   */
  slow: boolean;
  /**
   * The filter {@link https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/-/jobs/artifacts/0.6.0/file/build/docs/module-filterClasses.Filter.html?job=docs#type|type}
   */
  type: string;
  /**
   * True when the filter applies to third-party, false to first-party,
   * null otherwise.
   */
  thirdParty: boolean | null;
  /**
   * CSS selector for the HTML elements that will be hidden.
   */
  selector: string | null;
  /**
   * Content Security Policy to be injected.
   */
  csp: string | null;
  /**
   * Indicates if the filter adds headers to requests or responses.
   */
  isAddHeader: boolean;
}

/**
 * Represents a single filter rule and its state, with associated filter
 * metadata.
 */
export interface FilterWithMetadata extends Filter {
  /**
   * Any metadata associated with the filter.
   */
  metadata?: FilterMetadata
}

/**
 * The result of parsing an invalid filter.
 */
export interface FilterError {
  /**
   * The filter option that made the filter invalid.
   */
  option: string | null;
  /**
   * The reason why the filter is invalid.
   */
  reason: string;
  /**
   * Either invalid_filter or invalid_domain.
   */
  type: string;
}

/**
 * Defines the recommended filter subscriptions per language.
 */
export interface Recommendation {
  /**
   * The identifier for this subscription.
   */
  id: string;
  /**
   * The languages that this recommendation would match to.
   */
  languages: string[];
  /**
   * The display name of the recommended subscription.
   */
  title: string;
  /**
   *  A list of subscriptions that this one depends on.
   */
  requires: string[];
  /**
   * A list of subscriptions that this one also contains.
   */
  includes: string[];
  /**
   * The kind of content targeted by this recommended subscription.
   */
  type: string;
  /**
   * Where the recommended subscription can be found in plain text.
   */
  url: string;
  /**
   * Where the recommended subscription can be found for MV2 in plain text
   * (Manifest V3 only).
   */
  mv2URL?: string;
}

/**
 * A resource that provides a list of filters that decide what to block.
 */
export interface Subscription {
  id: string;
  /**
   * Indicates whether the subscription is currently downloading (downloadble
   * subscriptions only).
   */
  downloading: boolean;
  /**
   * The status of the most recent download attempt (downloadble subscriptions
   * only).
   */
  downloadStatus?: string;
  /**
   * Indicates whether this subscription will be applied.
   */
  enabled: boolean;
  /**
   * Epoch time when the subscription must be downloaded (downloadble
   * subscriptions only).
   */
  expires?: number;
  /**
   * Website of the project that manages this filter list.
   */
  homepage?: string;
  /**
   * Epoch time when the subscription was last downloaded to your machine
   * (downloadble subscriptions only).
   */
  lastDownload?: number;
  /**
   * Epoch time when this subscription was last successfully downloaded
   * (downloadble subscriptions only).
   */
  lastSuccess?: number;
  /**
   * Epoch time for the next attempt to download the subscription. Can be
   * updated even if the subscription was not downloaded. If expires is
   * closer, then expires prevail. (downloadble subscriptions only).
   */
  softExpiration?: number;
  /**
   * The display name of the subscription. If not provided, falls back to the
   * URL.
   */
  title: string;
  /**
   * Indicates whether this subscription can be updated with either full or
   * diff update over the network. If false the subscription is merely a
   * container for user-defined filters.
   */
  updatable: boolean;
  /**
   * Where the subscription can be found in plain text. Used a the identifier.
   */
  url: string;
  /**
   * The version provided by the subscription's metadata. Defaults to '0' if
   * not provided. It might be set if the subscription is not downloadable.
   */
  version: string;
  /**
   * The number of times the subscription has been succesfully downloaded
   * (downloadble subscriptions only).
   */
  downloadCount?: number;
}

/**
 * Virtual blockable item request
 */
export interface VirtualBlockableItemRequest {
  /**
   * ID of frame from which request originated
   */
  frameId: Browser.Runtime.MessageSender["frameId"];
  /**
   * ID of tab from which request originated
   */
  tabId: Browser.Tabs.Tab["id"];
  /**
   * Request URL
   */
  url: string;
}

export interface Facts {
  /**
   * Indicates whether the user has a premium license.
   */
  hasPremium?: boolean;
  /**
   * The timestamp when the extension was installed, in milliseconds since the epoch.
   */
  installDate?: number;
  /**
   * The extension name.
   */
  extName?: string;
  /**
   * The extension version.
   */
  extVersion?: string;
  /**
   * The number of ads blocked by the extension.
   */
  blockedCount?: number;
  /**
   * The browser name.
   */
  browserName?: string;
  /**
   * The browser language.
   */
  browserLanguage?: string
  /**
   * Whether Acceptable Ads is enabled.
   */
  aaEnabled?: boolean;
  /**
   * The type of installation e.g. is it development build or large scale deployment.
   */
  installType?: Browser.Management.ExtensionInstallType;
  /**
   * The 2-letter country code, as provided through the JSON configuration response header
   */
  countryCode?: string;
}

export interface UserProfile {
  /**
   * The user's email address.
   */
  email?: string;

  /**
   * The user's display name, if available.
   */
  displayName?: string;

  /**
   * Whether the user has a premium subscription.
   */
  hasPremium?: boolean;

  /**
   * The features available to the user
   * e.g., "premium", "adblocker"
   */
  features?: string[];
}

export interface ProfileSyncStatus {
  /**
   * The last time the profile was successfully synced.
   */
  lastSuccessfulRequest?: string;
  /**
   * The last time the profile sync failed.
   */
  lastRequestError?: string;
}

/**
 * An object containing addon information belonging to sdk consumer, that can be accessed
 * via debugging module.
 */
export interface AddonInfo {
  /**
   * An array of bundled subscriptions provided by the integrator.
   */
  bundledSubscriptions?: BundledSubscription[];
  /**
   * A path to subscription files provided by the integrator.
   */
  bundledSubscriptionsPath?: string;
  /**
   * Name of the addon/extension.
   */
  name?: string;
  /**
   * Version of the addon/extension.
   */
  version?: string;
  /**
   * Remote configuration parameters.
   */
  remoteConfig?: {
    /**
     * The URL to make a GET request to for getting the remote config data.
     */
    url?: string;
    /**
    * A function that returns the facts object to be used in the cohorts and experiments modules.
    */
    getFacts?: () => Promise<Facts>;
  };

  /**
   * Configuration for the account module.
   */
  account?: {
    /**
     * The base URL of the API to which the account module will make requests.
     */
    apiBaseUrl: string;

    /**
     * The application ID of to be used in the communication with the account API.
     */
    applicationId: string;

    /**
     * URL pattern to identify login requests and extract auth tokens from.
     * See {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns|Match patterns}
     * for details on the format.
     */
    loginRequestPattern: string;
  };

  /**
   * Feature flags for the addon/extension.
   */
  featureFlags?: {
    /**
     * Enable inline CSS in element hiding and element hiding emulation filters.
     */
    inlineCss?: boolean;
  };
  /**
   * Settings for CDP.
   */
  cdp?: {
    /**
     * The URL to do the user counting ping to CDP.
     */
    pingUrl?: string;
    /**
     * The URL to send aggregate metrics to CDP.
     */
    publicKeyUrl?: string;
    /**
     * The Bearer token accompanying CDP API calls.
     */
    bearer?: string;
  };
  /**
   * Settings for telemetry.
   */
  telemetry?: {
    /**
     * The URL of the location where user active pings will be sent to.
     */
    url?: string;
    /**
     * The Bearer token accompanying telemetry API calls.
     */
    bearer?: string;
  };
  /**
   * Settings for telemetry event logging.
   */
  telemetryEventLogging?: {
    /**
     * The URL of the location where telemetry event logs will be sent to.
     */
    url?: string;
    /**
     * The Bearer token accompanying telemetry event logging API calls.
     */
    bearer?: string;
  };
}

/**
 * Defines the recommended filter subscriptions per language.
 */
export interface BundledSubscription {
  /**
   * Where this recommendation will get updates from. Required for MV3 subscriptions to update.
   */
  diff_url?: string;
  /**
   * Expiration interval from the subscription header. Usually the number of days or hours between expirations.
   */
  expires?: string;
  /**
   * The home page of the recommended subscription.
   */
  homepage?: string;
  /**
   * The identifier for this subscription.
   */
  id: string;
  /**
   * A list of subscriptions that this one also contains.
   */
  includes?: string[];
  /**
   * The languages that this subscription would match to.
   */
  languages?: string[];
  /**
   * Where the recommended subscription can be found for MV2 in plain text (Manifest V3 only).
   */
  mv2_url?: string;
  /**
   * True if this subscription can load filters that require privileged access, like snippets.
   */
  privileged?: boolean;
  /**
   * A list of subscriptions that this one depends on.
   */
  requires?: string[];
  /**
   * The display name of the recommended subscription.
   */
  title: string;
  /**
   * The kind of content targeted by this recommended subscription.
   */
  type: string;
  /**
   * Where the recommended subscription can be found in plain text.
   */
  url: string;
}

/**
 * Information returned after the first run of the extension.
 */
export interface FirstRunInfo {
  /**
   * Whether the subscriptions storage was initialized or not.
   */
  foundStorage: boolean;
  /**
   * Whether pre-existing subscriptions were found.
   */
  foundSubscriptions: boolean;
  /**
   * An array of warnings.
   */
  warnings?: string[];
}

declare module "@eyeo/webext-ad-filtering-solution" {
  /**
   * Starts the EWE with the given addon information.
   *
   * @param addonInfo An object containing addon information
   * belonging to sdk consumer, that can be accessed via `debugging` module.
   * @returns A promise that is resolved after starting up is completed.
   */

  const start: (addonInfo: AddonInfo) =>  Promise<FirstRunInfo>;

  namespace allowlisting {
    /**
     * Sets the function called when allowlisting succeeds
     *
     * @param allowlistingCallback - User defined function that will be called
     */
    const setAllowlistingCallback: (
      allowlistingCallback: AllowlistingCallback
    ) => void;

    /**
     * Updates the list of public keys used to verify allowlisting requests
     *
     * @param keys - New set of public keys
     */
    const setAuthorizedKeys: (keys: string[]) => Promise<void>;
  }

  namespace sentry {
   /**
    * Report error to Sentry
    *
    * @param error - Error to send to Sentry.
    */
    const reportError: (error: Error) => void;
    /**
     * Initialize and start Sentry
     *
     * @param dsn - Sentry DSN URL
     * @param environment - Sentry environment. Normally "development" or
     *                      "production"
     * @param hostVersion - Host extension version
     */
    const start: (
      dsn: string | undefined,
      environment: string | undefined,
      hostVersion: string,
    ) => Promise<void>;
  }

  namespace filters {
    /**
     * Returns the allowing filters that will be effective when the given
     * document will be reloaded
     */
    const getAllowingFilters: (
      /**
       * ID of tab to look up
       */
      tabId: number,
      /**
       * Options for retrieving filters
       */
      options?: FiltersGetAllowingFiltersOptions
    ) => Promise<string[]>;
    /**
     * Returns an array of MV2 to MV3 migration errors and the related filters.
     */
    const getMigrationErrors: () => Promise<array<Filter, string>>;
    /**
     * Returns an extra data associated with a filter
     *
     * @param text - Filter text
     *
     * @returns filter metadata
     */
    const getMetadata: (text: string) => Promise<FilterMetadata | null | undefined>;
    /**
     * Sets metadata for a filter
     *
     * @param text - Filter text
     * @param metadata - Metadata to set
     */
    const setMetadata: (
      text: string,
      metadata: FilterMetadata
    ) => Promise<void>;
    /**
     * Returns an array of user filter objects
     *
     * @returns an array of user filter objects
     */
    const getUserFilters: () => Promise<FilterWithMetadata[]>;
    /**
     * Emitted when a new filter is added.
     */
    const onAdded: EventDispatcher<(filter: Filter) => unknown>;
    /**
     * Emitted when a filter is either enabled or disabled. The property name "enabled" or "metadata" and optionally "oldMetadata" is provided.
     */
    const onChanged: EventDispatcher<
        (filter: Filter, property: string) => unknown
    >;
    /**
     * Emitted when a filter is removed.
     */
    const onRemoved: EventDispatcher<(filter: Filter) => unknown>;
    /**
     * Removes one or multiple filters. The filters will no longer have
     * any effect and won't be returned by `filters.getUserFilters()`.
     * @param texts - The filter rules to be removed.
     */
    const remove: (texts: string | string[]) => Promise<void>;
    /**
     * Adds one or multiple filters. The filters will be applied to all
     * requests.
     * @param text - The filter rule to be added.
     * @param metadata - Metadata to be associated with the filter.
     * @returns A promise that resolves when the filter has been added.
     */
    const add: (text: string | string[], metadata?: FilterMetadata) => Promise<void>;
  }

  namespace account {
    /**
     * Retrieves the current user profile
     */
    const getProfile: () => Promise<UserProfile>;

    /**
     * Checks if the user has an active premium subscription.
     */
    const hasPremium: () => Promise<boolean>;

    /**
     * Checks if the user is logged in.
     */
    const isLoggedIn: () => Promise<boolean>;

    /**
     * Logs in the user using a license ID and user ID.
     */
    const logInWithLicense: ({ userId, licenseId }) => Promise<void>;

    /**
     * Logs out the user.
     */
    const logOut: () => Promise<void>;

    /**
     * Retrieves the current user profile sync status.
     */
    const getProfileSyncStatus: () => Promise<ProfileSyncStatus>;


    /**
     * Emitted when the account status has changed
     */
    const onChanged: EventDispatcher<(payload: { user: UserProfile; oldUser: UserProfile }) => unknown>;
  }

  namespace remoteConfig {
    /**
     * Retrieves current remote config revision ID
     */
    const getRevisionId: () => Promise<string | null>;

    /**
     * Retrieves in-product messaging commands
     * @returns in-product messaging commands
     */
    const getIpmCommands: () => Promise<unknown[] | null>;

    /**
     * Emitted when the remote config has changed
     */
    const onChanged: EventDispatcher<() => unknown>;

    /**
     * Sets URL endpoint for fetching the remote config
     * @param {string} url - URL endpoint for fetching the remote config
     */
    const setUrl: (url: string) => void;

    /**
     * Manually triggers synchronization of remote config
     */
    const sync: () => Promise<void>;
  }

  namespace cohorts {
    /**
     * Retrieves the currently active cohorts.
     */
    const getAll: () => Promise<string[]>;

    /**
     * Retrieve the assigned cohorts encoded as a base64-encoded bitmap.
     * @link https://eyeo.atlassian.net/browse/EXT-979
     */
    const getEncodedCohorts: () => Promise<string>;

    /**
     * Returns weather the given cohort is currently active.
     */
    const includes: (cohortId: string) => Promise<boolean>;

    /**
     * Emitted when the active cohorts have changed
     */
    const onChanged: EventDispatcher<(cohortIds: string[]) => unknown>;
  }

  namespace experiments {
    /**
     * Clears all feature flag overrides
     */
    const clearFlagOverrides: () => Promise<void>;
    /**
     * Returns the assignments for the user
     */
    const getAssignments: () => Promise<Record<string, string>>;
    /**
     * Retrieves current experiments
     */
    const getExperiments: () => Promise<Experiment[]>;
    /**
     * Retrieve the experiment assignments encoded as a base64-encoded bitmap.
     * @link https://eyeo.atlassian.net/browse/DATA-2793
     */
    const getEncodedExperiments: () => Promise<string>;
    /**
     * Returns the value of the flag
     */
    const getFlag: (
      flag: string
    ) => Promise<boolean | string | number | string[] | null>;
    /**
     * Retrieves all feature flags, including overridden flags and their values
     */
    const getFlags: () => Promise<Record<string, unknown>>
    /**
     * Overrides a feature flag value
     */
    const overrideFlag: (flagId: string, value: any) => Promise<void>;
    /**
     * Emitted when experiment data has changed
     */
    const onChanged: EventDispatcher<(experiments: Experiment[]) => unknown>;
  }

  namespace notifications {
    /**
     * Returns the number of times the notifications data have been downloaded.
     */
    const getDownloadCount: () => Promise<number>;
    /**
     * Returns the list of ignored notification categories
     */
    const getIgnoredCategories: () => Promise<string[]>;
    const on: (eventName: string, listener: () => unknown) => void;
  }

  namespace reporting {
    /**
     * Returns a mapping between resourceTypes and contentTypes.
     */
    const contentTypesMap: Map<string, string>;
    /**
     * Returns the version of the first ever downloaded resource.
     */
    const getFirstVersion: () => string;
  }

  namespace subscriptions {
    /**
     * The URL of the Acceptable Ads subscription.
     */
    const ACCEPTABLE_ADS_URL: string;

    /**
     * The URL of the Acceptable Ads Privacy subscription.
     */
    const ACCEPTABLE_ADS_PRIVACY_URL: string;
    /**
     * Checks if a subscription has been added.
     *
     * @param url - The URL of the subscription to be checked.
     */
    const has: (url: string) => Promise<boolean>;
    /**
     * Removes the subscription for the given URL. It will no longer have
     * any effect.
     *
     * @param url - The URL of the subscription to be removed.
     */
    const remove: (url: string) => Promise<void>;
    /**
     * Returns an array of all recommended subscriptions.
     */
    const getRecommendations: () => Recommendation[];
    /**
     * Returns an array of all recommended subscriptions.
     */
    const getSubscriptions: () => Promise<Subscription[]>;
    /**
     * Enables a previously disabled subscription. Has no effect otherwise.
     */
    const enable: (url: string) => Promise<void>;
    /**
     * Emitted when a new subscription is added.
     */
    const onAdded: EventDispatcher<(subscription: Subscription) => unknown>;
    /**
     * Emitted when any property of the subscription has changed. The name of the specific property is provided as a string, except when the subscription has been updated, where it will be null.
     */
    const onChanged: EventDispatcher<
        (subscription: Subscription, property: string) => unknown
    >;
    /**
     * Emitted when a subscription is removed.
     */
    const onRemoved: EventDispatcher<(subscription: Subscription) => unknown>;
    /**
     * Returns an array of MV2 to MV3 migration errors and the related
     * subscription.
     */
    const getMigrationErrors: () => Promise<Array<Subscription, string>>;
  }

  namespace cdp {
    /**
     * Emitted when we process a BTAADetectionEvent.
     */
    const onBTAADetectionEvent: EventDispatcher<(
      details: BtaaDetectionDetails
    ) => unknown>;

    /**
     * Opt in or out from CDP
     *
     * @param optOut - `true` to opt out from CDP
     */
    const setOptOut: (optOut: boolean) => Promise<void>;

   /**
     * Function called to set a callback for retrieving premium status.
     *
     * @param callback - Function that will be called to retrieve premium status.
     */
   const setPremiumStatusCallback: (callback: () => Promise<boolean>) => void;
  }

  namespace telemetry {
    /**
     * Opt-out from telemetry. Default is `true` (used opted out)
     * @param value - Pass `true` to opt-out, pass `false` to opt in.
     */
    const setOptOut: (optOut: boolean) => Promise<void>;

    /**
     * Resets the console logging level to "off".
     * @returns {Promise} Promise that resolves when the setting is set.
     */
    export function resetConsoleLogLevel(): Promise<any>;

    /**
     * Sets the intended console logging level.
     *
     * If both the global log level and a module-specific log level are set, the
     * most verbose one takes priority.
     *
     * Setting the log level implies that all less verbose levels are also
     * enabled. For example, enabling "info" logging will also enable "behavior"
     * and "warn" logging.
     *
     * @param {string} level The level you want to log at. Can be one of
     *                       "debug", "info", "behavior", "warn", or "off".
     * @param {string?} module The specific module you want to set the log level
     *                         for. Not passing this sets the global log level.
     * @returns {Promise} Promise that resolves when the setting is set.
     */
    export function setConsoleLogLevel(level: string, module: string): Promise<any>;

    /**
     * Represents a server logger. This is used to send data to a our telemetry
     * server. The exact URL will be configured by the telemetry module in the
     * background script. Console logging is also provided for convenience.
     *
     * @param {string} module The module that this logger is for.
     */
    export class ServerLogger {
      constructor(module: string);
      /**
       * Creates a debug log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      debug(event: string, data?: string | number | object | any[] | boolean | null): void;
      /**
       * Creates an info log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      info(event: string, data?: string | number | object | any[] | boolean | null): void;
      /**
       * Creates a behaviour log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       * @param {string} [ipmId] Optional IPM ID to associate with this event.
       */
      behavior(event: string, data?: string | number | object | any[] | boolean | null, ipmId?: string): void;
      /**
       * Creates a warn log.
       *
       * @param {string} event The name of the event to log. This should be unique.
       * @param {string|number|object|array|boolean|null} data
       *    The dynamic data relevant to the event.
       */
      warn(event: string, data?: string | number | object | any[] | boolean | null): void;
    }
  }
}
