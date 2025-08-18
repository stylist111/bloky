/**
 * This file is part of eyeo's PolyFill fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Message sender
 */
export interface MessageSender {
  /**
   * Sender frame ID
   */
  frameId: browser.Runtime.MessageSender["frameId"];
  /**
   * Sender tab information
   */
  tab: browser.Runtime.MessageSender["tab"];
  /**
   * Information about sender page
   */
  page: {
    /**
     * Sender page ID (same as tab ID)
     */
    id: number;
    /**
     * Sender page URL
     */
    url: URL;
  };
}

/**
 * Interface for an object passed between the content script to background page
 */
export interface Message {
  /**
   * Sender frame ID
   */
  type: string;
}

/**
 * Interface for the Message sent when the YT as wall is detected
 */
export interface AdWallMessage extends Message {
  /**
   * Indicates if the user is logged into YouTube when the ad wall is detected
   */
  userLoggedIn: string;

  /**
   * The current time of the YT video when an ad wall is shown
   */
  currentPlaybackTime: number;

  /**
   * Indicates if it can be dismissed by the user or not
   */
  hasDismiss: boolean;
}

/**
 * Interface for the Message sent when the iFramePlayer fails with error
 */
export interface YTHavenPlayerErrorMessage extends Message {
  /**
   * The error code for the player
   */
  errorCode: string;
}

export interface YTHavenToggleMessage extends Message {
  /**
   * The state of the toggle
   */
  newState: boolean;
}

/**
 * Interface for the Message
 */
export interface YTHavenRecordEvent extends Message {
  eventName: string;
}
