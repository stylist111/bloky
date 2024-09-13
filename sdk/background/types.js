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

export {BlockableEventDispatcher} from "./diagnostics.js";

/**
 * The EventDispatcher class allows users to listen to
 * certain events that are emitted.
 * @hideconstructor
 * @param {function} initializer
 * @param {function} [finalizer]
 */
export class EventDispatcher {
  constructor(initializer, finalizer) {
    this._listeners = new Set();
    this._initialized = false;

    let dispatch = (...args) => {
      for (let listener of this._listeners) {
        listener(...args);
      }
    };

    this._initialize = initializer.bind(null, dispatch);
    this._finalize = finalizer && finalizer.bind(null, dispatch);
  }

  /**
    * Attaches a listener function to an event. This listener will be called
    * when the event is emitted. Please note that in an MV3 context this has
    * to happen in the first turn of the event loop. This should happen when
    * your service worker starts.
    * @param {function} listener The user defined function that will be called
    *                            once the specified event is emitted.
    */
  addListener(listener) {
    if (!this._initialized) {
      this._initialize();
      this._initialized = true;
    }

    this._listeners.add(listener);
  }

  /**
    * Removes the added function. The listener will no longer be called
    * by the event.
    * @param {function} listener The user defined function to be removed.
    */
  removeListener(listener) {
    this._listeners.delete(listener);

    if (this._initialized && this._finalize && this._listeners.size == 0) {
      this._finalize();
      this._initialized = false;
    }
  }

  /**
   * Call listeners with the provided arguments.
   * @param {[Object]} listener arguments
   */
  emit(...args) {
    for (let listener of this._listeners) {
      listener(...args);
    }
  }
}

/**
 * The result of parsing an invalid filter.
 * @property {string} type Either `invalid_filter` or `invalid_domain`.
 * @property {string} reason The reason why the filter is invalid.
 * @property {string?} option The filter option that made the filter invalid.
 * @param {string} type
 * @param {string} reason
 * @param {string?} option
 * @hideconstructor
 */
export class FilterError extends Error {
  constructor(type, reason, option = null) {
    super(JSON.stringify({type, reason, option}));
    this.name = "FilterError";
    this.type = type;
    this.reason = reason;
    this.option = option;
  }
}
