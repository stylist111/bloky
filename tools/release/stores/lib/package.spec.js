/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2026-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

import path from "path";
import { describe, expect, it, vi } from "vitest";

import { projectRootPath } from "../../utils.js";
import {
  checkPackageVersion,
  chromePackagePath,
  firefoxPackagePath,
  readPackageFile,
  sourcePackagePath,
} from "./package.js";

const PACKAGE_PATH =
  "/repo/host/adblock/dist/release/adblock-chrome-6.47.0-mv3.zip";

describe("chromePackagePath", () => {
  it("points to the release build of the host", () => {
    expect(chromePackagePath("adblock", "6.47.0", "/repo")).toBe(PACKAGE_PATH);
  });

  it("resolves relative to this repository by default", () => {
    expect(chromePackagePath("adblockplus", "4.46.0")).toBe(
      path.join(
        projectRootPath(),
        "host/adblockplus/dist/release/adblockplus-chrome-4.46.0-mv3.zip",
      ),
    );
  });
});

describe("firefoxPackagePath", () => {
  it("points to the Firefox release build of the host", () => {
    expect(firefoxPackagePath("adblock", "6.47.0", "/repo")).toBe(
      "/repo/host/adblock/dist/release/adblock-firefox-6.47.0-mv2.xpi",
    );
  });
});

describe("sourcePackagePath", () => {
  it("points to the source archive of the host", () => {
    expect(sourcePackagePath("adblockplus", "4.46.0", "/repo")).toBe(
      "/repo/host/adblockplus/dist/release/adblockplus-4.46.0.tar.gz",
    );
  });
});

describe("release paths", () => {
  it("reject a host or version that could change the path", () => {
    for (const releasePath of [
      chromePackagePath,
      firefoxPackagePath,
      sourcePackagePath,
    ]) {
      expect(() => releasePath("../../etc", "4.46.0", "/repo")).toThrow(
        'Invalid host "../../etc"',
      );
      expect(() => releasePath("adblock", "99;ls", "/repo")).toThrow(
        'Invalid version "99;ls"',
      );
    }
  });
});

describe("checkPackageVersion", () => {
  it("accepts a package with the released version", async () => {
    const readVersion = vi.fn(async () => "6.47.0");

    await checkPackageVersion(PACKAGE_PATH, "6.47.0", readVersion);

    expect(readVersion).toHaveBeenCalledWith(PACKAGE_PATH);
  });

  it("rejects a package with a different version", async () => {
    await expect(
      checkPackageVersion(PACKAGE_PATH, "6.47.0", async () => "6.46.0"),
    ).rejects.toThrow(
      `${PACKAGE_PATH} contains version 6.46.0, ` +
        "but 6.47.0 is being released. Not uploading.",
    );
  });

  it("explains when the version can't be read", async () => {
    const unzipError = new Error("cannot find or open the zip");

    const error = await checkPackageVersion(
      PACKAGE_PATH,
      "6.47.0",
      async () => {
        throw unzipError;
      },
    ).catch((caught) => caught);

    expect(error.message).toBe(
      `Can't read the version from ${PACKAGE_PATH}: cannot find or open the zip`,
    );
    expect(error.cause).toBe(unzipError);
  });
});

describe("readPackageFile", () => {
  it("returns the package", async () => {
    const pkg = new Blob(["zip"]);

    expect(await readPackageFile(PACKAGE_PATH, async () => pkg)).toBe(pkg);
  });

  it("explains when the package can't be read", async () => {
    const missing = new Error("no such file or directory");

    const error = await readPackageFile(PACKAGE_PATH, async () => {
      throw missing;
    }).catch((caught) => caught);

    expect(error.message).toBe(
      `Can't read the package at ${PACKAGE_PATH}: no such file or directory`,
    );
    expect(error.cause).toBe(missing);
  });
});
