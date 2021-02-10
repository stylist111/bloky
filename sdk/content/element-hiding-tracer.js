import browser from "webextension-polyfill";
import {ignoreNoConnectionError} from "../errors.js";

export class ElementHidingTracer
{
  constructor(selectors)
  {
    this.selectors = new Map(selectors);

    this.observer = new MutationObserver(() =>
    {
      this.observer.disconnect();
      setTimeout(() => this.trace(), 1000);
    });

    if (document.readyState == "loading")
      document.addEventListener("DOMContentLoaded", () => this.trace());
    else
      this.trace();
  }

  log(filters, selectors = [])
  {
    ignoreNoConnectionError(browser.runtime.sendMessage(
      {type: "abp:trace-elem-hide", filters, selectors}
    ));
  }

  trace()
  {
    let filters = [];
    let selectors = [];

    for (let [selector, filter] of this.selectors)
    {
      if (document.querySelector(selector))
      {
        this.selectors.delete(selector);
        if (filter)
          filters.push(filter);
        else
          selectors.push(selector);
      }
    }

    if (filters.length > 0 || selectors.length > 0)
      this.log(filters, selectors);

    this.observer.observe(document, {childList: true,
                                     attributes: true,
                                     subtree: true});
  }
}
