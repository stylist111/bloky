"use strict";

/* eslint-env browser, webextensions */
/* global ABP */

ABP.start().then(() =>
{
  let openTest = () => chrome.tabs.create({url: "/test/index.html"});

  if (typeof netscape != "undefined")
    setTimeout(openTest, 1000);
  else
    openTest();
});

ABP.onSubscribeLinkClicked.addListener(subscription =>
{
  if (confirm(`Do you want to subscribe to ${subscription.title ||
                                             subscription.url}?`))
    ABP.addSubscription(subscription.url);
});
