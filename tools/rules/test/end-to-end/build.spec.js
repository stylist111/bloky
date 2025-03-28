/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
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

import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import url from "url";

import * as abConfig from "../../config/adblock.js";
import * as abpConfig from "../../config/adblockplus.js";

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));

describe("Rules build script", function () {
  for (const host of ["adblock", "adblockplus"]) {
    describe(host, function () {
      const config = host === "adblock" ? abConfig : abpConfig;
      const distDir = path.join(scriptDir, "..", "..", "dist", host);

      it("produces a valid index file", async function () {
        const indexFile = path.join(distDir, "index", host + ".json");
        const indexContent = await fs.readFile(indexFile, "utf8");
        const indexAsJson = JSON.parse(indexContent);

        for (const recommendedId of config.recommended) {
          expect(indexAsJson).toContainEqual(
            expect.objectContaining({
              id: recommendedId,
              expires: expect.any(String),
              diff_url: expect.any(String),
            }),
          );
        }
        expect(indexAsJson).toHaveLength(config.recommended.length);

        for (const privilegedId of config.privileged) {
          expect(indexAsJson).toContainEqual(
            expect.objectContaining({
              id: privilegedId,
              privileged: true,
              expires: expect.any(String),
              diff_url: expect.any(String),
            }),
          );
        }

        const itemsWithPrivileged = indexAsJson.filter(
          (item) => item.privileged,
        );
        expect(itemsWithPrivileged).toHaveLength(config.privileged.length);
      });

      it("produces a valid fragment file", async function () {
        const fragmentFile = path.join(distDir, "manifest", host + ".json");
        const fragmentContent = await fs.readFile(fragmentFile, "utf8");
        const fragmentJson = JSON.parse(fragmentContent);

        for (const recommendedId of config.recommended) {
          expect(fragmentJson.rule_resources).toContainEqual({
            id: recommendedId,
            enabled: false,
            path: `/data/rules/dnr/${recommendedId}`,
          });
        }
        expect(fragmentJson.rule_resources).toHaveLength(
          config.recommended.length,
        );
      });

      it("produces rule and filter files", async function () {
        const rulesDir = path.join(distDir, "rules", "dnr");
        const filtersDir = path.join(distDir, "rules", "abp");

        for (const recommendedId of config.recommended) {
          const ruleFileStats = await fs.stat(
            path.join(rulesDir, recommendedId),
          );
          expect(ruleFileStats.size).toBeGreaterThan(0);
          expect(ruleFileStats.isFile()).toBe(true);

          const ruleMapFileStats = await fs.stat(
            path.join(rulesDir, recommendedId + ".map"),
          );
          expect(ruleMapFileStats.size).toBeGreaterThan(0);
          expect(ruleMapFileStats.isFile()).toBe(true);

          const filterFileStats = await fs.stat(
            path.join(filtersDir, recommendedId),
          );
          expect(filterFileStats.size).toBeGreaterThan(0);
          expect(filterFileStats.isFile()).toBe(true);
        }

        const rulesFileList = await fs.readdir(rulesDir);
        expect(rulesFileList).toHaveLength(config.recommended.length * 2);

        const filtersFileList = await fs.readdir(filtersDir);
        expect(filtersFileList).toHaveLength(config.recommended.length);
      });
    });
  }
});
