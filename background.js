"use strict";

/* eslint-env browser, webextensions */
/* global ABP */

ABP.start();

chrome.tabs.create({url: "/test/index.html"});

ABP.onSubscribeLinkClicked.addListener(subscription =>
{
  if (confirm(`Do you want to subscribe to ${subscription.title ||
                                             subscription.url}?`))
    ABP.addSubscription(subscription.url);
});
