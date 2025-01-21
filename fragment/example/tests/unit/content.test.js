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
import { start } from "../../src/content/index.js";
import { imageCountEvent } from "../../src/shared/constants.js";

describe("Hello World fragment content script", () => {
  beforeEach(() => {
    vi.spyOn(document, "querySelectorAll").mockImplementation((selector) => {
      if (selector === "img[src]") {
        return [{}, {}, {}]; // Mock three images with src
      }
      return [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should count images, send the count to the worker", async () => {
    await start();

    expect(document.querySelectorAll).toHaveBeenCalledWith("img[src]");
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: imageCountEvent,
      imageCount: 3,
    });
  });
});
