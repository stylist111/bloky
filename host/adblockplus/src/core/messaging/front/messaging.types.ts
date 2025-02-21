/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import type Browser from "webextension-polyfill";

import { type MessageEmitter } from "../shared";

/**
 * Message emitter in front context
 */
export type FrontMessageEmitter = MessageEmitter<Browser.Runtime.MessageSender>;

/**
 * Options for listening to events on port
 */
export interface ListenOptions {
  /**
   * List of events to listen to
   */
  filter: string[];

  /**
   * ID of tab for which to listen to events
   * (only supported for "requests.listen")
   */
  tabId?: number;

  /**
   * Namespace
   */
  type: string;
}

/**
 * Port to access the browser runtime. Null if not set yet.
 */
export type Port = Browser.Runtime.Port | null;
