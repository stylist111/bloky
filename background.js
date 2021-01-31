"use strict";

/* eslint-env browser, webextensions */
/* global ABP */

ABP.start().then(() => chrome.tabs.create({url: "/test/index.html"}));

ABP.onSubscribeLinkClicked.addListener(subscription =>
{
  if (confirm(`Do you want to subscribe to ${subscription.title}?`))
    ABP.subscriptions.add(subscription.url);
});
