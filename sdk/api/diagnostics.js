import {filterStorage} from "../../adblockpluscore/lib/filterStorage.js";
import {Filter, ElemHideFilter}
  from "../../adblockpluscore/lib/filterClasses.js";
import {parseURL} from "../../adblockpluscore/lib/url.js";

import {EventDispatcher} from "./events.js";

let dispatchFunction;

export let onFilterMatch = new EventDispatcher(
  dispatch =>
  {
    dispatchFunction = dispatch;
  },
  () =>
  {
    dispatchFunction = null;
  }
);

export function logItem(details, filter)
{
  if (dispatchFunction)
    dispatchFunction({details, filter: filter.text});
}

export function logHiddenElements(selectors, filters, url)
{
  if (selectors.length > 0)
  {
    let {hostname} = parseURL(url);

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription.disabled)
        continue;

      for (let text of subscription.filterText())
      {
        let filter = Filter.fromText(text);

        if (filter instanceof ElemHideFilter &&
            selectors.includes(filter.selector) &&
            filter.isActiveOnDomain(hostname))
          logItem(null, filter);
      }
    }
  }

  for (let text of filters)
    logItem(null, Filter.fromText(text));
}

export function tracingEnabled()
{
  return !!dispatchFunction;
}
