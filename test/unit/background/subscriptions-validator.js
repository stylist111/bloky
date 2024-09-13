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

describe("Subscriptions validation", function() {
  let api;

  async function mockAndImport() {
    api = await mock("subscriptions-validator.js");
  }

  beforeEach(async function() {
    env.configure();
    await mockAndImport();
  });

  it("returns no warnings for empty subscriptions list", async function() {
    let warnings = await api.validate([], "");
    expect(warnings).toEqual([]);
  });

  describe("Rulesets", function() {
    it("returns a warning if ruleset is NOT found", async function() {
      let id = 1;
      env.browser.runtime.manifest.declarative_net_request
        .rule_resources = []; // no ruleset

      let warnings = await api.validate([{id}], "");
      expect(warnings).toEqual(expect.arrayContaining([
        `No ruleset with ID=${id} declared in the manifest`
      ]));
    });

    it("does NOT return a warning, if ruleset is found", async function() {
      let id = 1;
      env.browser.runtime.manifest.declarative_net_request.rule_resources = [{
        id
      }];

      let warnings = await api.validate([{}], "");
      expect(warnings).not.toEqual(expect.arrayContaining([
        `No ruleset with ID=${id} declared in the manifest`
      ]));
    });
  });

  describe("Content files", function() {
    const FILEPATH = "subscriptions";

    it("returns a warning if content file is NOT found", async function() {
      let id = 3;

      env.setFetchResponse(`${FILEPATH}/${id}`, {
        ok: false
      });

      let warnings = await api.validate([{id}], FILEPATH);
      expect(warnings).toEqual(expect.arrayContaining([
        `No subscription content file for ID=${id}`
      ]));
    });

    it("does NOT return a warning, if content file is found", async function() {
      let id = 4;

      env.setFetchResponse(`${FILEPATH}/${id}`, {
        ok: true
      });

      let warnings = await api.validate([{id}], FILEPATH);
      expect(warnings).not.toEqual(expect.arrayContaining([
        `No subscription content file for ID=${id}`
      ]));
    });
  });
});
