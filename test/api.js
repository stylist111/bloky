/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

const VALID_SUBSCRIPTION_URL = "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt";
const INVALID_SUBSCRIPTION_URL = "invalidUrl";

const VALID_FILTER_TEXT = "$image";
const VALID_FILTER = {text: VALID_FILTER_TEXT, enabled: true, slow: true};
const INVALID_FILTER_TEXT = "/foo/$rewrite=";

describe("API", () =>
{
  describe("Subscriptions", () =>
  {
    it("adds a subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL,
        homepage: null
      })]);
    });

    it("adds a subscription with properties", () =>
    {
      let title = "testTitle";
      let homepage = "testHomePage";

      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL, {title, homepage});

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title,
        homepage
      })]);
    });

    it("does not add an invalid subscription", () =>
    {
      expect(() => ABP.subscriptions.add(INVALID_SUBSCRIPTION_URL))
        .toThrowError("Invalid subscription URL");
    });

    it("adds multiple subscriptions", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL + "?2");

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL}),
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL + "?2"})
      ]);
    });

    it("disables an existing subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      })]);
    });

    it("enables an existing subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("enables a subscription that is already enabled.", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.enable(VALID_SUBSCRIPTION_URL);

      let subscriptions = ABP.subscriptions.getAll();
      expect(subscriptions).toEqual([expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true
      })]);
    });

    it("fails enabling/disabling a nonexistent subscription", () =>
    {
      expect(
        () => ABP.subscriptions.enable("DoesNotExist")
      ).toThrowError("Subscription does not exist");

      expect(
        () => ABP.subscriptions.disable("DoesNotExist")
      ).toThrowError("Subscription does not exist");
    });

    it("removes a subscription", () =>
    {
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.remove(VALID_SUBSCRIPTION_URL);

      expect(ABP.subscriptions.getAll()).toEqual([]);
    });

    it("listens to onAdded events", () =>
    {
      let fake = sinon.fake();

      ABP.subscriptions.onAdded.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onAdded.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: true,
        title: VALID_SUBSCRIPTION_URL
      }));
    });

    it("listens to onChanged events", () =>
    {
      let fake = sinon.fake();

      ABP.subscriptions.onChanged.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.disable(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(expect.objectContaining({
        url: VALID_SUBSCRIPTION_URL,
        enabled: false
      }));
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      ABP.subscriptions.onRemoved.addListener(fake);
      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.remove(VALID_SUBSCRIPTION_URL);
      ABP.subscriptions.onRemoved.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(
        expect.objectContaining({url: VALID_SUBSCRIPTION_URL})
      );
    });

    it("syncs subscriptions", async function()
    {
      this.timeout(5000);

      let previousDownload = 0;
      let syncedOne = false;
      let syncedAll = false;

      ABP.subscriptions.add(VALID_SUBSCRIPTION_URL);

      await new Promise((resolve, reject) =>
      {
        async function onChanged(subscription)
        {
          try
          {
            if (subscription.url != VALID_SUBSCRIPTION_URL)
              return;

            expect(subscription.lastDownload).toBeGreaterThan(previousDownload);
            previousDownload = subscription.lastDownload;

            if (!syncedOne)
            {
              syncedOne = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              ABP.subscriptions.sync(VALID_SUBSCRIPTION_URL);
            }
            else if (!syncedAll)
            {
              syncedAll = true;
              await new Promise(elapsed => setTimeout(elapsed, 1000));
              ABP.subscriptions.sync();
            }
            else
            {
              ABP.subscriptions.onChanged.removeListener(onChanged);
              resolve();
            }
          }
          catch (err)
          {
            ABP.subscriptions.onChanged.removeListener(onChanged);
            reject(err);
          }
        }

        ABP.subscriptions.onChanged.addListener(onChanged);
      });
    });
  });

  describe("Filters", () =>
  {
    it("adds a filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("does not add an invalid filter", () =>
    {
      expect(() => ABP.filters.add(INVALID_FILTER_TEXT))
        .toThrowError("Invalid filter");
    });

    it("adds multiple filters", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.add("another-filter");

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([
        VALID_FILTER,
        {...VALID_FILTER, text: "another-filter"}
      ]);
    });

    it("disable an existing filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([{...VALID_FILTER, enabled: false}]);
    });

    it("enables an existing filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);
      ABP.filters.enable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("enables a filter that is already enabled.", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.enable(VALID_FILTER_TEXT);

      let filters = ABP.filters.getAll();
      expect(filters).toEqual([VALID_FILTER]);
    });

    it("removes a filter", () =>
    {
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.remove(VALID_FILTER_TEXT);

      expect(ABP.filters.getAll()).toEqual([]);
    });

    it("listens to onAdded events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onAdded.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.onAdded.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual(VALID_FILTER);
    });

    it("listens to onChanged events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onChanged.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.disable(VALID_FILTER_TEXT);
      ABP.filters.onChanged.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });

    it("listens to onRemoved events", () =>
    {
      let fake = sinon.fake();

      ABP.filters.onRemoved.addListener(fake);
      ABP.filters.add(VALID_FILTER_TEXT);
      ABP.filters.remove(VALID_FILTER_TEXT);
      ABP.filters.onRemoved.removeListener(fake);

      expect(fake.callCount).toBe(1);
      expect(fake.firstArg).toEqual({...VALID_FILTER, enabled: false});
    });
  });

  describe("Initialization", () =>
  {
    let background;

    before(async() =>
    {
      background = await browser.runtime.getBackgroundPage();
    });

    after(() =>
    {
      delete background.uiLanguageOverride;
    });

    for (let [language, subscriptionUrl] of [
      ["en", "https://easylist-downloads.adblockplus.org/easylist.txt"],
      ["de", "https://easylist-downloads.adblockplus.org/easylistgermany+easylist.txt"]
    ])
    {
      it(`configures default subscriptions for ${language}`, async() =>
      {
        background.uiLanguageOverride = language;

        await ABP.start();

        let subscriptions = ABP.subscriptions.getAll();
        let urls = [
          subscriptionUrl,
          "https://easylist-downloads.adblockplus.org/exceptionrules.txt",
          "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
        ];

        expect(subscriptions).toEqual(expect.arrayContaining(urls.map(
          url => expect.objectContaining({url, enabled: true})
        )));

        for (let subscription of subscriptions)
        {
          expect(urls).toContain(subscription.url);
          expect(subscription.downloading ||
                 subscription.lastDownload).toBeTruthy();
        }
      });
    }
  });
});
