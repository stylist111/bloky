/*
 * This file is part of @eyeo/rules-utils <https://adblock.org/>,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * @eyeo/rules-utils is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * @eyeo/rules-utils is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @eyeo/rules-utils.  If not, see <http://www.gnu.org/licenses/>.
 */

import { promises as fs } from "fs";
import path from "path";

import * as fsh from "./fs-helper.js";
import { execNpm, importJson } from "./utils.js";
import { getRecommendations } from "../all/index.js";

const BLOKY_DIFF_BASE =
  process.env.BLOKY_DIFF_BASE || "https://stylist111.github.io/bloky/v3/diff/";

async function buildExtensionRules(hostname) {
  await fsh.clean(hostname);

  const config = await fsh.getConfig(hostname);
  const availableSubscriptions = await importJson(
    "@eyeo/filterlists/filterlists/index.json",
  );
  const subscriptions = getRecommendations(
    availableSubscriptions,
    config.recommended,
    config.privileged,
  );

  await fs.writeFile(
    await fsh.getDistPath(hostname, fsh.indexSelected),
    JSON.stringify(subscriptions, null, 2),
    "utf8",
  );
  console.log(
    "Created index",
    await fsh.getDistPath(hostname, fsh.indexSelected),
  );

  // subs-convert doesn't offer a way to specify which files we'd like to convert
  // so we need to copy the relevant files to a temporary directory and pass
  // that one instead
  const dataRulesAbp = await fsh.getDataPath(".");
  const distRulesAbp = await fsh.getDistPath(hostname, fsh.rulesAbp);
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const from = path.join(dataRulesAbp, subscription.id);
      const to = path.join(distRulesAbp, subscription.id);
      if (hostname !== "adblock") {
        await fs.copyFile(from, to);
        return;
      }
      // Bloky: filter list updates (diffs) come from Bloky's own mirror on
      // GitHub Pages instead of eyeo's server, which is blocked in some
      // countries. See tools/bloky/mirror-filters.mjs.
      const text = await fs.readFile(from, "utf8");
      await fs.writeFile(
        to,
        text.replace(
          /^(! DiffUrl: )https:\/\/easylist-downloads\.adblockplus\.org\/v3\/diff\//m,
          `$1${BLOKY_DIFF_BASE}`,
        ),
        "utf8",
      );
    }),
  );

  await execNpm(
    "subs-convert",
    "-i",
    distRulesAbp,
    "-o",
    await fsh.getDistPath(hostname, fsh.rulesDnr),
    "-s",
    await fsh.getDistPath(hostname, fsh.indexSelected),
  );
  console.log("Created rules", await fsh.getDistPath(hostname, fsh.rulesDnr));

  const manifestArgs = [
    "-p",
    "data/rules/dnr/",
    "-i",
    await fsh.getDistPath(hostname, fsh.rulesDnr),
    "-o",
    await fsh.getDistPath(hostname, fsh.manifestFragment),
  ];

  if (config.defaultEnabled && config.defaultEnabled.length > 0) {
    manifestArgs.push("-d", ...config.defaultEnabled);
  }

  await execNpm("subs-generate", ...manifestArgs);

  console.log(
    "Created manifest fragment",
    await fsh.getDistPath(hostname, fsh.manifestFragment),
  );
}

// Getting a feel for how this works. WIP.
await Promise.all([
  buildExtensionRules("adblock"),
  buildExtensionRules("adblockplus"),
]);
