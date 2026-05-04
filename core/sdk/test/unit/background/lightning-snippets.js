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

const STORAGE_KEY = "ewe:lightning-snippets";

describe("lightning-snippets", function() {
  let api;

  async function loadModule() {
    api = await mock(
      "lightning-snippets.js",
      null,
      ["./account/index.js", "./experiments.js"]
    );
  }

  beforeEach(async function() {
    env.configure();
    global.__hasPremium = false;
    global.__lightningSnippetsFlag = null;
    await loadModule();
  });

  afterEach(function() {
    delete global.__hasPremium;
    delete global.__lightningSnippetsFlag;
  });

  async function readPersistedState() {
    const result = await env.browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY];
  }

  describe("isEnabled()", function() {
    it("returns false when no opinion, no premium, default false",
      async function() {
        expect(await api.default.isEnabled()).toBe(false);
      });

    it("returns true when default is true and nothing else set",
      async function() {
        api.initialize(true);
        expect(await api.default.isEnabled()).toBe(true);
      });

    it("returns true for premium when no caller opinion",
      async function() {
        global.__hasPremium = true;
        expect(await api.default.isEnabled()).toBe(true);
      });

    it("premium overrides default false", async function() {
      global.__hasPremium = true;
      api.initialize(false);
      expect(await api.default.isEnabled()).toBe(true);
    });

    it("caller enable() wins over default false", async function() {
      api.initialize(false);
      await api.default.enable();
      expect(await api.default.isEnabled()).toBe(true);
    });

    it("caller disable() wins over premium", async function() {
      global.__hasPremium = true;
      await api.default.disable();
      expect(await api.default.isEnabled()).toBe(false);
    });

    it("caller disable() wins over default true", async function() {
      api.initialize(true);
      await api.default.disable();
      expect(await api.default.isEnabled()).toBe(false);
    });
  });

  describe("enable()", function() {
    it("persists { enabled: true }", async function() {
      await api.default.enable();
      expect(await readPersistedState()).toEqual({enabled: true});
    });

    it("is idempotent — second call leaves state unchanged",
      async function() {
        await api.default.enable();
        await api.default.enable();
        expect(await readPersistedState()).toEqual({enabled: true});
      });

    it("transitions from disabled to enabled", async function() {
      await api.default.disable();
      await api.default.enable();
      expect(await readPersistedState()).toEqual({enabled: true});
      expect(await api.default.isEnabled()).toBe(true);
    });
  });

  describe("disable()", function() {
    it("persists { enabled: false }", async function() {
      await api.default.disable();
      expect(await readPersistedState()).toEqual({enabled: false});
    });

    it("transitions from enabled to disabled", async function() {
      await api.default.enable();
      await api.default.disable();
      expect(await readPersistedState()).toEqual({enabled: false});
    });
  });

  describe("clear()", function() {
    it("removes the enabled field", async function() {
      await api.default.enable();
      await api.default.clear();
      const state = await readPersistedState();
      expect(state).toBeDefined();
      expect("enabled" in state).toBe(false);
    });

    it("restores resolution to premium default", async function() {
      global.__hasPremium = true;
      await api.default.disable();
      expect(await api.default.isEnabled()).toBe(false);

      await api.default.clear();
      expect(await api.default.isEnabled()).toBe(true);
    });

    it("restores resolution to default when not premium",
      async function() {
        api.initialize(true);
        await api.default.disable();
        expect(await api.default.isEnabled()).toBe(false);

        await api.default.clear();
        expect(await api.default.isEnabled()).toBe(true);
      });

    it("is idempotent when no opinion is set", async function() {
      await api.default.clear();
      await api.default.clear();
      const state = await readPersistedState();
      // Either nothing persisted (never saved) or an object without
      // the enabled key — both represent "no opinion".
      expect(!state || !("enabled" in state)).toBe(true);
    });
  });

  describe("initialize()", function() {
    it("defaults defaultValue to false when called without arguments",
      async function() {
        api.initialize();
        expect(await api.default.isEnabled()).toBe(false);
      });

    it("coerces non-boolean values to false", async function() {
      api.initialize("true");
      expect(await api.default.isEnabled()).toBe(false);
    });

    it("picks up changed defaultValue on subsequent calls",
      async function() {
        api.initialize(false);
        expect(await api.default.isEnabled()).toBe(false);

        api.initialize(true);
        expect(await api.default.isEnabled()).toBe(true);
      });

    it("does not disturb a previously-set caller opinion",
      async function() {
        await api.default.disable();
        api.initialize(true);
        // Caller disable still wins.
        expect(await api.default.isEnabled()).toBe(false);
      });
  });

  describe("remote flag precedence", function() {
    it("flag=false beats caller enable(), premium, and default true",
      async function() {
        global.__lightningSnippetsFlag = false;
        global.__hasPremium = true;
        api.initialize(true);
        await api.default.enable();
        expect(await api.default.isEnabled()).toBe(false);
      });

    it("flag=true beats caller disable() and default false",
      async function() {
        global.__lightningSnippetsFlag = true;
        api.initialize(false);
        await api.default.disable();
        expect(await api.default.isEnabled()).toBe(true);
      });

    it("flag=null falls through to caller opinion", async function() {
      global.__lightningSnippetsFlag = null;
      await api.default.enable();
      expect(await api.default.isEnabled()).toBe(true);
    });

    it("non-boolean flag value falls through", async function() {
      // Guards against a misconfigured remote value — only strict
      // booleans should short-circuit the resolution chain.
      global.__lightningSnippetsFlag = "true";
      expect(await api.default.isEnabled()).toBe(false);

      global.__hasPremium = true;
      expect(await api.default.isEnabled()).toBe(true);
    });
  });
});
