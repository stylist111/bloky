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

import * as app from "./category-app";
import * as messaging from "./messaging";
import * as utils from "./utils";

const mockReturnValue = Symbol("return value");

jest.mock("./messaging");
jest.mock("./utils");

function setBrowser(application: string, platform: string): void {
  (utils.send as jest.Mock).mockImplementation(async (type, options) => {
    if (options.what === "application") {
      return application;
    }

    if (options.what === "platform") {
      return platform;
    }
  });
}

describe("Messaging category: app", () => {
  it("app.get", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await app.get("application");

    expect(utils.send).toHaveBeenLastCalledWith("app.get", {
      what: "application"
    });
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("app.getInfo sends messages", async () => {
    setBrowser("chrome", "chromium");
    await app.getInfo();

    expect(utils.send).toHaveBeenCalledWith("app.get", { what: "application" });
    expect(utils.send).toHaveBeenCalledWith("app.get", { what: "platform" });
  });

  it("app.getInfo returns information for Chrome", async () => {
    const application = "chrome";
    const platform = "chromium";
    setBrowser(application, platform);
    const info = await app.getInfo();

    expect(info).toMatchObject({
      application,
      manifestVersion: 3,
      platform,
      store: "chrome"
    });
  });

  it("app.getInfo returns information for Firefox", async () => {
    const application = "firefox";
    const platform = "gecko";
    setBrowser(application, platform);
    const info = await app.getInfo();

    expect(info).toMatchObject({
      application,
      manifestVersion: 3,
      platform,
      store: "firefox"
    });
  });

  it("app.getInfo returns information for Microsoft Edge", async () => {
    const application = "edge";
    const platform = "chromium";
    setBrowser(application, platform);
    const info = await app.getInfo();

    expect(info).toMatchObject({
      application,
      manifestVersion: 3,
      platform,
      store: "edge"
    });
  });

  it("app.getInfo returns information for Opera", async () => {
    const application = "opera";
    const platform = "chromium";
    setBrowser(application, platform);
    const info = await app.getInfo();

    expect(info).toMatchObject({
      application,
      manifestVersion: 3,
      platform,
      store: "opera"
    });
  });

  it("app.getInfo returns information for other browser", async () => {
    const application = "other";
    const platform = "other";
    setBrowser(application, platform);
    const info = await app.getInfo();

    expect(info).toMatchObject({
      application,
      manifestVersion: 3,
      platform,
      store: "chrome"
    });
  });

  it("app.listen", () => {
    const filter = ["foo"];
    app.listen(filter);

    expect(messaging.listen).toHaveBeenCalledWith({
      type: "app",
      filter
    });
  });

  it("app.open without parameters", async () => {
    await app.open("options");

    expect(utils.send).toHaveBeenCalledWith("app.open", {
      what: "options"
    });
  });

  it("app.open with parameters", async () => {
    await app.open("options", { replaceTab: true });

    expect(utils.send).toHaveBeenCalledWith("app.open", {
      replaceTab: true,
      what: "options"
    });
  });

  it("app.getAdFilteringState", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await app.getAdFilteringState();

    expect(utils.send).toHaveBeenCalledWith("app.getAdFilteringState");
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("app.close", async () => {
    await app.close();

    expect(utils.send).toHaveBeenCalledWith("app.close");
  });
});
