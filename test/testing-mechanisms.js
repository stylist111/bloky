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
import sinon from "sinon/pkg/sinon.js";

import {setMinTimeout, waitForAssertion, setEndpointResponse,
        clearEndpointResponse, TEST_ADMIN_PAGES_URL, TEST_PAGES_URL,
        firefoxVersion, isFirefox} from "./utils.js";
import {wait} from "./polling.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {runInBackgroundPage, waitForServiceWorkerInitialization, EWE}
  from "./messaging.js";

const VALID_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
const SECOND_VALID_FILTER_TEXT = "another-filter";
const VALID_FILTER = {
  text: VALID_FILTER_TEXT,
  enabled: true,
  slow: false,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};
const SECOND_VALID_FILTER = {
  text: SECOND_VALID_FILTER_TEXT,
  enabled: true,
  slow: true,
  type: "blocking",
  thirdParty: null,
  selector: null,
  csp: null
};

describe("Testing Mechanisms", function() {
  describe("MV3 Service Workers [mv3-only]", function() {
    after(async function() {
      setMinTimeout(this, 12000);
      // From our observations, after a service worker is suspended it starts
      // up again when a message is sent to it. However, that restart seems to
      // cause lag spikes a few seconds after the service worker restarts.
      // Waiting for everything else to initialize is a workaround to ensure
      // the API is fully responsive on subsequent tests.
      await waitForServiceWorkerInitialization();
    });

    it("state is cleared when service worker is suspended", async function() {
      let testData = "This is some test data";
      await browser.runtime.sendMessage({type: "ewe-test:setInMemoryState", data: testData});
      expect(await browser.runtime.sendMessage({type: "ewe-test:getInMemoryState"}))
        .toEqual(testData);

      await suspendServiceWorker(this);

      expect(await browser.runtime.sendMessage({type: "ewe-test:getInMemoryState"}))
        .toEqual(null);
    });

    describe("mock dynamic rules available", function() {
      after(async function() {
        await EWE.testing.testSetDynamicRulesAvailable(0);
      });

      it("can set the dynamic rules available to 100", async function() {
        expect(
          (await browser.declarativeNetRequest.getSessionRules()).length
        ).toEqual(0);
        expect(
          (await browser.declarativeNetRequest.getSessionRules()).length
        ).toEqual(0);

        const MAX_NUMBER = await browser.declarativeNetRequest
              .MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES;
        expect(await EWE.testing.dynamicRulesAvailable()).toEqual(MAX_NUMBER);

        await EWE.testing.testSetDynamicRulesAvailable(100);

        expect(await EWE.testing.dynamicRulesAvailable()).toEqual(100);
      });
    });
  });

  describe("Console logging", function() {
    const sandbox = sinon.createSandbox();

    beforeEach(function() {
      sandbox.spy(console, "log");
    });

    afterEach(function() {
      sandbox.restore();
    });

    for (let method of ["log", "debug", "info", "warn", "error"]) {
      let tags = method == "log" ? "[fuzz]" : "";
      it(`logs in the test when it logs in the background with level ${method} ${tags}`, async function() {
        let message = "Hello world";
        let messageObject = {foo: "bar"};

        await runInBackgroundPage([
          {op: "getGlobal", arg: "console"},
          {op: "pushArg", arg: message},
          {op: "pushArg", arg: messageObject},
          {op: "callMethod", arg: method}
        ]);

        await waitForAssertion(() => {
          // eslint-disable-next-line no-console
          expect(console.log.getCalls()).toEqual(expect.arrayContaining([
            expect.objectContaining({
              args: [`Background (${method}):`, message, messageObject]
            })
          ]));
        });
      });
    }

    it("outputs the tracing log", async function() {
      const message = "trace message";

      await EWE.testing._clearDebugLog();
      await EWE.testing._trace({message});
      await EWE.testing._printDebugLog();

      await wait(async() => {
        // eslint-disable-next-line no-console
        let tracingOutput = console.log.getCalls();
        for (let output of tracingOutput) {
          if (output.args.length == 2 &&
              output.args[0] == "Background (debug):" &&
              output.args[1].includes(message)) {
            return true;
          }
        }
      }, 1000, "No console debug output");
    });
  });

  describe("Endpoint manipulation", function() {
    it("sets and responds using custom endpoints [fuzz]", async function() {
      let response = {"some random content": "yes!"};

      await setEndpointResponse("/test-a-random-endpoint", response);

      let output = await fetch(`${TEST_ADMIN_PAGES_URL}/test-a-random-endpoint`);
      expect(await output.json()).toEqual(response);
    });

    it("sets and responds with various types of data", async function() {
      let stringResponse = "This is a string response";
      let objectResponse = {hey: ["hello", "world"]};

      await setEndpointResponse("/string", stringResponse);
      await setEndpointResponse("/object", objectResponse);

      let stringOutput = await fetch(`${TEST_ADMIN_PAGES_URL}/string`);
      let objectOutput = await fetch(`${TEST_ADMIN_PAGES_URL}/object`);

      expect(await stringOutput.text()).toEqual(stringResponse);
      expect(await objectOutput.json()).toEqual(objectResponse);
    });

    it("clears dynamically set endpoints", async function() {
      let customResponse = {hey: ["what's", "up", "?"]};
      await setEndpointResponse("/test", customResponse);

      let testOutput = await fetch(`${TEST_ADMIN_PAGES_URL}/test`);
      expect(await testOutput.json()).toEqual(customResponse);

      await clearEndpointResponse("/test");

      testOutput = await fetch(`${TEST_ADMIN_PAGES_URL}/test`);
      expect((async() => {
        await testOutput.json();
      })).rejects.toThrow();
    });

    it("clears dynamically set endpoints with build time responses", async function() {
      let url = "/example-dynamic-endpoint";
      let defaultResponse = "build time response";
      let customResponse = "dynamic response!";

      let testOutput = await fetch(`${TEST_ADMIN_PAGES_URL}${url}`);
      expect(await testOutput.text()).toEqual(defaultResponse);

      await setEndpointResponse(url, customResponse);

      testOutput = await fetch(`${TEST_ADMIN_PAGES_URL}${url}`);
      expect(await testOutput.text()).toEqual(customResponse);

      await clearEndpointResponse(url);

      testOutput = await fetch(`${TEST_ADMIN_PAGES_URL}${url}`);
      expect(await testOutput.text()).toEqual(defaultResponse);
    });

    it("supports overwriting subscription routes", async function() {
      const UPDATABLE_SUBSCRIPTION_URL =
        "http://localhost:3003/updatable_subscription.txt";

      try {
        let updatedReply = "[New content of subscription]";
        await setEndpointResponse(UPDATABLE_SUBSCRIPTION_URL, updatedReply, "GET");
        let response = await fetch(UPDATABLE_SUBSCRIPTION_URL);
        expect(await response.text()).toEqual(updatedReply);
      }
      finally {
        clearEndpointResponse(UPDATABLE_SUBSCRIPTION_URL);
      }
    });
  });

  describe("Communication endpoints for testpages [fuzz-skip]", function() {
    it("Adds, gets and Removes filter", async function() {
      // Add filter
      await browser.runtime.sendMessage({type: "filters.importRaw", text: `${VALID_FILTER_TEXT} \n ${SECOND_VALID_FILTER_TEXT}`});

      // Get filter
      // In MV3 we need sometimes to wait for filter to be added
      let userFilters;
      await wait(async() => {
        userFilters = await browser.runtime.sendMessage({type: "filters.get"});
        return userFilters.length > 0 ? userFilters : false;
      }, 1000, "Filters weren't added properly");
      expect(userFilters).toBeArrayContainingExactly(
        [VALID_FILTER, SECOND_VALID_FILTER]
      );

      // Remove filter
      await Promise.all(userFilters.map(filter => browser.runtime.sendMessage(
        {type: "filters.remove", text: filter.text}
      )));
      userFilters = await browser.runtime.sendMessage({type: "filters.get"});
      expect(userFilters).toEqual([]);
    });

    it("Gets and Removes Subscriptions", async function() {
      await EWE.subscriptions.add(`${TEST_PAGES_URL}/subscription.txt?2`);

      // Get subscriptions
      let subs = await browser.runtime.sendMessage(
        {type: "subscriptions.get", ignoreDisabled: true, downloadable: true}
      );
      expect(subs.length).toEqual(1);

      // Remove subscription
      await browser.runtime.sendMessage({type: "subscriptions.remove",
                                         url: `${TEST_PAGES_URL}/subscription.txt?2`});
      subs = await browser.runtime.sendMessage(
        {type: "subscriptions.get", ignoreDisabled: true, downloadable: true}
      );
      expect(subs).toEqual([]);
    });

    it("Responses with last error", async function() {
      // For firefox 68 this test will fail
      // To be unskipped once fix will land in get-browser-binary
      // More details: https://gitlab.com/eyeo/developer-experience/get-browser-binary/-/issues/49
      if (isFirefox() && firefoxVersion() == 68) {
        this.skip();
      }

      // Get error by invoking calling same endpoint twice with same argument
      await browser.runtime.sendMessage({type: "filters.importRaw", text: `${VALID_FILTER_TEXT} `});
      // In MV3 we need to wait for filter to be added
      // before calling add one more time to trigger error
      await wait(async() => {
        let userFilters = await browser.runtime.sendMessage({type: "filters.get"});
        if (typeof userFilters == "object" && userFilters.length > 0) {
          return userFilters;
        }
        return false;
      }, 1000, "First filter wasn't added properly");

      await browser.runtime.sendMessage({type: "filters.importRaw", text: `${VALID_FILTER_TEXT} `});

      let errors;
      await wait(async() => {
        errors = await browser.runtime.sendMessage({type: "debug.getLastError"});
        if (typeof errors != "object" && errors.length > 0) {
          return errors;
        }
        return false;
      }, 1500, "Errors weren't received");

      expect(errors).not.toBeNull();
    });
  });
});
