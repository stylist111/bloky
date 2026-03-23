import { chrome } from "vitest-chrome/lib/index.esm";

Object.assign(global, { chrome });
chrome.runtime.id = "unit-testing-extension";

chrome.runtime.sendMessage.mockImplementation((...args) => {
  const callback = args[args.length - 1];
  if (typeof callback === "function") {
    callback();
  }
});

const browser = require("webextension-polyfill");
Object.assign(global, { browser });
