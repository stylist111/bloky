import browser from "webextension-polyfill";
import {EventDispatcher} from "./events.js";

let dispatchFunction;

function onMessage(message)
{
  if (typeof message != "object" ||
      message.type != "abp:subscribe-link-clicked")
    return;

  dispatchFunction({title: message.title, url: message.url});
}

export let onSubscribeLinkClicked = new EventDispatcher(dispatch =>
{
  dispatchFunction = dispatch;
});

export function start()
{
  browser.runtime.onMessage.addListener(onMessage);
}

export function stop()
{
  browser.runtime.onMessage.removeListener(onMessage);
}
