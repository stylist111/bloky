import {parseURL} from "../adblockpluscore/lib/url.js";

export function sayHello()
{
  console.log("Hello from the api"); // eslint-disable-line no-console
}

export function startBlocking()
{
  chrome.webRequest.onBeforeRequest.addListener(details =>
  {
    if (details.type == "image" && details.url.endsWith("/dynamic.png"))
      return {cancel: true};
  }, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
}

export function getGoogleInfo()
{
  let url = "https://www.google.com";
  console.log(parseURL(url)); // eslint-disable-line no-console
}
