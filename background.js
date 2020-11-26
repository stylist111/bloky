"use strict";

/* eslint-env browser */
/* global ABP */

ABP.start();
ABP.onSubscribeLinkClicked.addListener(subscription =>
{
  if (confirm(`Do you want to subscribe to ${subscription.title ||
                                             subscription.url}?`))
    ABP.addSubscription(subscription.url);
});
