/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import browser from "webextension-polyfill";
import * as CookeBannerDetection from "./cookie-banner-detection";
import { detectionEventName, detectionMessage } from "../shared";

describe("cookie-banner-detection", () => {
  describe("forwardDetectionEvent", () => {
    it("should send the correct message", () => {
      jest.spyOn(browser.runtime, "sendMessage").mockImplementation();
      CookeBannerDetection.forwardDetectionEvent();
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
      jest.spyOn(document, "addEventListener").mockImplementation();
      CookeBannerDetection.start();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(document.addEventListener).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(document.addEventListener).toHaveBeenCalledWith(
        detectionEventName,
        CookeBannerDetection.forwardDetectionEvent,
      );
    });
  });
});
