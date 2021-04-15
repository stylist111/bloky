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

import {filterStorage} from "../../adblockpluscore/lib/filterStorage.js";
import {Filter, ElemHideFilter}
  from "../../adblockpluscore/lib/filterClasses.js";
import {parseURL} from "../../adblockpluscore/lib/url.js";

let logFunction;

export function setLogFunction(func)
{
  logFunction = func;
}

export function logItem(details, filter)
{
  if (logFunction)
    logFunction({details, filter: filter.text});
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
  return !!logFunction;
}
