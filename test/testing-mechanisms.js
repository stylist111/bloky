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

import {isMV3, setMinTimeout, waitForAssertion,
        setEndpointResponse, clearEndpointResponse, TEST_ADMIN_PAGES_URL} from "./utils.js";
import {suspendServiceWorker} from "./mocha/mocha-runner.js";
import {runInBackgroundPage} from "./messaging.js";

describe("Testing Mechanisms", function() {
  if (isMV3()) {
    describe("MV3 Service Workers", function() {
      // https://gitlab.com/eyeo/adblockplus/abc/webext-sdk/-/issues/307
      after(async function() {
        setMinTimeout(this, 12000);
        // From our observations, after a service worker is suspended it starts
        // up again when a message is sent to it. However, that restart seems to
        // cause lag spikes a few seconds after the service worker restarts.
        // Sleeping is a workaround to ensure the API is fully responsive on
        // subsequent tests.
        await new Promise(r => setTimeout(r, 10000));
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
    });
  }

  describe("Console logging", function() {
    const sandbox = sinon.createSandbox();

    beforeEach(function() {
      sandbox.spy(console, "log");
    });

    afterEach(function() {
      sandbox.restore();
    });

    for (let method of ["log", "debug", "info", "warn", "error"]) {
      it(`logs in the test when it logs in the background with level ${method}`, async function() {
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
  });

  describe("Endpoint manipulation", function() {
    it("sets and responds using custom endpoints", async function() {
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
  });
});
