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

  enable(text)
  {
    filterState.setEnabled(text, true);
  },

  disable(text)
  {
    filterState.setEnabled(text, false);
  },

  remove(text)
  {
    filterStorage.removeFilter(Filter.fromText(text));
  },

  onAdded: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.added", makeFilterListener(dispatch));
    filterNotifier.on("subscription.added", makeSubListener(dispatch));
  }),

  onChanged: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filterState.enabled", makeFilterListener(dispatch));
  }),

  onRemoved: new EventDispatcher(dispatch =>
  {
    filterNotifier.on("filter.removed", makeFilterListener(dispatch));
    filterNotifier.on("subscription.removed", makeSubListener(dispatch));
  })
};
