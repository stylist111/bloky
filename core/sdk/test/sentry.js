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

async function createNewErrorEvent(errorType, context) {
  const oldEvent = await EWE.testing.getLastSentryEvent();
  if (context === "background") {
    void browser.runtime.sendMessage({
      type: "ewe-test:sentry-error",
      errorType
    });
  }
  else if (context === "ui") {
    function handleConnect(port) {
      if (port.name !== "sentry-test") {
        return;
      }

      browser.runtime.onConnect.removeListener(handleConnect);
      port.postMessage(errorType);
    }

    browser.runtime.onConnect.addListener(handleConnect);
    void browser.tabs.create({url: "sentry-test.html"});
  }
  else {
    throw new Error(`Invalid context when calling createNewErrorEvent(): ${context}`);
  }

  let newEvent;

  await wait(async() => {
    newEvent = await EWE.testing.getLastSentryEvent();
    return (newEvent && newEvent.event_id) !== (oldEvent && oldEvent.event_id);
  }, 6000, "Sentry error not received");

  expect(newEvent.exception.values[0].value).toEqual(
    `This is an expected error for Sentry (${errorType})`
  );

  return newEvent;
}

describe("Sentry", function() {
  before(async function() {
    await EWE.testing.setSentrySampleRate(1);
  });

  after(async function() {
    await EWE.testing.setSentrySampleRate(null);
  });

  it("emits a Sentry event when an error occurs with the given metadata", async function() {
    const environment = "space";
    const hostVersion = "5.4";

    await EWE.sentry.start("test-url", environment, hostVersion);

    const event = await createNewErrorEvent("error", "background");
    expect(event.environment).toEqual(environment);
    expect(event.release).toEqual(hostVersion);
  });

  it("emits a Sentry event when a rejection occurs", async function() {
    await EWE.sentry.start("test-url", "test-env", "1.0");

    await createNewErrorEvent("rejection", "background");
  });

  it("emits a Sentry event when an errors occurs in a UI page", async function() {
    await EWE.sentry.start("test-url", "test-env", "1.0");

    await createNewErrorEvent("error", "ui");
  });

  it("emits a Sentry event when a rejection occurs in a UI page", async function() {
    await EWE.sentry.start("test-url", "test-env", "1.0");

    await createNewErrorEvent("rejection", "ui");
  });

  it("generates and maintains a single user id through multiple errors", async function() {
    await EWE.sentry.start("test-url", "test-env", "1.0");

    const firstEvent = await createNewErrorEvent("error", "background");
    const secondEvent = await createNewErrorEvent("error", "background");
    expect(firstEvent.user.id).toStrictEqual(secondEvent.user.id);
  });
});
