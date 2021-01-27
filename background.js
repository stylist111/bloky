"use strict";

/* eslint-env browser, webextensions */
/* eslint-disable no-console */
/* global ABP */

ABP.start().then(() => chrome.tabs.create({url: "/test/index.html"}));

ABP.onSubscribeLinkClicked.addListener(subscription =>
{
  if (confirm(`Do you want to subscribe to ${subscription.title}?`))
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
