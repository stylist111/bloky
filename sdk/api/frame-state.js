/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "./browser.js";

import {parseURL} from "adblockpluscore/lib/url.js";
import {ALLOWING_TYPES, contentTypes}
  from "adblockpluscore/lib/contentTypes.js";

import {filterEngine} from "./core.js";
import {logItem} from "./diagnostics.js";
import {getSitekey, clearTabSitekeys,
        addListener as addOnSitekeyReceivedListener} from "./sitekey.js";
import {applyContentFilters} from "./content-filter.js";
import {trace, debug} from "./debugging.js";
import {ignoreNoConnectionError} from "../errors.js";

/**
 * The URL that browsers use to represent an empty page, about:blank.
 */
export const BLANK_PAGE_URL = "about:blank";

/**
 * The frameId of the top level frame on each tab.
 */
export const TOP_LEVEL_FRAME_ID = 0;

/**
 * Checks if a frameId corresponds to the top level frame on a tab.
 * @param {number} frameId
 * @return {boolean}
 */
export function isTopLevelFrameId(frameId) {
  return frameId == TOP_LEVEL_FRAME_ID;
}

/**
 * Checks if a frameId corresponds to a frame on a tab.
 * @param {number} frameId
 * @return {boolean}
 */
export function isValidFrameId(frameId) {
  return frameId >= TOP_LEVEL_FRAME_ID;
}

/**
 * Checks if a frameId corresponds to an iframe.
 * @param {number} frameId
 * @return {boolean}
 */
export function isValidChildFrameId(frameId) {
  return frameId > TOP_LEVEL_FRAME_ID;
}

/**
 * All known currently active frames, that can be looked up by
 * `tabId`, and then by `frameId` (`[tabId, [frameId, FrameInfo]]`).
 *
 * Maintaining this state is the central reason for the code in this
 * file. When we start up EWE, we scan all existing tabs for their
 * frames. After that, we hook into various browser events to try to
 * keep it up to date as things change.
 *
 * @type {Map<number, Map<number, FrameInfo>>}
 */
let state = new Map();
let startupPromise;

/**
 * Manages tracking state that is tied to a single specific frame.
 *
 * A simple webpage will have a single frame in a tab. However, when
 * we look at sites with advertising and embedded trackers, they often
 * have many <iframe> elements. Each iframe may have slightly
 * different state, but generally a frame will inherit settings from
 * the frame that it's on (its parent frame).
 *
 * This state is mostly used in applying frame-level allowing filters
 * (eg `$document` filters), but is also used to hold parameters like
 * what hostname to use when checking if filters match a request, and
 * whether or not a sitekey is involved. This needs to be done
 * statefully because we inherit some state from parent frames.
 *
 * We sometimes need access to this data synchronously (for example to
 * do request filtering), but the functions to fetch this data from
 * the browser on demand are asynchronous. The events where we need to
 * make decisions based on the frame usually have some of the frame's
 * state, like the URL of the frame, but don't have the sitekey and
 * don't have all of the information about the parents of the frame.
 *
 * @property {number} tabId The id of the tab.
 * @property {string} url The url of the frame.
 * @property {string} hostname The hostname part of the frame's
 *   URL. If the URL isn't a normal HTTP URL (for example if it's
 *   about:blank) then this will be the parent frame's hostname. If
 *   that also doesn't have a normal HTTP hostname, then this will
 *   default to an empty string.
 * @property {?string} sitekey The sitekey associated with a frame, if
 *   there is one. These sitekeys are read from the
 *   `onHeadersReceived` event. This is inherited from the parent
 *   frame if this frame doesn't have a sitekey of its own.
 * @property {boolean} headersReceived True if we've received an
 *   `onHeadersReceived` event for this frame and have checked it for
 *   sitekeys. If this is false, it could mean that we don't have
 *   enough information yet to make blocking decisions, because a
 *   sitekey might still arrive with the headers.
 * @property {?FrameInfo} parent The frame that this from is on. Null
 *   if this is the top-level frame on a tab.
 * @property {number} allowlisted Bitfield where each set bit is the
 *   content type of an allowlisting filter applied to the frame. This
 *   includes filters that turn of ad filtering entirely, like
 *   `$document` filters, but also includes filters that modify how we
 *   look up request filters like `$genericblock`.
 * @property {?Filter} allowingDocumentFilter The `$document` filter
 *   that is being applied to this frame, if any. This is useful for
 *   logging, for example if a request is allowed because of this
 *   filter. If you just need to check if there is a `$document` filter
 *   applied to the frame or not, you can also check
 *   `frame.allowlisted`.
 *
 * @param {number} tabId The tabId of the tab that the this frame is on.
 * @param {number} frameId The frameId of this frame.
 * @param {?FrameInfo} parent The frame that this from is on. Null
 *   if this is the top-level frame on a tab.
 * @param {string} url The url of the frame.
 * @hideconstructor
 */
class FrameInfo {
  constructor(tabId, frameId, parent, url) {
    this.tabId = tabId;
    this.frameId = frameId;
    this.parent = parent;

    initializeFrameWithUrl(this, url);
    findAllowlistingFilters(this);
  }
}

/**
 * Get a text description of the allowing filter added.
 * @param {number} typeMask Bitset to filter types you want to name.
 * @param {Filter} filter The filter with the allowing reason you want
 *   to name.
 * @return {string} Content type name of the allowing filter just
 *   added.
 */
function getAllowingReason(typeMask, filter) {
  for (let type in contentTypes) {
    if (typeMask & filter.contentType & contentTypes[type]) {
      return type.toLowerCase();
    }
  }
}

function initializeFrameWithUrl(frame, url) {
  let {
    allowlisted: parentAllowlisted,
    sitekey: parentSitekey,
    allowingDocumentFilter: parentAllowingDocumentFilter,
    hostname: parentHostname
  } = frame.parent || {};

  let urlInfo = parseURL(url);
  frame.url = url;
  frame.hostname = urlInfo.hostname || parentHostname || "";

  let sitekey = getSitekey(frame.tabId, frame.frameId, url);
  frame.sitekey = sitekey || parentSitekey;
  frame.headersReceived = (!!sitekey) || sitekey === null;

  // allowlisted and allowingDocumentFilter start with their parent
  // value, but may have extra allowing filters added when we call
  // findAllowlistingFilters
  frame.allowlisted = parentAllowlisted || 0;
  frame.allowingDocumentFilter = parentAllowingDocumentFilter;
}

/**
 * Checks if the matcher has any allowing filters that should be
 * applied to this frame, and updates `frame.allowlisted` and
 * `frame.allowingDocumentFilter` accordingly.
 *
 * This can only ever add extra allowing filters. It's also safe to
 * call multiple times on the same frame. This would normally be
 * called on a new frame to find its allowing filters, but should also
 * be called whenever a frame is updated in such a way that there
 * could be new allowing filters, for example when a sitekey is added
 * to an existing frame.
 *
 * @param {FrameInfo} frame The frame that will be checked for new
 *   filters, and will be updated.
 * @param {number} tabId The tabId of the tab the frame is on. Used for
 *   logging.
 * @param {number} frameId The frameId of the frame. Used for logging.
 */
function findAllowlistingFilters(frame) {
  let {tabId, frameId, url} = frame;
  let details = {tabId, frameId, url};
  // The docDomain for a frame is the hostname of the parent frame
  // (the loader). For top-level frames we use the current URL's hostname.
  let parentHostname = frame.parent && frame.parent.hostname;
  let matchInfo = {docDomain: parentHostname || frame.hostname,
                   method: "allowing"};

  // This loop will keep trying to find new types of allowing filters
  // for the frame until the matcher doesn't return any more.
  while (true) {
    let typeMask = ~frame.allowlisted & ALLOWING_TYPES;
    debug(`Check match tabId=${tabId}, url=${frame.url}, typeMask=${typeMask}, ` +
      `docDomain=${matchInfo.docDomain}, sitekey=${frame.sitekey}`);
    let filter = filterEngine.defaultMatcher.match(
      frame.url, typeMask, matchInfo.docDomain, frame.sitekey
    );

    if (!filter) {
      debug(`No filter for tabId=${tabId},frameId=${frameId}`);
      break;
    }

    frame.allowlisted |= filter.contentType & ALLOWING_TYPES;
    // We need to hold onto document allowing filters because we might
    // need it for logging blockable requests later.
    if (filter.contentType & contentTypes.DOCUMENT) {
      frame.allowingDocumentFilter = filter;
    }

    let allowingReason = getAllowingReason(typeMask, filter);
    debug(`Allowing tabId=${tabId}, frameId=${frameId} due to ${filter.text}`);
    logItem(details, filter, {...matchInfo, allowingReason});
  }
}

/**
 * Builds the frame state from scratch using the tabs API.
 *
 * This is called on startup, and in MV3 whenever the service worker
 * starts up. The only shortcoming is that this can't find sitekeys
 * for existing frames, since those are read from headers.
 * @async
 * @return {Promise} Resolves when all frames have been scanned.
 */
async function discoverExistingFrames() {
  let tabs = await browser.tabs.query({});
  await Promise.all(tabs.map(({id: tabId}) =>
    browser.webNavigation.getAllFrames({tabId}).then(rawFrames => {
      if (!rawFrames) {
        return;
      }

      // Sort the frames so that we'll add parent frames before the
      // child frames.
      rawFrames.sort((a, b) => a.frameId - b.frameId);

      let frames = new Map();
      state.set(tabId, frames);

      for (let {frameId, parentFrameId, url} of rawFrames) {
        let parent = isValidFrameId(parentFrameId) ?
            frames.get(parentFrameId) :
            null;

        // Chrome unfortunately has a bug where getAllFrames doesn't
        // always return all parent frames
        // (https://bugs.chromium.org/p/chromium/issues/detail?id=725917).
        // Not much we can do about it, but if we can't see the
        // required parent frame we can fall back to the root frame.
        if (isValidChildFrameId(parentFrameId) && !parent) {
          parent = frames.get(TOP_LEVEL_FRAME_ID);
        }

        // Yandex gives undefined or an empty string here sometimes,
        // for example when browsing to pages that Yandex treats
        // specially like their own website.
        if (!url) {
          url = BLANK_PAGE_URL;
        }

        frames.set(frameId, new FrameInfo(tabId, frameId, parent, url));
      }
    })
  ));
}

export function onSitekeyReceived(tabId, frameId, url, sitekey) {
  trace({tabId, frameId, url, sitekey});

  let frame = getFrameInfo(tabId, frameId);

  // It can happen that sub-frame "onCommitted" event is triggered after it's
  // resource loading event, meaning we don't have a frame information
  // in frame state, thus skip finding allowlisting filters, resulting in
  // frame resources are not allowlisted as expected.
  if (!frame) {
    frame = recordFrameFromNavigationEvent({tabId, frameId, url});
  }
  let isSameFrame = frame.url == url;
  if (isSameFrame) {
    frame.headersReceived = true;
  }

  if (sitekey) {
    // Sometimes the onHeadersReceived event comes after the
    // onCommitted event. This seems to be common when loading
    // iframes: the browser will show the iframe and then start
    // loading its contents. When this happens, we may get a sitekey
    // for a frame that's already being shown, and that may mean we
    // need to add some new allowlisting filters based on that
    // sitekey.
    if (isSameFrame && frame.sitekey != sitekey) {
      frame.sitekey = sitekey;
      findAllowlistingFilters(frame);
    }
  }
}


/**
 * Updates the frame state to reflect that a new frame is being shown.
 *
 * This can broadly be thought of in two categories:
 *
 * 1. The browser has navigated to the new page. Specifically, this is
 *    on the `webNavigation.onCommitted` event, which fires when the
 *    browser has decided to switch to the new document. We will
 *    usually have received headers for the document already by this
 *    point, but not always.
 * 2. The site is a single page application, and has updated its
 *    contents using Javascript and updated its URL with the history
 *    API.
 *
 * @param {Object} details Details object as provided by the
 *   webNavigation API events.
 * @param {number} details.tabId The tabId of the tab that the updated
 *   frame is on.
 * @param {number} details.frameId The frameId of the updated frame.
 * @param {number} [details.parentFrameId=-1] The frameId of the frame
 *   that the updated frame is on. -1 if the updated frame is the
 *   top-level frame.
 * @param {string} details.url The new url of the frame.
 * @param {Object} [options={}]
 * @param {boolean} [options.historyStateUpdated=false] True if this
 *   was triggered by a history state update, rather than by a full
 *   page navigation.
 * @param {boolean} [options.errorOccurred=false] True if this was
 *   triggered by a `webNavigation.onErrorOccurred` event rather than
 *   a `webNavigation.onCommitted` event.
 * @return {FrameInfo} The newly created frame state.
 */
function recordFrameFromNavigationEvent(
  {tabId, frameId, parentFrameId = -1, url},
  {historyStateUpdated = false, errorOccurred = false} = {}) {
  // Yandex gives undefined or an empty string here sometimes,
  // for example when browsing to pages that Yandex treats
  // specially like their own website.
  if (!url) {
    url = BLANK_PAGE_URL;
  }

  let frames = state.get(tabId);

  // We generally need to throw away any existing frame state for the
  // whole tab when a new top-level frame is committed to the
  // tab. This is because all previous frame state was on the old
  // top-level frame. However, if this was a history API update, those
  // frames could still be there on the page so we can't clear them out.
  if (!frames || (isTopLevelFrameId(frameId) && !historyStateUpdated)) {
    frames = new Map();
    state.set(tabId, frames);
  }
  let frame = frames.get(frameId);
  let parent = isValidFrameId(parentFrameId) ? frames.get(parentFrameId) : null;

  // Same as discoverExistingFrames, if we expect a parent but our
  // frame state doesn't seem to have that parent, falling back to the
  // root frame is better than nothing. This might happen due to this
  // bug: https://bugs.chromium.org/p/chromium/issues/detail?id=725917.
  if (isValidChildFrameId(parentFrameId) && !parent) {
    parent = frames.get(TOP_LEVEL_FRAME_ID);
  }

  // If the frame had an error instead of loading, we don't want to
  // use the URL from the error. Otherwise unscrupulous websites could
  // embed their advert in an iframe that has an allowlisted URL, but
  // doesn't actually contain the contents of that URL.
  if (errorOccurred) {
    if (frame) {
      url = frame.url;
    }
    else if (parent) {
      url = parent.url;
    }
  }

  // We might get multiple calls to `recordFrameFromNavigationEvent`
  // for iframes. This is because we need to listen to several
  // different events to hear about all frames, including onCommitted
  // and onBeforeNavigate and onErrorOccurred. To avoid duplicate
  // onBlockableItem events, we check if the frame we already have is
  // the same.
  if (!frame || isTopLevelFrameId(frameId) ||
      frame.url != url || frame.parent != parent) {
    frame = new FrameInfo(tabId, frameId, parent, url);
    frames.set(frameId, frame);
  }
  return frame;
}

function onBeforeNavigate(details) {
  trace({details});

  // We know the current frame information is about to become
  // outdated, so we just delete the existing data.
  let frames = state.get(details.tabId);
  if (frames) {
    // Firefox can trigger "onBeforeNavigate" multiple times,
    // so we need to filter out only the actually changed navigations.
    let frame = frames.get(details.frameId);
    if (frame && frame.url != details.url) {
      // We need to skip processing the frame state events for now
      // (such as allowlisted for document) as it will be done later during
      // the `onCommitted`, but we also want to avoid allowlisting for some
      // resources that refer to this tabId/frameId as the URL is changed,
      // and the allowlisting state is currently undetermined.
      frame.isChangingURL = true;
      initializeFrameWithUrl(frame, details.url);
    }
  }

  // If an iframe's URL is "about:srcdoc", that means its contents is
  // actually specified using the srcdoc attribute. Some browsers
  // don't actually emit the webNavigation.onCommitted event for these
  // frames, so we need to use a different event to get them into our
  // frame state.
  if (details.url == "about:srcdoc") {
    recordFrameFromNavigationEvent(details);
  }
}

function onCommitted(details) {
  trace({details});

  let frame = recordFrameFromNavigationEvent(details);
  findAllowlistingFilters(frame);
  frame.isChangingURL = false;
}

function onErrorOccurred(details) {
  trace({details});

  // On Chrome, errored iframes are never committed, but they are
  // still on the page and their contents can still be manipulated
  // with Javascript so we need them in our frame state.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=725917
  //
  // Firefox's docs don't mention parentFrameId on this event, but
  // Chrome's do, and it does appear to be there in practice. Check
  // for it before proceeding in case some browsers don't, since it's
  // very important to have the parent frame to record frame state
  // changes.
  if (isValidChildFrameId(details.frameId) &&
      typeof details.parentFrameId == "number") {
    recordFrameFromNavigationEvent(details, {errorOccurred: true});
  }
}

async function onHistoryStateUpdated(details) {
  trace({details});

  let previousFrame = getFrameInfo(details.tabId, details.frameId);
  recordFrameFromNavigationEvent(details, {historyStateUpdated: true});

  // Don't rerun the snippets due to possible performance penalty (EE-507)
  let filterData = await applyContentFilters(
    details.tabId, details.frameId, previousFrame, true);
  try {
    await ignoreNoConnectionError(
      browser.tabs.sendMessage(
        details.tabId,
        {type: "ewe:apply-content-features", ...filterData},
        {frameId: details.frameId})
    );
  }
  catch (e) {
    console.error(e);
  }
}

/**
 * @ignore
 */
export function _clear() {
  state.clear();
}

function handleOnRemoved(tabId) {
  state.delete(tabId);
  clearTabSitekeys(tabId);
}

function onRemoved(tabId) {
  trace({tabId});
  handleOnRemoved(tabId);
}

function onReplaced(addedTabId, removedTabId) {
  trace({addedTabId, removedTabId});
  handleOnRemoved(removedTabId);
}

/**
 * Gets the state for a frame if we have it. If parentFrameId and
 * initiator are also provided, this function may also construct the
 * frame and add it to the frame state.
 *
 * @param {number} tabId The tabId of the tab the frame is on.
 * @param {number} frameId The frameId of the frame.
 * @param {?Object} [metadata] Additional metadata about the web
 *   request context that lead to asking for frame info, which might
 *   be used to create a FrameInfo if one doesn't exist already.
 * @param {?number} metadata.parentFrameId The frameId of the parent of the
 *   frame being requested. If this is set, it could be used to
 *   create the frame if it isn't already in the frame state.
 * @param {?string} metadata.initiator If getting the frame info is
 *   triggered by a web request, this should be the URL that initiated
 *   the request. If this is set, it can be used to provide a
 *   temporary frame state for use with service workers. In Firefox
 *   APIs, there is not an initiator but there is a documentUrl which
 *   can fulfil the same purpose.
 * @param {?string} metadata.documentUrl If getting the frame info is
 *   triggered by a web request, this should be the URL of the frame
 *   that initiated the request. If this is set, it could be used to
 *   create the frame if it isn't already in the frame state. This may
 *   not be available in Chrome. In Chrome, if initiator is provided,
 *   it can also be used to construct a FrameInfo, but this is not
 *   ideal since the initiator only contains the domain part of the
 *   URL.
 * @returns {?FrameInfo}
 */
export function getFrameInfo(tabId, frameId,
                             {parentFrameId, initiator, documentUrl} = {}) {
  // tabId is -1 if the request came from a service worker, so we
  // construct a temporary frame state for it to use. We don't store
  // a tabId of -1 in our frame state, so we don't even need to check
  // it before returning.
  if (initiator && tabId == -1) {
    return new FrameInfo(tabId, frameId, null, initiator);
  }

  let frames = state.get(tabId);
  if (frames) {
    let frame = frames.get(frameId);
    if (frame) {
      return frame;
    }
  }

  // Sometimes the webRequest API can trigger for resources in a frame
  // before the onCommitted event for the frame. In this case, it
  // should be safe to construct the frame state early.
  if (documentUrl && typeof parentFrameId == "number") {
    return recordFrameFromNavigationEvent({
      tabId,
      frameId,
      parentFrameId,
      url: documentUrl
    });
  }
}

export async function start() {
  if (!startupPromise) {
    addOnSitekeyReceivedListener(onSitekeyReceived);

    browser.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    browser.webNavigation.onCommitted.addListener(onCommitted);
    browser.webNavigation.onErrorOccurred.addListener(onErrorOccurred);
    browser.webNavigation.onHistoryStateUpdated.addListener(
      onHistoryStateUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    browser.tabs.onReplaced.addListener(onReplaced);

    startupPromise = discoverExistingFrames();
  }

  await startupPromise;
}
