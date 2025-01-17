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

import {TEST_PAGES_URL, TEST_ADMIN_PAGES_URL} from "./test-server-urls.js";
import {setMinTimeout, waitForAssertion, setEndpointResponse,
        clearEndpointResponse, getMaxDynamicRulesAvailable} from "./utils.js";
import {subTestCustom2, subTestUpdatable1} from "./api-fixtures.js";
import {wait} from "./polling.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {runInBackgroundPage, waitForServiceWorkerInitialization, EWE,
        setFeatureFlags} from "./messaging.js";

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
    afterEach(async function() {
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

    describe("Mock dynamic rules available", function() {
      afterEach(async function() {
        await EWE.testing.testSetDynamicRulesAvailable(0);
      });

      it("can set the dynamic rules available to 100", async function() {
        expect(
          (await browser.declarativeNetRequest.getSessionRules()).length
        ).toEqual(0);
        expect(
          (await browser.declarativeNetRequest.getSessionRules()).length
        ).toEqual(0);

        const maxRulesAvailables = getMaxDynamicRulesAvailable();
        expect(await EWE.testing.dynamicRulesAvailable()).toEqual(
          maxRulesAvailables);

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

  describe("Feature flags", function() {
    const FEATURE = "example";
    const INVALID_FEATURE = "thisFeatureDoesNotExist";

    it("uses the overridden value if it is overridden in a test", async function() {
      await setFeatureFlags({[FEATURE]: true});
      expect(await EWE.testing._isFeatureEnabled(FEATURE))
        .toBe(true);
    });

    it("uses the default value if nothing is set", async function() {
      // By being after the previous test, this is also checking that the
      // experiment values are reset between tests.
      expect(await EWE.testing._isFeatureEnabled(FEATURE))
        .toBe(false);
    });

    it("retains the overridden value when the service worker is stopped [mv3-only]", async function() {
      await setFeatureFlags({[FEATURE]: true});
      expect(await EWE.testing._isFeatureEnabled(FEATURE))
        .toBe(true);

      await suspendServiceWorker(this);

      expect(await EWE.testing._isFeatureEnabled(FEATURE))
        .toBe(true);
    });

    it("throws an error if you try to set an experiment which is not defined in a test", async function() {
      await expect(setFeatureFlags({[INVALID_FEATURE]: true}))
        .rejects
        .toThrow(`Error: Unknown feature flags: ${INVALID_FEATURE}`);
    });

    it("throws an error if you try to get an experiment which is not defined", async function() {
      await expect(EWE.testing._isFeatureEnabled(INVALID_FEATURE))
        .rejects
        .toThrow(`Error: Unknown feature flag: ${INVALID_FEATURE}`);
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

    it("responds to HEAD requests when you set the GET endpoint", async function() {
      let stringResponse = "This is a string response";
      await setEndpointResponse("/string", stringResponse);
      let response = await fetch(`${TEST_ADMIN_PAGES_URL}/string`, {
        method: "HEAD"
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toEqual("");
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
      try {
        let updatedReply = "[New content of subscription]";
        await setEndpointResponse(subTestUpdatable1.url, updatedReply, "GET");
        let response = await fetch(subTestUpdatable1.url);
        expect(await response.text()).toEqual(updatedReply);
      }
      finally {
        await clearEndpointResponse(subTestUpdatable1.url);
      }
    });

    it("supports overwriting status code", async function() {
      const url = `${TEST_ADMIN_PAGES_URL}/dynamic-endpoint`;

      try {
        await setEndpointResponse(url, "", "GET", 500);
        let response = await fetch(url);
        expect(response.status).toBe(500);
      }
      finally {
        await clearEndpointResponse(url);
      }
    });

    it("supports overwriting headers", async function() {
      const url = `${TEST_ADMIN_PAGES_URL}/dynamic-endpoint`;
      const expectedDateHeader = "2024-01-01";

      try {
        await setEndpointResponse(url, "", "GET", 200, {date: expectedDateHeader});
        let response = await fetch(url);
        expect(response.headers.get("date")).toBe(expectedDateHeader);
      }
      finally {
        await clearEndpointResponse(url);
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
      await EWE.subscriptions.add(subTestCustom2.url);

      // Get subscriptions
      let subs = await browser.runtime.sendMessage(
        {type: "subscriptions.get", ignoreDisabled: true, downloadable: true}
      );
      expect(subs.length).toEqual(1);

      // Remove subscription
      await browser.runtime.sendMessage({type: "subscriptions.remove",
                                         url: subTestCustom2.url});
      subs = await browser.runtime.sendMessage(
        {type: "subscriptions.get", ignoreDisabled: true, downloadable: true}
      );
      expect(subs).toEqual([]);
    });

    it("Responses with last error", async function() {
      // Get error by invoking calling test endpoint
      await browser.runtime.sendMessage({type: "ewe-test:error"});

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
