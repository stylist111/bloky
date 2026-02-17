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

/* eslint-disable no-undef */
import expect from "expect";
import {shimStorage} from "../../../src/content/main/shims/storage.js";

// Tracks storage instances. A Proxy wrapping a storage object will not
// be in this set, so calling a mock method with a Proxy as `this` throws
// "Illegal invocation". This is what happens in the real browsers as well.
const storageInstances = new WeakSet();

function assertIsStorage(self) {
  if (!storageInstances.has(self)) {
    throw new TypeError("Illegal invocation");
  }
}

function createStorageMock() {
  const instance = Object.create(Storage.prototype);
  storageInstances.add(instance);
  return instance;
}

function setupGlobals() {
  global.Storage = function() {};
  Object.defineProperties(global.Storage.prototype, {
    getItem: {
      value(key) {
        assertIsStorage(this);
        return Object.prototype.hasOwnProperty.call(this, key) ?
          this[key] :
          null;
      },
      writable: true,
      configurable: true,
      enumerable: false
    },
    setItem: {
      value(key, val) {
        assertIsStorage(this);
        Object.defineProperty(this, key, {
          value: String(val),
          writable: true,
          enumerable: true,
          configurable: true
        });
      },
      writable: true,
      configurable: true,
      enumerable: false
    },
    removeItem: {
      value(key) {
        assertIsStorage(this);
        delete this[key];
      },
      writable: true,
      configurable: true,
      enumerable: false
    },
    clear: {
      value() {
        assertIsStorage(this);
        for (const k of Object.keys(this)) {
          delete this[k];
        }
      },
      writable: true,
      configurable: true,
      enumerable: false
    },
    key: {
      value(index) {
        assertIsStorage(this);
        const keys = Object.keys(this);
        return index < keys.length ? keys[index] : null;
      },
      writable: true,
      configurable: true,
      enumerable: false
    },
    length: {
      get() {
        assertIsStorage(this);
        return Object.keys(this).length;
      },
      configurable: true,
      enumerable: false
    }
  });

  global.window = global;
  global.window.localStorage = createStorageMock();
  global.window.sessionStorage = createStorageMock();
}

const EXT_A_KEY = "ewe-filters-config-adblock";
const EXT_B_KEY = "ewe-filters-config-adblockplus";

function installShim(configKey) {
  // Simulate background script writing config before the content script runs
  window.localStorage.setItem(configKey, JSON.stringify({enabled: true}));
  shimStorage(configKey);
}

describe("localStorage shim", function() {
  let savedFunctionToString;

  beforeEach(function() {
    savedFunctionToString = Object.getOwnPropertyDescriptor(
      Function.prototype, "toString"
    );
    setupGlobals();
  });

  afterEach(function() {
    Object.defineProperty(
      Function.prototype, "toString", savedFunctionToString
    );
    delete global.Storage;
    delete global.localStorage;
    delete global.sessionStorage;
    delete global.window;
  });

  describe("mock sanity check", function() {
    it("rejects Proxy as this for native methods", function() {
      const proxy = new Proxy(window.localStorage, {});
      expect(() => {
        Storage.prototype.getItem.call(proxy, "key");
      }).toThrow("Illegal invocation");
    });
  });

  describe("single extension", function() {
    beforeEach(function() {
      installShim(EXT_A_KEY);
    });

    it("hides the config key from getItem", function() {
      expect(localStorage.getItem(EXT_A_KEY)).toBeNull();
    });

    it("allows getting and setting regular keys", function() {
      localStorage.setItem("user-key", "user-value");
      expect(localStorage.getItem("user-key")).toBe("user-value");
    });

    it("excludes config key from length", function() {
      localStorage.setItem("user-key", "user-value");
      expect(localStorage.length).toBe(1);
    });

    it("excludes config key from Object.keys", function() {
      localStorage.setItem("user-key", "user-value");
      const keys = Object.keys(localStorage);
      expect(keys).toContain("user-key");
      expect(keys).not.toContain(EXT_A_KEY);
    });
  });

  describe("dual extension", function() {
    beforeEach(function() {
      installShim(EXT_A_KEY);
      installShim(EXT_B_KEY);
    });

    it("hides both config keys from getItem", function() {
      expect(localStorage.getItem(EXT_A_KEY)).toBeNull();
      expect(localStorage.getItem(EXT_B_KEY)).toBeNull();
    });

    it("allows getting and setting regular keys", function() {
      localStorage.setItem("user-key", "user-value");
      expect(localStorage.getItem("user-key")).toBe("user-value");
    });

    it("excludes both config keys from length", function() {
      localStorage.setItem("user-key", "user-value");
      expect(localStorage.length).toBe(1);
    });

    it("excludes both config keys from Object.keys", function() {
      localStorage.setItem("user-key", "user-value");
      const keys = Object.keys(localStorage);
      expect(keys).toContain("user-key");
      expect(keys).not.toContain(EXT_A_KEY);
      expect(keys).not.toContain(EXT_B_KEY);
    });

    it("excludes both config keys from key()", function() {
      localStorage.setItem("user-key", "user-value");
      expect(localStorage.key(0)).toBe("user-key");
      expect(localStorage.key(1)).toBeNull();
    });

    it("allows website to use config keys", function() {
      localStorage.setItem(EXT_A_KEY, "website-a");
      localStorage.setItem(EXT_B_KEY, "website-b");
      expect(localStorage.getItem(EXT_A_KEY)).toBe("website-a");
      expect(localStorage.getItem(EXT_B_KEY)).toBe("website-b");
    });

    it("handles removeItem for config keys", function() {
      localStorage.setItem(EXT_A_KEY, "website-value");
      expect(localStorage.getItem(EXT_A_KEY)).toBe("website-value");
      localStorage.removeItem(EXT_A_KEY);
      expect(localStorage.getItem(EXT_A_KEY)).toBeNull();
    });

    it("handles clear correctly", function() {
      localStorage.setItem("user-key", "user-value");
      localStorage.clear();
      expect(localStorage.getItem("user-key")).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it("works when calling proxied methods via Reflect.apply", function() {
      // This will throw an Illegal invocation error
      // if the shimmed methods don't properly check for a valid Storage `this`.
      const getItem = Object.getOwnPropertyDescriptor(
        Storage.prototype, "getItem"
      ).value;
      const setItem = Object.getOwnPropertyDescriptor(
        Storage.prototype, "setItem"
      ).value;
      const removeItem = Object.getOwnPropertyDescriptor(
        Storage.prototype, "removeItem"
      ).value;
      const keyFn = Object.getOwnPropertyDescriptor(
        Storage.prototype, "key"
      ).value;
      const lengthGetter = Object.getOwnPropertyDescriptor(
        Storage.prototype, "length"
      ).get;
      const clearFn = Object.getOwnPropertyDescriptor(
        Storage.prototype, "clear"
      ).value;

      const storage = window.localStorage;

      Reflect.apply(setItem, storage, ["test-key", "test-value"]);
      expect(Reflect.apply(getItem, storage, ["test-key"])).toBe("test-value");
      expect(Reflect.apply(getItem, storage, ["nonexistent"])).toBeNull();
      expect(typeof Reflect.apply(lengthGetter, storage, [])).toBe("number");
      Reflect.apply(keyFn, storage, [0]);
      Reflect.apply(removeItem, storage, ["test-key"]);
      expect(Reflect.apply(getItem, storage, ["test-key"])).toBeNull();
      Reflect.apply(clearFn, storage, []);
    });
  });
});
