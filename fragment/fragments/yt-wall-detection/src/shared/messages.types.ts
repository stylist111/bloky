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

export const youTubeAlreadyAllowListed = "yt-site.already.allowlisted";
export const youTubeAutoAllowlisted = "yt-auto.allowlisted";
export const youTubeWallDetected = "yt-site.ad-wall-detected";
export const youTubeNavigation = "yt-site.navigation";
export const adShownEvent = "yt-site.ad-shown";
export const toastShownEvent = "yt-site.toast-shown";
export const contextTamperingEvent = "yt-site.context-tampering";
export const errorEvent = "yt-site.yt-error";
export enum ErrorType {
  // Error when video is not playing
  PLAYER_ERROR = "player_error",
  // Any uncaught exception
  UNCAUGHT_EXCEPTION = "uncaught_exception",
  // Something went wrong error
  SWW_ERROR = "sww_error",
}

export const ytRecordEvent = "yt-site.record-event";
