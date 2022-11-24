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

// test environment: all the globals are mocked to have control in the tests

// trivial in-memory implementation of `StorageArea`
// https://developer.chrome.com/docs/extensions/reference/storage/#type-StorageArea
import {default as StorageArea} from "mem-storage-area/StorageArea.js";

const testBrowserPrototype = {
  webRequest: {
    onHeadersReceived: {
      _callbacks: new Set(),
      _trigger(args) {
        for (let callback of this._callbacks)
          callback(args);
      },

      addListener(callback, details, filter) {
        this._callbacks.add(callback);
      }
    }
  },
  runtime: {
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
  }
};

const testNavigatorPrototype = {

};

let browser;
let navigator;

export let obj = {
  browser,
  navigator,

  async configure() {
    this.browser = Object.create(testBrowserPrototype);
    this.browser.storage = {
      local: new StorageArea(),
      session: new StorageArea()
    };

    // eslint-disable-next-line no-undef
    global.browser = this.browser;

    this.navigator = Object.create(testNavigatorPrototype);
    // eslint-disable-next-line no-undef
    global.navigator = this.navigator;

    // we could use `sinon` here for more opportunities of mocking and spying
    // eslint-disable-next-line no-undef
    global.fetchResponse = {ok: true};
    // eslint-disable-next-line no-undef
    global.fetch = async(url, options) => Promise.resolve(global.fetchResponse);
  },

  setFetchResponse(value) {
    // eslint-disable-next-line no-undef
    global.fetchResponse = value;
  }
};

obj.configure();

export default obj;
