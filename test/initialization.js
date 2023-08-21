/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import expect from "expect";

import {setMinTimeout, isMV3, TEST_MV3_SUBSCRIPTION, TEST_MV3_SUBSCRIPTION_2,
        TEST_MV3_SUBSCRIPTION_3} from "./utils.js";
import {EWE, runInBackgroundPage}
  from "./messaging.js";
import {subCircumvention} from "./api-fixtures.js";
import {isFuzzingServiceWorker} from "./mocha/mocha-runner.js";

const ADDON_NAME = "foo";
const ADDON_VERSION = "2.1";

let subEasylist = {
  id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
  type: "ads",
  languages: [
    "en"
  ],
  title: "EasyList",
  homepage: "https://easylist.to/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt"
};

let subEasylistPlusGermany = {
  id: "0CD3D105-D3B3-4652-8489-94163DE9A08F",
  type: "ads",
  languages: [
    "de"
  ],
  title: "EasyList Germany+EasyList",
  homepage: "https://easylist.to/",
  includes: [
    "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
    "4337FB2B-A95C-44D5-B78D-11AD40F7711B"
  ],
  url: "https://easylist-downloads.adblockplus.org/v3/full/easylistgermany+easylist.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"
};

let subAcceptableAds = {
  id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
  type: "allowing",
  title: "Allow nonintrusive advertising",
  homepage: "https://acceptableads.com/",
  url: "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
  mv2_url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
};

let subDiffUpdatable = {
  id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7A",
  type: "ads",
  homepage: "http://localhost:3003/subscription.txt",
  title: "Test MV3 Custom Subscription 3",
  url: "http://localhost:3003/subscription2.txt",
  mv2_url: "http://localhost:3003/subscription2.txt",
  diff_url: "http://localhost:3003/anti-cv-subscription_diff2.json"
};

describe("Initialization", function() {
  isFuzzingServiceWorker ?
    setMinTimeout(this, 30000) : setMinTimeout(this, 10000);

  it("starts with the subscription info provided by the initial start call [mv3-only]",
     async function() {
       // Eventually this should be supported in MV2 as well.
       // https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/392

       let receivedStartupInfo = await runInBackgroundPage([
         {op: "getGlobal", arg: "EWE"},
         {op: "getProp", arg: "debugging"},
         {op: "getProp", arg: "addonInfo"}
       ]);

       // The list of bundled subscriptions is passed as an
       // argument to EWE.start in the background.js file.
       expect(receivedStartupInfo).toEqual(
         expect.objectContaining(
           {
             bundledSubscriptions: expect.arrayContaining([
               TEST_MV3_SUBSCRIPTION, TEST_MV3_SUBSCRIPTION_2,
               TEST_MV3_SUBSCRIPTION_3,
               subEasylist, subEasylistPlusGermany, subCircumvention,
               subAcceptableAds
             ]),
             bundledSubscriptionsPath: "subscriptions"
           })
       );
     }
  );

  it("starts with default addon info [mv2-only]", async function() {
    // MV2 only because from MV3 the addonInfo is mandatory.
    let manifest = browser.runtime.getManifest();

    await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "callMethod", arg: "start"},
      {op: "await"}
    ]);

    let addonInfo = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "debugging"},
      {op: "getProp", arg: "addonInfo"}
    ]);

    expect(addonInfo).toEqual(
      expect.objectContaining({
        name: manifest.short_name || manifest.name,
        version: manifest.version,
        manifestVersion: String(manifest.manifest_version)
      })
    );
  });

  it("starts with the provided subscriptions enabled and correctly downloadable", async function() {
    // https://gitlab.com/eyeo/adblockplus/abc/webext-ad-filtering-solution/-/issues/545
    this.retries(3);
    await EWE.subscriptions.add(TEST_MV3_SUBSCRIPTION.url);

    // The list of bundled subscriptions is passed as an
    // argument to EWE.start in the background.js file.
    let subs = await EWE.subscriptions.getDownloadable();
    expect(subs).toEqual([
      expect.objectContaining({
        enabled: true,
        downloadable: !isMV3(),
        id: isMV3() ? TEST_MV3_SUBSCRIPTION.id : null
      })
    ]);
  });

  for (let [language, mv2subscriptionUrl, mv3subscriptionUrl, tags] of [
    ["en",
     "https://easylist-downloads.adblockplus.org/easylist.txt",
     "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt",
     "[fuzz]"],
    ["de",
     "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt",
     "https://easylist-downloads.adblockplus.org/v3/full/easylistgermany+easylist.txt",
     ""]
  ]) {
    it(`configures default subscriptions for ${language} ${tags}`, async function() {
      // Sometimes saving to storage takes more time
      setMinTimeout(this, 20000);

      let startSubscriptions = [
        subCircumvention,
        subAcceptableAds
      ];

      // default language (required even for "de")
      startSubscriptions.push(subEasylist);

      if (language == "de") {
        startSubscriptions.push(subEasylistPlusGermany);
      }

      await EWE.subscriptions.addDefaults(language);

      let activeSubs = await EWE.subscriptions.getDownloadable();

      let expectedUrls;
      if (isMV3()) {
        expectedUrls = [
          mv3subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt",
          "http://localhost:3003/anti-cv-subscription.txt"
        ];
      }
      else {
        expectedUrls = [
          mv2subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
          "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
        ];
      }

      expect(activeSubs).toEqual(
        expect.arrayContaining(expectedUrls.map(
          url => expect.objectContaining({url, enabled: true})
        )));

      for (let subscription of activeSubs) {
        expect(expectedUrls).toContain(subscription.url);
      }
    });
  }

  it("configures AA in default subscriptions from built-in adblockpluscore list", async function() {
    let recommendations = await EWE.testing._recommendations();

    // Force load from the default list (core/data/subscriptions.json)
    await EWE.testing._setRecommendations(null);

    try {
      let defaultSubscriptions =
        await EWE.testing._getDefaultSubscriptions("en");
      expect(defaultSubscriptions.hasAA).toEqual(true);
    }
    finally {
      await EWE.testing._setRecommendations(recommendations);
    }
  });

  async function skipsAddingDefaultSubscriptions(subUrl, hasDiffUrl) {
    await EWE.testing._setSubscriptions([
      subEasylist,
      subAcceptableAds,
      subCircumvention,
      subDiffUpdatable
    ]);
    await EWE.subscriptions.add(subUrl);

    await EWE.subscriptions.addDefaults("en");

    let activeSubs = await EWE.subscriptions.getDownloadable();
    expect(activeSubs).toEqual([
      expect.objectContaining({
        url: subUrl
      })
    ]);
    expect("diffURL" in activeSubs[0]).toBe(hasDiffUrl);
  }

  it("skips adding default subscriptions if there is a CountableSubscription [mv3-only] [fuzz-skip]", async function() {
    await skipsAddingDefaultSubscriptions(
      subEasylist.url, false); // CountableSubscription
  });

  it("skips adding default subscriptions if there is a DiffUpdatableSubscription [mv3-only] [fuzz-skip]", async function() {
    await skipsAddingDefaultSubscriptions(
      subDiffUpdatable.url, true); // DiffUpdatableSubscription
  });

  it("adds only one preferred AA subscription when multiple provided [mv3-only] [fuzz-skip]", async function() {
    let alternativeAAUrl = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";

    await EWE.testing._setSubscriptions([
      subEasylist,
      subAcceptableAds,
      {
        type: "allowing",
        title: "Allow nonintrusive advertising without third-party tracking",
        url: alternativeAAUrl,
        homepage: "https://acceptableads.com/"
      },
      subCircumvention
    ]);

    await EWE.subscriptions.addDefaults("en");
    let activeSubs = await EWE.subscriptions.getDownloadable();
    expect(activeSubs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subAcceptableAds.url
      })
    ]));
    expect(activeSubs).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: alternativeAAUrl
      })
    ]));
  });

  it("adds all AA subscription when multiple provided without preferred AA subscription [mv3-only] [fuzz-skip]", async function() {
    let alternativeAAUrl1 = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly.txt";
    let alternativeAAUrl2 = "https://easylist-downloads.adblockplus.org/exceptionrules-privacy-friendly-2.txt";

    await EWE.testing._setSubscriptions([
      subEasylist,
      {
        id: "ID1",
        type: "allowing",
        title: "Allow nonintrusive advertising without third-party tracking",
        url: alternativeAAUrl1,
        homepage: "https://acceptableads.com/"
      },
      {
        id: "ID2",
        type: "allowing",
        title: "Allow nonintrusive advertising without third-party tracking 2",
        url: alternativeAAUrl2,
        homepage: "https://acceptableads.com/"
      },
      subCircumvention
    ]);

    await EWE.subscriptions.addDefaults("en");
    let activeSubs = await EWE.subscriptions.getDownloadable();
    expect(activeSubs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: alternativeAAUrl1
      }),
      expect.objectContaining({
        url: alternativeAAUrl2
      })
    ]));
  });

  it("informs when the filter engine runs for the first time [fuzz]", async function() {
    let expectedFoundStorage = false;
    if (isFuzzingServiceWorker()) {
      expectedFoundStorage = expect.any(Boolean);
    }

    await EWE.testing._clearStorage();

    let result = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "pushArg", arg: {
        bundledSubscriptions: [subEasylist, subCircumvention,
                               subAcceptableAds],
        bundledSubscriptionsPath: "subscriptions"}},
      {op: "callMethod", arg: "start"},
      {op: "await"}
    ]);

    expect(result).toEqual({foundStorage: expectedFoundStorage,
                            foundSubscriptions: false,
                            warnings: []});

    await EWE.subscriptions.addDefaults("en");

    result = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "pushArg", arg: {
        bundledSubscriptions: [subEasylist, subCircumvention,
                               subAcceptableAds],
        bundledSubscriptionsPath: "subscriptions"}},
      {op: "callMethod", arg: "start"},
      {op: "await"}
    ]);
    expect(result).toEqual({foundStorage: expectedFoundStorage,
                            foundSubscriptions: true,
                            warnings: []});
  });

  it("ignores messages without a type property", async function() {
    let timeout = async() => {
      await new Promise(r => setTimeout(r, 1000));
    };
    // Old browsers hang on this unhandled message forever.
    // New browsers resolve the promise.
    // Either way, we just want to make sure we aren't throwing an error when
    // we see these messages.
    let unhandledMessageResult = Promise.race([
      browser.runtime.sendMessage({a: "1"}),
      timeout()
    ]);

    await expect(unhandledMessageResult).resolves.not.toThrow();
  });

  it("starts with the addon info provided by the initial start call [mv2-only]", async function() {
    // MV2 only because from MV3 must have more addon info than in this test,
    // including subscription info

    await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "pushArg", arg: {name: ADDON_NAME, version: ADDON_VERSION}},
      {op: "callMethod", arg: "start"},
      {op: "await"}
    ]);

    let addonInfo = await runInBackgroundPage([
      {op: "getGlobal", arg: "EWE"},
      {op: "getProp", arg: "debugging"},
      {op: "getProp", arg: "addonInfo"}
    ]);

    expect(addonInfo).toEqual(
      expect.objectContaining({name: ADDON_NAME, version: ADDON_VERSION})
    );

    await EWE.testing._resetDefaultAddonInfo();
  });

  describe("Validation [mv3-only]", function() {
    it("validates the provided subscriptions", async function() {
      await expect(EWE.testing._setAddonInfo(null))
        .rejects.toThrow("Error: No addonInfo provided to EWE.start");
      await expect(EWE.testing._setAddonInfo({}))
        .rejects.toThrow("Error: No `bundledSubscriptions` provided");
      await expect(EWE.testing._setAddonInfo({bundledSubscriptions: []}))
        .rejects.toThrow("Error: No `bundledSubscriptionsPath` provided");
    });

    it("validates the provided subscription files [fuzz]", async function() {
      let subscription = {
        id: "00000000-0000-0000-0000-000000000001",
        url: "https://domain.com/subscription.txt",
        mv2_url: "https://domain.com/subscription.txt"
      };
      let warnings = await EWE.debugging.validateSubscriptions([subscription], "subscriptions");
      expect(warnings).toEqual(expect.arrayContaining(
        [`No subscription content file for ID=${subscription.id}`]));
    });

    it("validates the provided subscriptions with the manifest rulesets", async function() {
      // This subscription file exists, but we don't have a ruleset for it.
      let subscription = {
        id: "00000000-0000-0000-0000-000000000002",
        url: "https://domain.com/subscription.txt",
        mv2_url: "https://domain.com/subscription.txt"
      };
      let warnings = await EWE.debugging.validateSubscriptions([subscription], "subscriptions");
      expect(warnings).toEqual(expect.arrayContaining(
        [`No ruleset with ID=${subscription.id} declared in the manifest`]));
    });

    it("validates adding a subscription without being provided to EWE.start", async function() {
      let url = TEST_MV3_SUBSCRIPTION.url + "_missing";
      await expect(EWE.subscriptions.add(url))
        .rejects.toThrow(`Failed to find the subscription with URL=${url}`);
    });

    describe("validates adding default subscriptions [mv3-only] [fuzz-skip]", function() {
      it("throws if no default language subscription is provided", async function() {
        await EWE.testing._setSubscriptions([]);
        await expect(EWE.subscriptions.addDefaults("en"))
          .rejects.toThrow("No default language subscription");
      });

      it("throws if no current language subscription is provided", async function() {
        await EWE.testing._setSubscriptions([subEasylist]); // "en"
        await expect(EWE.subscriptions.addDefaults("de"))
          .rejects.toThrow("No current language subscription");
      });

      it("throws if no anti-circumvention subscription is provided", async function() {
        await EWE.testing._setSubscriptions([subEasylist, subAcceptableAds]);
        await expect(EWE.subscriptions.addDefaults("en"))
          .rejects.toThrow("No anti-circumvention subscription");
      });

      it("throws if no allowing subscription is provided", async function() {
        await EWE.testing._setSubscriptions([subEasylist, subCircumvention]);
        await expect(EWE.subscriptions.addDefaults("en"))
          .rejects.toThrow("No allowing subscription");
      });

      it("does not throw if everything needed is provided", async function() {
        await EWE.testing._setSubscriptions([
          subEasylist, subCircumvention, subAcceptableAds]);
        await EWE.subscriptions.addDefaults("en");
      });
    });
  });
});
