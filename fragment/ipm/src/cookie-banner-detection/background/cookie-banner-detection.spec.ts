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
import { type WebNavigation } from "webextension-polyfill";
import * as CookeBannerDetection from "./cookie-banner-detection";
import * as ScriptInjector from "./script-injector";

describe("cookie-banner-detection", () => {
  describe("injectDetectionScript", () => {
    it("should call executeFunction if the given frame is the top level frame", async () => {
      jest.spyOn(ScriptInjector, "executeFunction");
      await CookeBannerDetection.injectDetectionScript({
        frameId: 0,
        tabId: 123,
      } as unknown as WebNavigation.OnCommittedDetailsType);
      expect(ScriptInjector.executeFunction).toHaveBeenCalledTimes(1);
    });
    it("should not do anything if the given frame is not the top level frame", async () => {
      jest.spyOn(ScriptInjector, "executeFunction");
      await CookeBannerDetection.injectDetectionScript({
        frameId: 456,
        tabId: 123,
      } as unknown as WebNavigation.OnCommittedDetailsType);
      expect(ScriptInjector.executeFunction).not.toHaveBeenCalled();
    });
  });

  describe("start", () => {
    // This is not available in our current test env, so let's create what
    // we need to test
    if (typeof browser.webNavigation.onCommitted === "undefined") {
      // @ts-expect-error: Missing properties.
      browser.webNavigation.onCommitted = {
        addListener: (callback: any) => {},
      };
    }

    it("should add the correct event listener", () => {
      jest
        .spyOn(browser.webNavigation.onCommitted, "addListener")
        .mockImplementation();

      CookeBannerDetection.start();
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        browser.webNavigation.onCommitted.addListener,
      ).toHaveBeenCalledTimes(1);
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        browser.webNavigation.onCommitted.addListener,
      ).toHaveBeenCalledWith(CookeBannerDetection.navigationListener);
    });
  });
});
