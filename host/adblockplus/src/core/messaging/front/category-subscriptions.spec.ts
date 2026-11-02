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

import * as subscriptions from "./category-subscriptions";
import * as messaging from "./messaging";
import * as utils from "./utils";

const mockReturnValue = Symbol("return value");

jest.mock("./messaging");
jest.mock("./utils");

describe("Messaging category: subscriptions", () => {
  it("subscriptions.add", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const url = "http://example.com/filters.txt";
    const value = await subscriptions.add(url);

    expect(utils.send).toHaveBeenCalledWith("subscriptions.add", {
      url
    });
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.get without parameters", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await subscriptions.get();

    expect(utils.send).toHaveBeenCalledWith("subscriptions.get", {});
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.get with parameters", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await subscriptions.get({ disabledFilters: true });

    expect(utils.send).toHaveBeenCalledWith("subscriptions.get", {
      disabledFilters: true
    });
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.getInitIssues", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await subscriptions.getInitIssues();

    expect(utils.send).toHaveBeenCalledWith("subscriptions.getInitIssues");
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.getRecommendations", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const value = await subscriptions.getRecommendations();

    expect(utils.send).toHaveBeenCalledWith("subscriptions.getRecommendations");
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.listen", () => {
    const filter = ["foo"];
    subscriptions.listen(filter);

    expect(messaging.listen).toHaveBeenCalledWith({
      type: "subscriptions",
      filter
    });
  });

  it("subscriptions.remove", async () => {
    const url = "http://example.com/filters.txt";
    await subscriptions.remove(url);

    expect(utils.send).toHaveBeenLastCalledWith("subscriptions.remove", {
      url
    });
  });

  it("subscriptions.toggle", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const url = "http://example.com/filters.txt";
    const value = await subscriptions.toggle(url);

    expect(utils.send).toHaveBeenCalledWith("subscriptions.toggle", {
      url
    });
    expect(value).toStrictEqual(mockReturnValue);
  });

  it("subscriptions.toggle with keepInstalled", async () => {
    (utils.send as jest.Mock).mockImplementation(async () => mockReturnValue);

    const url = "http://example.com/filters.txt";
    await subscriptions.toggle(url, true);

    expect(utils.send).toHaveBeenCalledWith("subscriptions.toggle", {
      keepInstalled: true,
      url
    });
  });
});
