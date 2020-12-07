import browser from "webextension-polyfill";

browser.runtime.onMessage.addListener(message =>
{
  if (typeof message != "object" || message.type != "abp:apply-content-filters")
    return;

  console.log("apply-content-filters message received");
});
