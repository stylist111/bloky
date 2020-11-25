"use strict";

/* global ABP */

ABP.start().then(() =>
{
  ABP.addFilter("testpages.adblockplus.org##.testcase-sitekey-eh");
  ABP.addFilter("||testpages.adblockplus.org/testfiles/sitekey/outofframe.png");
  ABP.addFilter("||testpages.adblockplus.org/testfiles/sitekey/inframe.png");
  ABP.addFilter("@@$document,sitekey=MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBjGUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ");

  chrome.webRequest.handlerBehaviorChanged();

});
// ABP.addSubscription("https://testpages.adblockplus.org/en/abp-testcase-subscription.txt");
