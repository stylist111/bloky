/* For ESLint: List any global identifiers used in this file below */
/* global browser  */

import { getUserId } from "../../../id/background/index";

const webRequestFilter = {
  url: [{ hostSuffix: "getadblock.com" }],
};

function setAdblockUserID(userid) {
  window.adblock_userid = userid;
}

// Have the script tag remove itself once executed (leave a clean
// DOM behind).
function cleanup() {
  const c = document.currentScript;
  const p = c && c.parentNode;
  if (p) {
    p.removeChild(c);
  }
}

// Inject a script tag in the main JS context world
// and then remove itself once executed (leave a clean
// DOM behind).
async function injectScriptTag(adblockUserId) {
  const elem = document.createElement("script");
  const scriptToInject = `(${cleanup.toString()})();(${setAdblockUserID.toString()})('${adblockUserId}');`;
  elem.appendChild(document.createTextNode(scriptToInject));
  try {
    (document.head || document.documentElement).appendChild(elem);
  } catch (ex) {
    // empty
  }
}

const webNavigationHandler = async function (details) {
  let userid = await getUserId();
  const invalidGUIDChars = /[^a-z0-9]/g;
  if (userid.match(invalidGUIDChars)) {
    userid = "invalid";
  }
  const { tabId } = details;
  try {
    if (browser.scripting) {
      void browser.scripting.executeScript({
        target: { tabId: details.tabId },
        func: setAdblockUserID,
        args: [userid],
        world: "MAIN",
      });
    } else {
      const codeToExecute = `${setAdblockUserID.toString()} ${cleanup.toString()} ${injectScriptTag.toString()} injectScriptTag("${userid}");`;
      void browser.tabs.executeScript(tabId, {
        code: codeToExecute,
        allFrames: false,
        runAt: "document_start",
      });
    }
  } catch (error) {
    /* eslint-disable-next-line no-console */
    console.error(error);
  }
};

const start = function () {
  browser.webNavigation.onCommitted.removeListener(webNavigationHandler, webRequestFilter);
  browser.webNavigation.onCommitted.addListener(webNavigationHandler, webRequestFilter);
};
start();
