/*
 * This file is part of eyeo's Cookie banner detection fragment,
 * Copyright (C) 2025-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, vi } from "vitest";
import browser from "webextension-polyfill";
import * as CookieBannerDetection from "./cookie-banner-detection";
import { detectionEventName, detectionMessage } from "../shared";

describe("cookie-banner-detection", () => {
  describe("forwardDetectionEvent", () => {
    it("should send the correct message", () => {
      vi.spyOn(browser.runtime, "sendMessage").mockImplementation(async () => {
        await Promise.resolve();
      });
      CookieBannerDetection.forwardDetectionEvent();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        type: detectionMessage,
      });
    });
  });

  describe("start", () => {
    it("should add the correct event listener", () => {
      vi.spyOn(document, "addEventListener").mockImplementation(() => {});
      CookieBannerDetection.start();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(document.addEventListener).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(document.addEventListener).toHaveBeenCalledWith(
        detectionEventName,
        CookieBannerDetection.forwardDetectionEvent,
      );
    });
  });
});
