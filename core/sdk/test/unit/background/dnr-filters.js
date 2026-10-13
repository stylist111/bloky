import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";
import sinon from "sinon/pkg/sinon.js";
import {MILLIS_IN_SECOND} from "#adblockpluscore/lib/time.js";

const PING_INTERVAL_MILLIS = 20 * MILLIS_IN_SECOND;
const PING_STORAGE_KEY = "__ewe_keepalive_ping";

describe("DNR subscription updates", function() {
  let clock;
  let dnrFilters;
  let pingSpy;
  let settleDynamicRules;

  function pingCount() {
    return pingSpy.getCalls()
      .filter(call => call.args[0] === PING_STORAGE_KEY).length;
  }

  function createSubscription() {
    return {
      url: "https://example.com/subscription.txt",
      id: "00000000-0000-0000-0000-000000000000",
      type: "ads",
      downloadable: true,
      disabled: false,
      updateFilterText() {
        return {};
      }
    };
  }

  beforeEach(async function() {
    env.configure();
    env.setFilterStorageSubscriptions([]);
    env.setPrefs({});
    global.fileContent = "[Adblock Plus]";
    env.browser.runtime.id = "test-extension";
    global.chrome = {runtime: {id: "test-extension"}};
    env.navigator.userAgent = "Chrome/130.0.0.0";
    env.navigator.locks = {
      request: async(name, callback) => callback()
    };
    env.browser.runtime.manifest.manifest_version = 3;
    Object.assign(env.browser.declarativeNetRequest, {
      MAX_NUMBER_OF_DYNAMIC_RULES: 30000,
      MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5000,
      getDynamicRules() {
        return new Promise((resolve, reject) => {
          settleDynamicRules = {resolve, reject};
        });
      },
      async getSessionRules() {
        return [];
      },
      async updateDynamicRules() {}
    });

    dnrFilters = await mock("dnr-filters.js", ["#adblockpluscore"]);
    pingSpy = sinon.spy(env.browser.storage.local, "get");
    clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    clock.restore();
    delete global.chrome;
    delete global.fileContent;
  });

  function testUpdate(name, runUpdate, errorStatus) {
    describe(name, function() {
      it("keeps the service worker alive while the update is in progress",
        async function() {
          let update = runUpdate(createSubscription());

          await clock.tickAsync(PING_INTERVAL_MILLIS * 2);
          expect(pingCount()).toBe(3);

          settleDynamicRules.resolve([]);
          await update;
        });

      it("stops keeping the service worker alive once the update finishes",
        async function() {
          let subscription = createSubscription();
          let update = runUpdate(subscription);
          await clock.tickAsync(PING_INTERVAL_MILLIS);

          settleDynamicRules.resolve([]);
          await update;
          expect(subscription.downloadStatus).toBeUndefined();
          let countAfterUpdate = pingCount();

          await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
          expect(pingCount()).toBe(countAfterUpdate);
        });

      it("stops keeping the service worker alive once the update fails",
        async function() {
          let subscription = createSubscription();
          let update = runUpdate(subscription);
          await clock.tickAsync(PING_INTERVAL_MILLIS);

          settleDynamicRules.reject(new Error("DNR failure"));
          await update;
          expect(subscription.downloadStatus).toBe(errorStatus);
          let countAfterUpdate = pingCount();

          await clock.tickAsync(PING_INTERVAL_MILLIS * 5);
          expect(pingCount()).toBe(countAfterUpdate);
        });
    });
  }

  testUpdate(
    "diff update",
    subscription => dnrFilters.dnrDiffSubscriptionUpdate(
      subscription,
      {added: [], removed: []}
    ),
    "synchronize_diff_error"
  );
  testUpdate(
    "full update",
    subscription => dnrFilters.dnrFullSubscriptionUpdate(
      subscription,
      ["[Adblock Plus]"]
    ),
    "synchronize_dnr_error"
  );
});
