import browser from "webextension-polyfill";
import {ignoreNoConnectionError} from "../errors.js";

export function handleSubscribeLinks()
{
  document.addEventListener("click", event =>
  {
    if (event.button == 2 || !event.isTrusted)
      return;

    let link = event.target;
    while (!(link instanceof HTMLAnchorElement))
    {
      link = link.parentNode;

      if (!link)
        return;
    }

    let queryString = null;
    if (link.protocol == "http:" || link.protocol == "https:")
    {
      if (link.host == "subscribe.adblockplus.org" && link.pathname == "/")
        queryString = link.search.substr(1);
    }
    else
    {
      // Firefox doesn't seem to populate the "search" property for
      // links with non-standard URL schemes so we need to extract the query
      // string manually.
      let match = /^abp:\/*subscribe\/*\?(.*)/i.exec(link.href);
      if (match)
        queryString = match[1];
    }

    if (!queryString)
      return;

    let title = null;
    let url = null;
    for (let param of queryString.split("&"))
    {
      let parts = param.split("=", 2);
      if (parts.length != 2 || !/\S/.test(parts[1]))
        continue;
      switch (parts[0])
      {
        case "title":
          title = decodeURIComponent(parts[1]);
          break;
        case "location":
          url = decodeURIComponent(parts[1]);
          break;
      }
    }
    if (!url)
      return;

    if (!title)
      title = url;

    title = title.trim();
    url = url.trim();
    if (!/^(https?|ftp):/.test(url))
      return;

    ignoreNoConnectionError(
      browser.runtime.sendMessage({type: "abp:subscribe-link-clicked",
                                   title, url})
    );

    event.preventDefault();
    event.stopPropagation();
  }, true);
}
