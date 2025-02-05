/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2020-present eyeo GmbH
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

/* eslint-env node */

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const devenvPath = path.join(process.cwd(), "dist", "devenv");
const helperExtensionDestPath = {
  mv2: path.join(devenvPath, "helper-extension-mv2"),
  mv3: path.join(devenvPath, "helper-extension-mv3")
};
const helperExtensionDestZip = {
  mv2: path.join(devenvPath, "helper-extension-mv2.zip"),
  mv3: path.join(devenvPath, "helper-extension-mv3.zip")
};
const helperExtensionSrcPath = path.join(
  process.cwd(),
  "test",
  "end-to-end-deprecated",
  "helper-extension"
);

async function run() {
  for (const manifestVersionsItem of ["2", "3"]) {
    const manifestVersion = parseInt(manifestVersionsItem, 10);
    await fs.promises.rm(helperExtensionDestPath[`mv${manifestVersionsItem}`], {
      recursive: true,
      force: true
    });
    await fs.promises.rm(helperExtensionDestZip[`mv${manifestVersionsItem}`], {
      recursive: true,
      force: true
    });
    await fs.promises.mkdir(
      helperExtensionDestPath[`mv${manifestVersionsItem}`],
      { recursive: true }
    );

    const manifestBase = path.join(
      helperExtensionSrcPath,
      "manifest.base.json"
    );
    const manifest = JSON.parse(await fs.promises.readFile(manifestBase));

    manifest.name = `${manifest.name} MV${manifestVersion}`;
    manifest["manifest_version"] = manifestVersion;
    manifest.background =
      manifestVersion === 2
        ? { scripts: ["background.js"] }
        : { service_worker: "background.js" };

    await fs.promises.writeFile(
      path.join(
        helperExtensionDestPath[`mv${manifestVersionsItem}`],
        "manifest.json"
      ),
      JSON.stringify(manifest, null, 2)
    );
    await fs.promises.copyFile(
      path.join(helperExtensionSrcPath, "background.js"),
      path.join(
        helperExtensionDestPath[`mv${manifestVersionsItem}`],
        "background.js"
      )
    );

    const zip = new AdmZip();
    zip.addLocalFolder(helperExtensionDestPath[`mv${manifestVersionsItem}`]);
    zip.writeZip(helperExtensionDestZip[`mv${manifestVersionsItem}`]);

    // eslint-disable-next-line no-console
    console.log(
      "Helper extension MV" +
        manifestVersionsItem +
        ` built to ${helperExtensionDestPath[`mv${manifestVersionsItem}`]} ` +
        `and zipped to ${helperExtensionDestZip[`mv${manifestVersionsItem}`]}`
    );
  }
}

(async () => {
  try {
    await run();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
