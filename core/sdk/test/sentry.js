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

import {EWE} from "./messaging.js";
import {wait} from "./polling.js";

async function createNewErrorEvent() {
  const oldEvent = await EWE.testing.getLastSentryEvent();
  void browser.runtime.sendMessage({type: "ewe-test:sentry-error"});

  let newEvent;

  await wait(async() => {
    newEvent = await EWE.testing.getLastSentryEvent();
    return newEvent !== oldEvent;
  }, 6000, "Sentry error not received");

  expect(newEvent.exception.values[0].value).toEqual(
    "This is an expected error for Sentry"
  );

  return await EWE.testing.getLastSentryEvent();
}

describe("Sentry", function() {
  before(async function() {
    await EWE.testing.setSentrySampleRate(1);
  });

  after(async function() {
    await EWE.testing.setSentrySampleRate(null);
  });

  it("emits a Sentry event event when an error occurs with the given metadata", async function() {
    const environment = "space";
    const hostVersion = "5.4";
    const isPremiumUser = true;
    await EWE.sentry.start("", environment, hostVersion, isPremiumUser);

    const event = await createNewErrorEvent();
    expect(event.environment).toEqual(environment);
    expect(event.release).toEqual(hostVersion);
    expect(event.tags.is_premium).toEqual(isPremiumUser);
  });

  it("generates and maintains a single user id through multiple errors", async function() {
    await EWE.sentry.start("", "", "1.0", false);

    const firstEvent = await createNewErrorEvent();
    const secondEvent = await createNewErrorEvent();
    expect(firstEvent.user.id).toStrictEqual(secondEvent.user.id);
  });
});
