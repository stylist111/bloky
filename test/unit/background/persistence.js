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
import expect from "expect";
import sinon from "sinon/pkg/sinon.js";

import {PersistentState} from "../../../sdk/background/persistence.js";

describe("PersistentState", function() {
  const sandbox = sinon.createSandbox();
  let storage;

  beforeEach(async function() {
    env.configure();
    storage = env.browser.storage.session;
    for (const method of ["get", "set"]) {
      sandbox.spy(storage, method);
    }

    env.browser.runtime = {
      id: 1,
      getManifest() {
        return {
          name: "manifest v3",
          version: 3.0
        };
      }
    };
  });

  afterEach(function() {
    env.browser.runtime = void 0;
    sandbox.restore();
  });

  it("performs saving every time without debouncing ", async function() {
    const state = new PersistentState("key", storage);

    expect(storage.set.callCount).toEqual(0);
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      await state.save();
    }
    expect(storage.set.callCount).toEqual(attempts);
  });

  it("performs saving only once during the event loop iteration with debouncing", async function() {
    const state = new PersistentState("key", storage);
    state.doDebounce();

    expect(storage.set.callCount).toEqual(0);
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      await state.save();
    }

    await new Promise(r => setTimeout(r, 0));
    expect(storage.set.callCount).toEqual(1);
  });
});
