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

import { type Message, type MessageEmitter } from "../shared";

/**
 * Observed web extension API message sender object due to outdated type package
 */
export interface BrowserMessageSenderWithOrigin
  extends Browser.Runtime.MessageSender {
  origin?: string;
}

/**
 * Message emitter in background context
 */
export type BackgroundMessageEmitter = MessageEmitter<MessageSender>;

/**
 * Message listener in background context
 */
export type BackgroundMessageListener = (message: Message) => void;

/**
 * Event listener triggered on connection
 */
export type ConnectListener = () => void;

/**
 * Event listener triggered on disconnection
 */
export type DisconnectListener = () => void;

/**
 * Message sender
 */
export interface MessageSender {
  /**
   * Sender frame ID
   */
  frameId: Browser.Runtime.MessageSender["frameId"];
  /**
   * Sender tab information
   */
  tab: Browser.Runtime.MessageSender["tab"];
}
