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

type MessageListener = (
  message: unknown
) => true | Promise<unknown> | undefined;

const overlayId = "__abp-overlay-onpage-dialog";

jest.mock("~/core/messaging/front", () => ({
  addDisconnectListener: jest.fn()
}));

jest.mock("../../unload-cleanup/content", () => ({
  prepareElementForUnload: jest.fn()
}));

async function loadFrameManager(): Promise<MessageListener> {
  let handleMessage: MessageListener = () => undefined;

  jest
    .spyOn(browser.runtime.onMessage, "addListener")
    .mockImplementation((listener) => {
      handleMessage = listener as MessageListener;
    });

  await import("./frame-manager");

  return handleMessage;
}

describe("frame-manager", () => {
  beforeEach(() => {
    jest.resetModules();
    document.documentElement.innerHTML = "<body></body>";
  });

  describe("showDialog", () => {
    it("appends the dialog overlay to document.body", async () => {
      const handleMessage = await loadFrameManager();

      void handleMessage({ type: "onpage-dialog.show", platform: "chromium" });

      const overlay = document.getElementById(overlayId);
      expect(overlay).not.toBeNull();
      expect(overlay?.parentElement).toBe(document.body);
    });

    it("appends the dialog overlay to the document element instead of a <frameset>", async () => {
      document.body = document.createElement("frameset");

      const handleMessage = await loadFrameManager();

      void handleMessage({ type: "onpage-dialog.show", platform: "chromium" });

      const overlay = document.getElementById(overlayId);
      expect(overlay).not.toBeNull();
      expect(overlay?.parentElement).toBe(document.documentElement);
      expect(overlay?.parentElement).not.toBe(document.body);
    });
  });
});
