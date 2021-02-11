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
  from "../../adblockpluscore/lib/content/elemHideEmulation.js";

import {ignoreNoConnectionError} from "../errors.js";
import {ElementHidingTracer} from "./element-hiding-tracer.js";
import {handleSubscribeLinks} from "./subscribe-links.js";

function getURLFromElement(element)
{
  if (element.localName == "object")
  {
    if (element.data)
      return element.data;

    for (let child of element.children)
    {
      if (child.localName == "param" && child.name == "movie" && child.value)
        return new URL(child.value, document.baseURI).href;
    }

    return null;
  }

  return element.currentSrc || element.src;
}

function hideElement(element)
{
  if (element.localName == "frame")
    element.style.setProperty("visibility", "hidden", "important");
  else
    element.style.setProperty("display", "none", "important");
}

function startElementCollapsing()
{
  let deferred = null;

  browser.runtime.onMessage.addListener((message, sender) =>
  {
    if (!message || message.type != "abp:collapse")
      return;

    if (document.readyState == "loading")
    {
      if (!deferred)
      {
        deferred = new Map();
        document.addEventListener("DOMContentLoaded", () =>
        {
          for (let [selector, urls] of deferred)
          {
            for (let element of document.querySelectorAll(selector))
            {
              if (urls.has(getURLFromElement(element)))
                hideElement(element);
            }
          }

          deferred = null;
        });
      }

      let urls = deferred.get(message.selector) || new Set();
      deferred.set(message.selector, urls);
      urls.add(message.url);
    }
    else
    {
      for (let element of document.querySelectorAll(message.selector))
      {
        if (getURLFromElement(element) == message.url)
          hideElement(element);
      }
    }
  });
}

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
        hideElement(element);

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
