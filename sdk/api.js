function sayHello() {
    console.log("Hello from the api");
}

function startBlocking() {
  chrome.webRequest.onBeforeRequest.addListener(details => {
    if (details.type == "image" && details.url.endsWith("/dynamic.png"))
      return {cancel: true};
  }, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);
}
