#!/usr/bin/env node
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

// Generates the DNR rulesets referenced by test/extension-safari/manifest.json,
// and the raw subscription text EWE reads at runtime for cosmetic filters,
// from the subscriptions bundled in the @eyeo/filterlists package, instead of
// relying on a static copy of filter list data checked into the repository.

import fs from "fs";
import path from "path";
import {createRequire} from "module";
import {isMain} from "./utils.js";
import {cleanup} from "./clean-mv3-files.js";
import {convert} from "./convertSubscriptions.js";

const require = createRequire(import.meta.url);

const safariDir = path.join(process.cwd(), "test", "extension-safari");
const manifestPath = path.join(safariDir, "manifest.json");
const rulesetsDir = path.join(safariDir, "rulesets");
const persistedSubscriptionsDir = path.join(safariDir, "subscriptions");
const scratchDir = path.join(process.cwd(), "scriptsOutput", "safari-test-rulesets");

export async function run() {
  let manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf-8"));
  let ids = manifest.declarative_net_request.rule_resources.map(
    resource => resource.id
  );

  let indexPath = require.resolve("@eyeo/filterlists/filterlists/index.json");
  let filterlistsDir = path.dirname(indexPath);
  let index = JSON.parse(await fs.promises.readFile(indexPath, "utf-8"));

  await cleanup(scratchDir);
  let subscriptionsDir = path.join(scratchDir, "subscriptions");
  await fs.promises.mkdir(subscriptionsDir, {recursive: true});

  let selectedSubscriptions = [];
  for (let id of ids) {
    let entry = index.find(candidate => candidate.id == id);
    if (!entry) {
      throw new Error(
        `Subscription ${id} referenced by ${manifestPath} was not found ` +
        "in @eyeo/filterlists."
      );
    }

    await fs.promises.copyFile(
      path.join(filterlistsDir, id), path.join(subscriptionsDir, id)
    );
    selectedSubscriptions.push(entry);
  }

  let selectedIndexPath = path.join(scratchDir, "selected-subscriptions.json");
  await fs.promises.writeFile(
    selectedIndexPath, JSON.stringify(selectedSubscriptions, null, 2)
  );

  await cleanup(rulesetsDir);
  await convert(subscriptionsDir, rulesetsDir, false, "",
                selectedIndexPath, 2, true);

  // The raw subscription text is also bundled alongside the DNR rulesets:
  // EWE reads it at runtime (getFilterText() in subscriptions-utils.js, via
  // the "subscriptions" bundledSubscriptionsPath set in ewe.js) to parse
  // cosmetic filters, which DNR rules cannot express.
  await cleanup(persistedSubscriptionsDir);
  for (let id of ids) {
    await fs.promises.copyFile(
      path.join(subscriptionsDir, id), path.join(persistedSubscriptionsDir, id)
    );
  }

  console.log(`Generated Safari test rulesets in ${rulesetsDir}`);
  console.log(`Generated Safari test subscriptions in ${persistedSubscriptionsDir}`);
}

if (isMain(import.meta.url)) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
