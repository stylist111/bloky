/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
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
 * Names of the events this fragment reports. These double as the message types
 * exchanged between the content script and the background page, and must match
 * the `youtube` module entries in core/sdk/events.js exactly — an unknown name
 * is rejected by the logger and the event is dropped.
 */
export const youTubeAlreadyAllowListed = "yt_site_already_allowlisted";
export const youTubeAutoAllowlisted = "yt_auto_allowlisted";
export const youTubeWallDetected = "yt_site_ad_wall_detected";
export const youTubeNavigation = "yt_site_navigation";
export const adShownEvent = "yt_site_ad_shown";
export const toastShownEvent = "yt_site_toast_shown";
export const contextTamperingEvent = "yt_site_context_tampering";
export const errorEvent = "yt_site_yt_error";
/**
 * How long an automatic allowlisting lasts. Only `TAB` is currently reported;
 * `VIDEO` is the other value the event schema permits.
 */
export enum AllowlistScope {
  // Applies until the tab is closed
  TAB = "tab",
  // Applies to the current video only
  VIDEO = "video",
}

export enum ErrorType {
  // Error when video is not playing
  PLAYER_ERROR = "player_error",
  // Any uncaught exception
  UNCAUGHT_EXCEPTION = "uncaught_exception",
  // Something went wrong error
  SWW_ERROR = "sww_error",
}

export const ytRecordEvent = "yt-site.record-event";
