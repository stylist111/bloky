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
