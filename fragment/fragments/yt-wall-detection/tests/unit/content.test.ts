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

import { vi, expect, test } from "vitest";
import { JestChrome } from "jest-chrome/types/jest-chrome";
import { type AdWallMessage } from "@eyeo/polyfills/all";

import { start } from "../../src/content/index";

test("content script", () => {
  const responseMessage: AdWallMessage = {
    type: "yt-site.ad-wall-detected",
    userLoggedIn: false,
    currentPlaybackTime: 0,
  };

  const listenerSpy = vi.fn();

  chrome.runtime.onMessage.addListener(listenerSpy);

  expect(chrome.runtime.onMessage.hasListeners()).toBe(true);

  start();

  document.body.append(
    document.createElement("ytd-enforcement-message-view-model"),
  );

  const jestChrome = chrome as any as JestChrome;

  jestChrome.runtime.sendMessage.mockImplementation(
    (_message: any, callback: any) => {
      expect(_message).toMatchObject(responseMessage);
      return callback(null);
    },
  );
});
