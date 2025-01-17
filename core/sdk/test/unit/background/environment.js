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

/* global global */

// test environment: all the globals are mocked to have control in the tests

// trivial in-memory implementation of `StorageArea`
// https://developer.chrome.com/docs/extensions/reference/storage/#type-StorageArea
import {default as StorageArea} from "mem-storage-area/StorageArea.js";

class Event {
  constructor() {
    this._listeners = new Set();
  }

  addListener(listener) {
    this._listeners.add(listener);
  }

  _trigger(args) {
    for (const listener of this._listeners) {
      listener(args);
    }
  }
}

class Browser {
  constructor() {
    this.webRequest = {
      onHeadersReceived: new Event()
    };

    this.webNavigation = {
      onBeforeNavigate: new Event()
    };

    this.runtime = {
      manifest: {
        declarative_net_request: {
          rule_resources: []
        }
      },

      getManifest() {
        return this.manifest;
      },

      getURL(path) {
        return path;
      }
    };

    this.storage = {
      local: new StorageArea(),
      session: new StorageArea()
    };

    this.tabs = {
      _messages: [],

      getMessages() {
        return this._messages;
      },

      sendMessage(tabId, message, options) {
        this._messages.push({tabId, message, options});
        return Promise.resolve();
      },

      onRemoved: new Event()
    };

    this.declarativeNetRequest = {
      DYNAMIC_RULESET_ID: "_dynamicRuleset"
    };
  }
}

const testNavigatorPrototype = {

};

export let obj = {
  configure() {
    this.browser = new Browser();
    global.browser = this.browser;

    this.navigator = Object.create(testNavigatorPrototype);
    global.navigator = this.navigator;

    // we could use `sinon` here for more opportunities of mocking and spying
    global.fetchResponses = new Map();
    global.fetch = async(url, options) => {
      let response = global.fetchResponses.get(url);
      if (!response) {
        response = {ok: true};
      }

      return Promise.resolve(response);
    };

    global.prefs = this.prefs;
  },

  setFetchResponse(url, value) {
    global.fetchResponses.set(url, value);
  },

  setRecommendations(value) {
    global.recommendations = value;
  },

  setFilterStorageSubscriptions(value) {
    global.filterStorageSubscriptions = value;
  },

  setPrefs(value) {
    global.prefs = value;
  }
};

obj.configure();

export default obj;
