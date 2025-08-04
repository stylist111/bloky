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

import {EventEmitter} from "../../../adblockpluscore/lib/events.js";
import {EventDispatcher} from "../types.js";

const emitter = new EventEmitter();

/**
 * The supported event types for account-related events.
 */
const EVENT_TYPES = {
  ON_CHANGED: "onChanged"
};

/**
 * Emits an event with the specified name and arguments.
 *
 * @param {string} eventName - The name of the event to emit.
 * @param {...any[]} args - The arguments to pass to the event listeners.
 */
function emit(eventName, ...args) {
  emitter.emit(eventName, ...args);
}

/**
 * Dispatches an event with the specified name and arguments.
 *
 * @param {string} eventName - The name of the event to dispatch.
 * @returns {EventDispatcher} - An EventDispatcher that allows you
 *   to listen for the event.
 */
function dispatchEvent(eventName) {
  return new EventDispatcher(dispatch => {
    emitter.on(eventName, (...args) => {
      dispatch(...args);
    });
  });
}

export default {
  EVENT_TYPES,
  emit,
  dispatchEvent
};

