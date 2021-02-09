import {filterStorage} from "../../adblockpluscore/lib/filterStorage.js";
import {Filter, isActiveFilter, InvalidFilter}
  from "../../adblockpluscore/lib/filterClasses.js";
import {isValidHostname} from "../../adblockpluscore/lib/url.js";
import {SpecialSubscription}
  from "../../adblockpluscore/lib/subscriptionClasses.js";
import {isSlowFilter} from "../../adblockpluscore/lib/matcher.js";
import {filterNotifier} from "../../adblockpluscore/lib/filterNotifier.js";
import {filterState} from "../../adblockpluscore/lib/filterState.js";

import {EventDispatcher} from "./events.js";

function convertFilter(filter)
{
  return {
    text: filter.text,
    disabled: filter.disabled,
    slow: isSlowFilter(filter)
  };
}

function makeFilterListener(dispatch)
{
  return filter => dispatch(convertFilter(filter));
}

function makeSubListener(dispatch)
{
  return subscription =>
  {
    if (subscription instanceof SpecialSubscription)
    {
      for (let text of subscription.filterText())
        dispatch(convertFilter(Filter.fromText(text)));
    }
  };
}

export default {
  /**
   * Represents a single filter rule and its state.
   * @typedef {Object} Filter
   * @property {string} text A {@link https://help.eyeo.com/adblockplus/how-to-write-filters|filter}
   *                         rule that specifies what content
   *                         to block or to allow. Used to identify a filter.
   * @property {boolean} disabled Indicates whether this filter would
   *                              be applied. Filters are enabled by default.
   * @property {boolean} slow Indicates that this filter is not subject to an
   *                          internal optimization. Filters that are
   *                          considered slow should be avoided.
   */

  /**
   * Adds a filter from text.
   * @param {string} text The filter rule to be added.
   * @throws {Error} Invalid filter provided.
   * @throws {Error} Invalid domain for filter provided.
   * @return {undefined}
   */
  add(text)
  {
    let filter = Filter.fromText(text);

    if (filter instanceof InvalidFilter)
      throw new Error(`Invalid filter: ${filter.reason}`);

    if (isActiveFilter(filter) && filter.domains)
    {
      for (let domain of filter.domains.keys())
      {
        if (domain && !isValidHostname(domain))
          throw new Error(`Invalid domain for filter: ${domain}`);
      }
    }

    filterStorage.addFilter(filter);
  },

  /**
   * Returns an array of filter objects that have been added to subscriptions.
   * @return {Array.<Filter>}
   */
  getAll()
  {
    let result = [];

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof SpecialSubscription)
      {
        for (let text of subscription.filterText())
          result.push(convertFilter(Filter.fromText(text)));
      }
    }

    return result;
  },

  /**
   * Enables a previously disabled filter. Has no effect otherwise.
   * @param {string} text The filter rule to be enabled.
   * @return {undefined}
   */
  enable(text)
  {
    filterState.setEnabled(text, true);
  },

  /**
   * Disables a filter so that it doesn't have any
   * effect until it gets enabled again.
   * @param {string} text The filter rule to be disabled.
   * @return {undefined}
   */
  disable(text)
  {
    filterState.setEnabled(text, false);
  },

  /**
   * Removes a filter. The filter will no longer have any effect
   * and won't be returned by `filters.getAll()`
   * @param {string} text The filter rule to be removed.
   * @return {undefined}
   */
  remove(text)
  {
    filterStorage.removeFilter(Filter.fromText(text));
  },

  /**
   * Emitted when a new filter is added.
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onAdded: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.added", makeFilterListener(dispatch));
    filterNotifier.on("subscription.added", makeSubListener(dispatch));
  }),

  /**
   * Emitted when a filter is either enabled or disabled.
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filterState.enabled", makeFilterListener(dispatch));
  }),

  /**
   * Emitted when a filter is removed.
   * @event
   * @type {EventDispatcher.<Filter>}
   */
  onRemoved: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.removed", makeFilterListener(dispatch));
    filterNotifier.on("subscription.removed", makeSubListener(dispatch));
  })
};
