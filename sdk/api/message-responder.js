import browser from "webextension-polyfill";

import {applyContentFilters} from "./content-filter.js";
import {subscribeLinkClicked, subscribeLinksEnabled}
  from "./subscribe-links.js";

function onMessage(message, sender)
{
  if (typeof message != "object" || message == null)
    return;

  switch (message.type)
  {
    case "abp:content-hello":
      return Promise.resolve({
        emulatedPatterns: applyContentFilters(sender.tab.id, sender.frameId),
        subscribeLinks: subscribeLinksEnabled(sender.url)
      });
    case "abp:subscribe-link-clicked":
      subscribeLinkClicked(message.url, message.title);
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
