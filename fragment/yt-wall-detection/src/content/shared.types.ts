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
 * Configuration of the iframe embedded player
 */
export interface IframePlayerConfig {
  videoId: string;
  playlistId?: string;
  showWatchingWith?: boolean;
  showInModal?: boolean;
  startSeconds?: number;
}

/**
 * The context of the current video
 */
export interface VideoContext {
  playlistId?: string;
  isEmbeddable: boolean;
  videoId: string;
  nextVideoId?: string;
  startSeconds?: number;
}

/**
 * The video context store
 */
export interface VideoContextStoreType {
  _videoContext: VideoContext | null;
  setVideoContext: (newContext: VideoContext) => void;
  getVideoContext: () => VideoContext;
}

interface YTVideoData {
  errorCode: string;
}

interface YTInfo {
  playerState: number;
  videoData?: YTVideoData;
}

export interface YTEventData {
  info: YTInfo;
  event?: string;
}

declare global {
  interface WindowEventMap {
    "yt-navigate-finish": CustomEvent;
  }
}
