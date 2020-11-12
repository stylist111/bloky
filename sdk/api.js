import {BlockingFilter} from "../adblockpluscore/lib/filterClasses.js";
import {parseURL} from "../adblockpluscore/lib/url.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";
import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";

export function sayHello()
{
  console.log("Hello from the api"); // eslint-disable-line no-console
}

const extensionProtocol = new URL(chrome.runtime.getURL("")).protocol;

// Map of content types reported by the browser to the respecitve content types
// used by Adblock Plus. Other content types are simply mapped to OTHER.
let resourceTypes = new Map(function*()
{
  for (let type in contentTypes)
    yield [type.toLowerCase(), type];

  yield ["sub_frame", "SUBDOCUMENT"];

  // Treat navigator.sendBeacon() the same as <a ping>, it's essentially the
  // same concept - merely generalized.
  yield ["beacon", "PING"];

  // Treat <img srcset> and <picture> the same as other images.
  yield ["imageset", "IMAGE"];

  // Treat requests sent by plugins the same as <object> or <embed>.
  yield ["object_subrequest", "OBJECT"];
}());

export function startBlocking()
{
  chrome.webRequest.onBeforeRequest.addListener(details =>
  {
    // Firefox provides us with the full origin URL, while Chromium (>=63)
    // provides only the protocol + host of the (top-level) document which
    // the request originates from through the "initiator" property.
    let originUrl = null;
    if (details.originUrl)
      originUrl = parseURL(details.originUrl);
    else if (details.initiator && details.initiator != "null")
      originUrl = parseURL(details.initiator);

    // Ignore requests sent by extensions or by Firefox itself:
    // * Firefox intercepts requests sent by any extensions, indicated with
    //   an "originURL" starting with "moz-extension:".
    // * Chromium intercepts requests sent by this extension only, indicated
    //   on Chromium >=63 with an "initiator" starting with "chrome-extension:".
    // * On Firefox, requests that don't relate to any document or extension are
    //   indicated with an "originUrl" starting with "chrome:".
    if (originUrl && (originUrl.protocol == extensionProtocol ||
                      originUrl.protocol == "chrome:"))
      return;

    let type = resourceTypes.get(details.type) || "OTHER";
    let filter = defaultMatcher.match(details.url, contentTypes[type],
                                      originUrl.hostname, null, false);

    if (filter instanceof BlockingFilter)
    {
      if (typeof filter.rewrite == "string")
      {
        let rewrittenUrl = filter.rewriteUrl(details.url);
        // If no rewrite happened (error, different origin), we'll
        // return undefined in order to avoid an "infinite" loop.
        if (rewrittenUrl != details.url)
          return {redirectUrl: rewrittenUrl};
      }
      else
      {
        return {cancel: true};
      }
    }
  }, {
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  }, ["blocking"]);
}

export function getGoogleInfo()
{
  let url = "https://www.google.com";
  console.log(parseURL(url)); // eslint-disable-line no-console
}
