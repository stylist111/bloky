import browser from "webextension-polyfill";

import {applyContentFilters} from "./content-filter.js";
import {subscribeLinkClicked, subscribeLinksEnabled}
  from "./subscribe-links.js";
import {logHiddenElements} from "./diagnostics.js";

function onMessage(message, sender)
{
  if (typeof message != "object" || message == null)
    return;

  switch (message.type)
  {
    case "abp:content-hello":
      let {emulatedPatterns, tracedSelectors} =
        applyContentFilters(sender.tab.id, sender.frameId);

      return Promise.resolve({
        emulatedPatterns, tracedSelectors,
        subscribeLinks: subscribeLinksEnabled(sender.url)
      });
    case "abp:subscribe-link-clicked":
      subscribeLinkClicked(message.url, message.title);
      break;
    case "abp:trace-elem-hide":
      logHiddenElements(message.selectors, message.filters, sender.url);
      break;
  }
}

export function start()
{
  browser.runtime.onMessage.addListener(onMessage);
}

export function stop()
{
  browser.runtime.onMessage.removeListener(onMessage);
}
