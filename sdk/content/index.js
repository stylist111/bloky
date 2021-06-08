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

import browser from "webextension-polyfill";

import {ElemHideEmulation}
  from "adblockpluscore/lib/content/elemHideEmulation.js";

import {ignoreNoConnectionError} from "../errors.js";
import {startElementCollapsing, hideElement} from "./element-collapsing.js";
import {ElementHidingTracer} from "./element-hiding-tracer.js";
import {handleSubscribeLinks} from "./subscribe-links.js";

async function initContentFeatures()
{
  let response = await ignoreNoConnectionError(
    browser.runtime.sendMessage({type: "abp:content-hello"})
  );

  if (!response)
    return;

  let tracer;
  if (response.tracedSelectors)
    tracer = new ElementHidingTracer(response.tracedSelectors);

  if (response.emulatedPatterns.length > 0)
  {
    let elemHideEmulation = new ElemHideEmulation((elements, filters) =>
    {
      for (let element of elements)
        hideElement(element, response.cssProperties);

      if (tracer)
        tracer.log(filters);
    });
    elemHideEmulation.apply(response.emulatedPatterns);
  }

  if (response.subscribeLinks)
    handleSubscribeLinks();
}

startElementCollapsing();
initContentFeatures();
