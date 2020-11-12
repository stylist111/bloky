import {parseURL} from "../adblockpluscore/lib/url.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";

export function sayHello()
{
  console.log("Hello from the api"); // eslint-disable-line no-console
}

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

    // We are looking for the frame that contains the element which
    // has triggered this request. For most requests (e.g. images) we
    // can just use the request's frame ID, but for subdocument requests
    // (e.g. iframes) we must instead use the request's parent frame ID.
    let frameId = details.type == "sub_frame" ? details.parentFrameId :
                                                details.frameId;

    let type = resourceTypes.get(details.type) || "OTHER";

    if (details.type == "image" && details.url.endsWith("/dynamic.png"))
      return {cancel: true};
  }, {
    urls: ["http://*/*", "https://*/*", "ws:/*/*", "wss://*/*"]
  }, ["blocking"]);
}

export function getGoogleInfo()
{
  let url = "https://www.google.com";
  console.log(parseURL(url)); // eslint-disable-line no-console
}
