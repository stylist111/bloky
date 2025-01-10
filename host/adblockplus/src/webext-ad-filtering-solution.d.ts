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

declare module "@eyeo/webext-ad-filtering-solution" {
  /**
   * Function called when allowlisting succeeds
   *
   * @param domain - Domain to allowlist
   */
  const AllowlistingCallback: (domain: string) => void;

  /**
   * The EventDispatcher class allows users to listen to certain events that are emitted.
   */
  interface EventDispatcher<T> {
    /**
     * Attaches a listener function to an event. This listener will be called when the event is emitted. Please note that in an MV3 context this has to happen in the first turn of the event loop. This should happen when your service worker starts.
     */
    addListener: (listener: T) => void;
  }

  /**
   * Represents an experiment
   */
  interface Experiment {
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
  interface ExperimentVariant {
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
  interface FiltersGetAllowingFiltersOptions {
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
  interface FilterMatchInfo {
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
  type FilterMetadata = Record<string, any>;

  /**
   * Represents an item that can be blocked.
   */
  interface BlockableItem {
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
      | browser.WebRequest.OnBeforeRequestDetailsType
      | browser.WebRequest.OnHeadersReceivedDetailsType
      | VirtualBlockableItemRequest;
  }

  /**
   * Represents a single filter rule and its state.
   */
  interface Filter {
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
  }

  /**
   * The result of parsing an invalid filter.
   */
  interface FilterError {
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
  interface Recommendation {
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
  interface Subscription {
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
  }

  /**
   * Virtual blockable item request
   */
  interface VirtualBlockableItemRequest {
    /**
     * ID of frame from which request originated
     */
    frameId: browser.Runtime.MessageSender["frameId"];
    /**
     * ID of tab from which request originated
     */
    tabId: browser.Tabs.Tab["id"];
    /**
     * Request URL
     */
    url: string;
  }

  declare namespace allowlisting {
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

  declare namespace filters {
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
     * Returns an extra data associated with a filter
     *
     * @param text - Filter text
     *
     * @returns filter metadata
     */
    const getMetadata: (text: string) => Promise<?FilterMetadata>;
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
    const getUserFilters: () => Promise<Filter[]>;
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
  }

  declare namespace experiments {
    /**
     * Returns the assignments for the user
     */
    const getAssignments: () => Promise<Record<string, string>>;
    /**
     * Retrieves current experiments
     */
    const getExperiments: () => Promise<Experiment[]>;
    /**
     * Returns the value of the flag
     */
    const getFlag: (
      flag: string
    ) => Promise<boolean | string | number | string[] | null>;
    /**
     * Retrieves current experiment data revision ID
     */
    const getRevisionId: () => Promise<string | null>;
    /**
     * Emitted when experiment data has changed
     */
    const onChanged: EventDispatcher<(experiments: Experiment[]) => unknown>;
  }

  declare namespace notifications {
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

  declare namespace reporting {
    /**
     * Returns a mapping between resourceTypes and contentTypes.
     */
    const contentTypesMap: Map<string, string>;
    /**
     * Returns the version of the first ever downloaded resource.
     */
    const getFirstVersion: () => string;
  }

  declare namespace subscriptions {
    /**
     * The URL of the Acceptable Ads subscription.
     */
    const ACCEPTABLE_ADS_URL: string;

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
  }

  declare namespace cdp {
    /**
     * Opt in or out from CDP
     *
     * @param optOut - `true` to opt out from CDP
     */
    const setOptOut: (optOut: boolean) => Promise<void>;

    /**
     * Returns whether opted out from CDP
     */
    const isOptOut: () => Promise<boolean>;
  }

  declare namespace telemetry {
    /**
     * Opt-out from telemetry. Default is `true` (used opted out)
     * @param value - Pass `true` to opt-out, pass `false` to opt in.
     */
    const setOptOut: (optOut: boolean) => Promise<void>;
  }
}
