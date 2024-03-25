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

import expect from "expect";
import browser from "webextension-polyfill";

import {TEST_PAGES_URL, TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {Page, isFirefox, firefoxVersion, isIncognito, readFile, writeFile,
        setMinTimeout, expectElemHideHidden} from "./utils.js";
import {subTestCustom1, subTestNoDNR} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {EWE, runInBackgroundPage} from "./messaging.js";
import {updateExtensionFiles} from "./mocha/mocha-runner.js";
import {MILLIS_IN_DAY, MILLIS_IN_SECOND} from "adblockpluscore/lib/time.js";

let start = new URLSearchParams(document.location.search).get("start");
let phase = start ? "preparation" : "check";

const filter = "someFilterAddedInANewWebExtentionRelease";

describe(`Update (${phase}) [runner-only]`, function() {
  setMinTimeout(this, 5000);

  before(async function() {
    if (start) {
      await EWE.testing._removeAllSubscriptions();
      return;
    }

    setMinTimeout(this, 12000);
    // Wait for EWE to be started
    // (loading filter text and applying DNR rulesets might take a while)
    await wait(async() => {
      let actualState = await browser.runtime.sendMessage({
        type: "ewe-test:getState"
      });
      return actualState == "started";
    }, 10000, "EWE not started");
  });

  after(async function() {
    if (start) {
      await updateExtensionFiles([
        {
          method: "updateManifest",
          args: {
            version: "0.0.2"
          }
        }
      ]);

      await browser.storage.local.set({"update-test-running": true});
      await browser.storage.local.set({search: document.location.search});

      return runInBackgroundPage([
        {op: "getGlobal", arg: "chrome"},
        {op: "getProp", arg: "runtime"},
        {op: "callMethod", arg: "reload"}
      ]);
    }

    await browser.storage.local.remove("update-test-running");
    await browser.storage.local.remove("search");
  });

  it("updates subscription information when updating the extension [mv3-only]", async function() {
    setMinTimeout(this, 12000);

    const diffUrlUpdateSubscriptionId = "00000000-0000-0000-0000-000000000080";
    const replaceWithThisObject = {
      id: diffUrlUpdateSubscriptionId,
      languages: [
        "ja"
      ],
      type: "ads",
      title: "Updated Title",
      homepage: "Updated Homepage",
      privileged: false,
      url: `${TEST_ADMIN_PAGES_URL}/mv3_diffurl_update.txt`,
      mv2_url: `${TEST_ADMIN_PAGES_URL}/mv3_diffurl_update.txt`,
      diff_url: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/002.json`,
      expires: "10 hours (update frequency)"
    };
    const replaceWithThisTypeChangingObject = {...subTestNoDNR, type: "cookies"};

    const replaceWithThis = JSON.stringify(replaceWithThisObject, null, 2);
    const replaceWithThisForType = JSON.stringify(
      replaceWithThisTypeChangingObject, null, 2);

    if (start) {
      const hasJapaneseSubscription = (await EWE.testing._getDefaultSubscriptions("ja")).hasCurrentLang;
      expect(hasJapaneseSubscription).toBeFalsy();

      await EWE.subscriptions.add(`${TEST_ADMIN_PAGES_URL}/mv3_diffurl_update.txt`);
      await EWE.subscriptions.add(subTestNoDNR.url);
      await updateExtensionFiles([
        {
          method: "findAndReplaceInFile",
          args: {
            file: "custom-mv3-subscriptions.js",
            findRegex: RegExp(String.raw`{\s*"id":\s*"${diffUrlUpdateSubscriptionId}".*?}`).source,
            replace: replaceWithThis
          }
        },
        {
          method: "findAndReplaceInFile",
          args: {
            file: "custom-mv3-subscriptions.js",
            findRegex: RegExp(String.raw`{\s*"id":\s*"${subTestNoDNR.id}".*?}`).source,
            replace: replaceWithThisForType
          }
        }
      ]);
      return;
    }

    const subscriptions = await EWE.subscriptions.getSubscriptions();

    const updatedSubscription = subscriptions.filter(
      s => s.id === diffUrlUpdateSubscriptionId)[0];

    const updatedTypeSubscription = subscriptions.filter(
      s => s.id === subTestNoDNR.id)[0];

    expect(updatedSubscription).toEqual(expect.objectContaining({
      diffURL: `${TEST_ADMIN_PAGES_URL}/updatable_subscription/002.json`,
      title: "Updated Title",
      homepage: "Updated Homepage",
      privileged: false,
      downloadStatus: "synchronize_ok"
    }));
    expect(updatedTypeSubscription).toEqual(expect.objectContaining({
      privileged: false,
      downloadStatus: "synchronize_ok"
    }));

    const hasJapaneseSubscription = (await EWE.testing._getDefaultSubscriptions("ja")).hasCurrentLang;
    expect(hasJapaneseSubscription).toBeTruthy();

    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const ONE_DAY_IN_SECONDS = MILLIS_IN_DAY / MILLIS_IN_SECOND;
    const twoDaysInTheFutureInSeconds = currentTimeInSeconds +
       2 * ONE_DAY_IN_SECONDS;

    expect(updatedSubscription.expires).toBeLessThanOrEqual(
      twoDaysInTheFutureInSeconds);
  });

  it("updates the subscription filter text when updating the extension [mv3-only]", async function() {
    const subscriptionFile = `subscriptions/${subTestCustom1.id}`;

    if (start) {
      await EWE.subscriptions.add(subTestCustom1.url);

      await updateExtensionFiles([
        {
          method: "addLines",
          args: {
            file: subscriptionFile,
            lines: [filter]
          }
        }
      ]);
      return;
    }

    setMinTimeout(this, 20000);

    let filters = await EWE.subscriptions.getFilters(subTestCustom1.url);
    expect(filters).toContainEqual(expect.objectContaining({
      text: filter
    }));

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subTestCustom1.url,
        updatable: false, // no `diff_url` provided
        enabled: true
      })
    ]));

    await new Page("image-from-subscription.html")
      .expectResource("image-from-subscription.png")
      .toBeBlocked();
  });

  it("maintains custom user subscriptions in an update", async function() {
    let subscriptionUrl = `${TEST_PAGES_URL}/custom-subscription-for-migration.txt`;

    if (start) {
      await EWE.subscriptions.add(subscriptionUrl);
      return;
    }

    let filters = await EWE.subscriptions.getFilters(subscriptionUrl);
    expect(filters).toContainEqual(expect.objectContaining({
      text: "/image.png^$image"
    }));

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url: subscriptionUrl,
        updatable: true, // full updatable
        enabled: true
      })
    ]));

    await new Page("image.html")
      .expectResource("image.png")
      .toBeBlocked();
  });

  it("recovers custom user subscriptions which previously failed to migrate [mv3-only]", async function() {
    let url = `${TEST_PAGES_URL}/custom-subscription-for-migration-2.txt`;

    if (start) {
      await EWE.subscriptions.add(url);
      let allSubscriptions = await EWE.subscriptions.getSubscriptions();
      let subscription = allSubscriptions.find(sub => sub.url == url);
      expect(subscription).toBeDefined();
      await EWE.subscriptions.remove(url);

      // In the newest version of our SDK these subscriptions will be migrated
      // straight to custom user subscriptions. However, if the MV3 migration
      // happened on an earlier version of the SDK, this would have instead
      // created these migration errors.
      await EWE.testing._saveSubscriptionMigrationError(
        subscription, `Failed to find the subscription with URL=${url}`
      );
      return;
    }

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url,
        updatable: true, // full updatable
        enabled: true
      })
    ]));

    await expectElemHideHidden();

    let migrationErrors = await EWE.subscriptions.getMigrationErrors();
    expect(migrationErrors).not.toContainEqual(expect.objectContaining({
      subscription: expect.objectContaining({url})
    }));
  });

  it("recovers bundled subscriptions which previously failed to migrate [mv3-only]", async function() {
    let url = subTestNoDNR.url;

    if (start) {
      await EWE.subscriptions.add(url);
      await EWE.subscriptions.disable(url);
      let allSubscriptions = await EWE.subscriptions.getSubscriptions();
      let subscription = allSubscriptions.find(sub => sub.url == url);
      expect(subscription).toBeDefined();
      await EWE.subscriptions.remove(url);

      // In the newest version of our SDK these subscriptions will be migrated
      // straight to custom user subscriptions. However, if the MV3 migration
      // happened on an earlier version of the SDK and the subscription wasn't
      // in the bundled subscriptions yet, this would have instead created these
      // migration errors.
      await EWE.testing._saveSubscriptionMigrationError(
        subscription, `Failed to find the subscription with URL=${url}`
      );
      return;
    }

    let subs = await EWE.subscriptions.getSubscriptions();
    expect(subs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        url,
        updatable: false,
        enabled: false
      })
    ]));

    let migrationErrors = await EWE.subscriptions.getMigrationErrors();
    expect(migrationErrors).not.toContainEqual(expect.objectContaining({
      subscription: expect.objectContaining({url})
    }));
  });

  it("unrecoverable migration errors are not removed [mv3-only]", async function() {
    // subscriptions must use https, unless they are on localhost
    let invalidSubscriptionUrl = "http://example.com";

    if (start) {
      await EWE.testing._saveSubscriptionMigrationError(
        {url: invalidSubscriptionUrl},
        `Failed to find the subscription with URL=${invalidSubscriptionUrl}`
      );
      return;
    }

    let migrationErrors = await EWE.subscriptions.getMigrationErrors();
    expect(migrationErrors).toContainEqual(expect.objectContaining({
      subscription: expect.objectContaining({url: invalidSubscriptionUrl})
    }));
  });

  describe("subscription being bundled or unbundled", function() {
    const oldBundledSubscription = {
      id: "00000000-0000-0000-0000-000000000090",
      url: `${TEST_PAGES_URL}/currently-bundled-subscription.txt`
    };
    const newBundledSubscription = {
      id: "00000000-0000-0000-0000-000000000092",
      type: "ads",
      title: "Subscription that is not bundled right now but will be in an update",
      url: `${TEST_PAGES_URL}/later-bundled-subscription.txt`,
      mv2_url: `${TEST_PAGES_URL}/later-bundled-subscription.txt`
    };

    after(async function() {
      if (start) {
        await updateExtensionFiles([
          {
            method: "findAndReplaceInFile",
            args: {
              file: "background.js",
              findRegex: newBundledSubscription.id,
              replace: oldBundledSubscription.id
            }
          }
        ]);
      }
    });

    it("converts custom user subscriptions to bundled subscriptions if it is bundled after an update [mv3-only]", async function() {
      if (start) {
        await EWE.subscriptions.add(newBundledSubscription.url);

        let subs = await EWE.subscriptions.getSubscriptions();
        expect(subs).toContainEqual(expect.objectContaining({
          id: null,
          url: newBundledSubscription.url
        }));

        return;
      }

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).toContainEqual(expect.objectContaining({
        id: newBundledSubscription.id,
        url: newBundledSubscription.url,
        updatable: false // no diff URL, and isn't a custom sub anymore
      }));
    });

    it("removes bundled subscriptions which are no longer bundled after an update [mv3-only]", async function() {
      if (start) {
        await EWE.subscriptions.add(oldBundledSubscription.url);

        let subs = await EWE.subscriptions.getSubscriptions();
        expect(subs).toContainEqual(expect.objectContaining({
          id: oldBundledSubscription.id,
          url: oldBundledSubscription.url
        }));

        return;
      }

      let subs = await EWE.subscriptions.getSubscriptions();
      expect(subs).not.toContainEqual(expect.objectContaining({
        url: oldBundledSubscription.url
      }));
    });
  });

  it("maintains custom user filters across updates [mv3-only]", async function() {
    // This test is mv3-only because in mv2 it clashes with the MV2 storage
    // migration test below.

    let filterText = "some-filter-text-which-should-not-be-lost";
    if (start) {
      await EWE.filters.add(filterText);
      return;
    }

    let filters = await EWE.filters.getUserFilters();
    expect(filters).toContainEqual(expect.objectContaining({
      text: filterText
    }));
  });

  it("fixes the IO/Prefs prefixes [mv2-only]", async function() {
    // Firefox 115 supports IndexedDB, so we don't switch to b.s.l for IO
    if (!isFirefox() || !isIncognito() || firefoxVersion() >= 115) {
      this.skip();
    }

    const PRE_SDK_PREFIX = "file:";
    const SDK_0_5_PREFIX = "abp:file:";
    const CURRENT_PREFIX = "ewe:file:";

    let preSdkFile = "preSdkFile.txt";
    let sdk0Dot5File = "sdk0.5File.txt";
    let file = "file.txt";
    let data1 = "someContent1";
    let data2 = "someContent2";
    if (start) {
      await writeFile(PRE_SDK_PREFIX, preSdkFile, data1);
      await writeFile(SDK_0_5_PREFIX, sdk0Dot5File, data2);

      // if both prefixes for the same file exist at the same time
      await writeFile(PRE_SDK_PREFIX, file, data1);
      await writeFile(SDK_0_5_PREFIX, file, data2);
      return;
    }

    let actualData1 = await readFile(CURRENT_PREFIX, preSdkFile);
    expect(actualData1.content).toEqual(Array.from(data1));

    let actualData2 = await readFile(CURRENT_PREFIX, sdk0Dot5File);
    expect(actualData2.content).toEqual(Array.from(data2));

    // pre-SDK should win
    let actualData3 = await readFile(CURRENT_PREFIX, file);
    expect(actualData3.content).toEqual(Array.from(data1));
  });

  it("reads the feature flags passed into EWE.start", async function() {
    let feature = "example";
    if (start) {
      expect(await EWE.testing._isFeatureEnabled(feature))
        .toBe(false);

      await updateExtensionFiles([
        {
          method: "findAndReplaceInFile",
          args: {
            file: "background.js",
            findRegex: /startupInfo\.featureFlags\s*=\s*{[^}]*}/.source,
            replace: `startupInfo.featureFlags = { ${feature}: true }`
          }
        }
      ]);

      return;
    }

    expect(await EWE.testing._isFeatureEnabled(feature))
      .toBe(true);
  });
});
