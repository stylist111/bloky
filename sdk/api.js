import browser from "webextension-polyfill";

import {BlockingFilter} from "../adblockpluscore/lib/filterClasses.js";
import {parseURL} from "../adblockpluscore/lib/url.js";
import {contentTypes} from "../adblockpluscore/lib/contentTypes.js";
import {defaultMatcher} from "../adblockpluscore/lib/matcher.js";
import {filterEngine} from "../adblockpluscore/lib/filterEngine.js";
import {synchronizer} from "../adblockpluscore/lib/synchronizer.js";
import {Filter} from "../adblockpluscore/lib/filterClasses.js";
import {filterStorage} from "../adblockpluscore/lib/filterStorage.js";
import {Subscription, DownloadableSubscription}
  from "../adblockpluscore/lib/subscriptionClasses.js";
import {recommendations} from "../adblockpluscore/lib/recommendations.js";

import {isAllowlisted} from "./frame-state.js";

const EXTENSION_PROTOCOL = new URL(browser.runtime.getURL("")).protocol;

// Map of content types reported by the browser to the respecitve content types
// used by Adblock Plus. Other content types are simply mapped to OTHER.
let resourceTypes = new Map();
for (let type in contentTypes)
  resourceTypes.set(type.toLowerCase(), type);
resourceTypes.set("sub_frame", "SUBDOCUMENT");
resourceTypes.set("beacon", "PING");
resourceTypes.set("imageset", "IMAGE");
resourceTypes.set("object_subrequest", "OBJECT");

let typeSelectors = new Map([
  ["IMAGE", "img,input"],
  ["MEDIA", "audio,video"],
  ["SUBDOCUMENT", "frame,iframe,object,embed"],
  ["OBJECT", "object,embed"]
]);

async function initializeFilters()
{
  await filterEngine.initialize();
  await synchronizer.start();
  configureDefaultSubscriptions();
}

function configureDefaultSubscriptions()
{
  for (let {url, title, homepage} of getDefaultSubscriptions())
  {
    let subscription = Subscription.fromURL(url);
    subscription.disabled = false;
    subscription.title = title;
    subscription.homepage = homepage;

    filterStorage.addSubscription(subscription);
    if (!subscription.lastDownload)
      synchronizer.execute(subscription);
  }
}

function getDefaultSubscriptions()
{
  let currentLang = browser.i18n.getUILanguage().split("-")[0];
  let defaultLang = (browser.runtime.getManifest().default_locale ||
                     "en_US").split("_")[0];

  let adSubscriptions = [];
  let adSubscriptionsDefaultLang = [];
  let chosenSubscriptions = [];

  for (let subscription of recommendations())
  {
    switch (subscription.type)
    {
      case "ads":
        if (subscription.languages.includes(currentLang))
          adSubscriptions.push(subscription);
        if (subscription.languages.includes(defaultLang))
          adSubscriptionsDefaultLang.push(subscription);
        break;

      case "circumvention":
        chosenSubscriptions.push(subscription);
        break;
    }
  }

  if (adSubscriptions.length > 0 || (adSubscriptions =
                                     adSubscriptionsDefaultLang).length > 0)
  {
    let randomIndex = Math.floor(Math.random() * adSubscriptions.length);
    chosenSubscriptions.unshift(adSubscriptions[randomIndex]);
  }

  return chosenSubscriptions;
}

export function addFilter(filter)
{
  filterEngine.add(Filter.fromText(filter));
}

export function addSubscription(url)
{
  let subscription = Subscription.fromURL(url);

  filterStorage.addSubscription(subscription);
  if (subscription instanceof DownloadableSubscription &&
      !subscription.lastDownload)
    synchronizer.execute(subscription);
}

async function collapse(tabId, frameId, type, url)
{
  let selector = typeSelectors.get(type);
  if (selector && frameId != -1)
  {
    try
    {
      await browser.tabs.sendMessage(
        tabId, {type: "abp:collapse", selector, url}, {frameId}
      );
    }
    catch (e) {}
  }
}

export function startBlocking()
{
  initializeFilters();

  browser.webRequest.onBeforeRequest.addListener(details =>
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
    if (originUrl && (originUrl.protocol == EXTENSION_PROTOCOL ||
                      originUrl.protocol == "chrome:"))
      return;

    // We are looking for the frame that contains the element which
    // has triggered this request. For most requests (e.g. images) we
    // can just use the request's frame ID, but for subdocument requests
    // (e.g. iframes) we must instead use the request's parent frame ID.
    let frameId = details.type == "sub_frame" ? details.parentFrameId :
                                                details.frameId;

    if (isAllowlisted(details.tabId, frameId))
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
        collapse(details.tabId, frameId, type, details.url);
        return {cancel: true};
      }
    }
  }, {
    types: Object.values(browser.webRequest.ResourceType)
                 .filter(type => type != "main_frame"),
    urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"]
  }, ["blocking"]);
}
