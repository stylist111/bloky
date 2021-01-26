"use strict";

/* eslint-env browser, webextensions */
/* eslint-disable no-console */
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
    ABP.subscriptions.add(subscription.url);
});

ABP.subscriptions.onAdded.addListener(subscription =>
{
  console.log("New subscription added!");
  console.log({subscription});
});

ABP.subscriptions.onRemoved.addListener(subscription =>
{
  console.log("Subscription removed!");
  console.log({subscription});
});

ABP.filters.onAdded.addListener(filter =>
{
  console.log("New filter added!");
  console.log({filter});
});

ABP.filters.onRemoved.addListener(filter =>
{
  console.log("Filter removed!");
  console.log({filter});
});
