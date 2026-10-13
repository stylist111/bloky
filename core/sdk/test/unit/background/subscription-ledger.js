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

// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";

describe("Subscription ledger", function() {
  const OLD_URL = "https://example.com/subscription.txt";
  const NEW_URL = "https://example.com/redirected.txt";

  let ledger;
  let classes;

  function entry(state, reason) {
    return {state, reason, ts: expect.any(Number)};
  }

  function regularSubscription(url, disabled = false) {
    return Object.assign(new classes.RegularSubscription(), {url, disabled});
  }

  beforeEach(async function() {
    env.configure();
    ledger = await mock("subscription-ledger.js");
    // eslint-disable-next-line no-undef
    classes = global.subscriptionClasses;
    env.setFilterStorageSubscriptions([]);
  });

  describe("record()", function() {
    it("records the state and reason of a subscription", async function() {
      await ledger.record(regularSubscription(OLD_URL), ledger.STATES.DISABLED,
                          ledger.REASONS.USER_ACTION);

      expect(await ledger.getEntries()).toEqual({
        [OLD_URL]: entry("disabled", "user_action")
      });
    });

    it("records an unknown reason for a missing or invalid reason", async function() {
      await ledger.record(regularSubscription(OLD_URL), ledger.STATES.REMOVED);
      await ledger.record(regularSubscription(NEW_URL), ledger.STATES.ENABLED,
                          "not_a_reason");

      expect(await ledger.getEntries()).toEqual({
        [OLD_URL]: entry("removed", "unknown"),
        [NEW_URL]: entry("enabled", "unknown")
      });
    });

    it("doesn't record special subscriptions", async function() {
      let subscription = Object.assign(new classes.SpecialSubscription(),
                                       {url: "~user~123456", disabled: false});

      await ledger.record(subscription, ledger.STATES.ENABLED,
                          ledger.REASONS.USER_ACTION);

      expect(await ledger.getEntries()).toEqual({});
    });
  });

  describe("recordRedirect()", function() {
    it("records the old subscription as removed and the new one with its state", async function() {
      await ledger.recordRedirect(regularSubscription(OLD_URL),
                                  regularSubscription(NEW_URL, true));

      expect(await ledger.getEntries()).toEqual({
        [OLD_URL]: entry("removed", "redirect"),
        [NEW_URL]: entry("disabled", "redirect")
      });
    });

    it("doesn't record a redirect to a data: URL", async function() {
      let dataUrl = "data:text/plain," +
        encodeURIComponent("[Adblock]\n||example.com^");

      await ledger.recordRedirect(regularSubscription(OLD_URL),
                                  regularSubscription(dataUrl));

      expect(await ledger.getEntries()).toEqual({
        [OLD_URL]: entry("removed", "redirect")
      });
    });
  });
});
