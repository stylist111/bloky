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

import * as messaging from "~/core/messaging/background";
import * as closeTab from "./close-tab";

jest.mock("~/core/messaging/background", () => ({
  port: {
    on: jest.fn()
  },
  addTrustedMessageTypes: jest.fn()
}));

describe("close-tab background", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register app.close as trusted message type for all trusted origins", () => {
    closeTab.start();

    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledTimes(5);
    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledWith(
      "https://adblockplus.org",
      ["app.close"]
    );
    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledWith(
      "https://new.adblockplus.org",
      ["app.close"]
    );
    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledWith(
      "https://welcome.adblockplus.org",
      ["app.close"]
    );
    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledWith(
      "https://accounts.adblockplus.org",
      ["app.close"]
    );
    expect(messaging.addTrustedMessageTypes).toHaveBeenCalledWith(
      "https://myaccount.adblockplus.org",
      ["app.close"]
    );
  });

  it("should register app.close message handler", () => {
    closeTab.start();

    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    expect(messaging.port.on).toHaveBeenCalledWith(
      "app.close",
      expect.any(Function)
    );
  });
});
