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

/* eslint-env node */
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {pipeline} from "stream";
import {promisify} from "util";
import {exec} from "child_process";

import got from "got";
import extractZip from "extract-zip";
import fsExtra from "fs-extra";
import dmg from "dmg";

const MAX_VERSION_DECREMENTS = 50;

let dirname = path.dirname(fileURLToPath(import.meta.url));

async function download(url, destFile)
{
  let cacheDir = path.dirname(destFile);

  await fs.promises.mkdir(cacheDir, {recursive: true});

  let tempDest = `${destFile}-${process.pid}`;
  let writable = fs.createWriteStream(tempDest);

  try
  {
    await promisify(pipeline)(got.stream(url), writable);
  }
  catch (error)
  {
    fs.unlink(tempDest, () => {});
    throw error;
  }

  await fs.promises.rename(tempDest, destFile);
}

function getChromiumExecutable(dir)
{
  switch (process.platform)
  {
    case "win32":
      return path.join(dir, "chrome-win", "chrome.exe");
    case "linux":
      return path.join(dir, "chrome-linux", "chrome");
    case "darwin":
      return path.join(dir, "chrome-mac", "Chromium.app", "Contents", "MacOS",
                       "Chromium");
    default:
      throw new Error(`Unexpected platform: ${process.platform}`);
  }
}

export async function downloadChromium(chromiumRevision)
{
  let revision = parseInt(chromiumRevision, 10);
  let startingRevision = revision;
  let platform = `${process.platform}-${process.arch}`;

  let buildTypes = {
    "win32-ia32": ["Win", "chrome-win.zip"],
    "win32-x64": ["Win_x64", "chrome-win.zip"],
    "linux-x64": ["Linux_x64", "chrome-linux.zip"],
    "darwin-x64": ["Mac", "chrome-mac.zip"],
    "dawrin-arm64": ["Mac_Arm", "chrome-mac.zip"]
  };

  let [platformDir, fileName] = buildTypes[platform];
  let archive = null;
  let browserDir = null;
  let snapshotsDir = path.join(dirname, "chromium-snapshots");

  while (true)
  {
    browserDir = path.join(snapshotsDir, `chromium-${platform}-${revision}`);

    try
    {
      await fs.promises.access(browserDir);
      console.log(`Reusing cached executable in ${browserDir}`);
      return getChromiumExecutable(browserDir);
    }
    catch (e) {}

    await fs.promises.mkdir(path.dirname(browserDir), {recursive: true});

    archive = path.join(snapshotsDir, "download-cache",
                        `${revision}-${fileName}`);

    try
    {
      try
      {
        await fs.promises.access(archive);
        console.log(`Reusing cached archive ${archive}`);
      }
      catch (e)
      {
        console.log("Downloading Chromium...");
        await download(
          `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/${platformDir}%2F${revision}%2F${fileName}?alt=media`,
          archive);
      }
      break;
    }
    catch (e)
    {
      // Chromium advises decrementing the branch_base_position when no matching
      // build was found. See https://www.chromium.org/getting-involved/download-chromium
      console.log(`Base ${revision} not found, trying ${--revision}`);
      if (revision <= startingRevision - MAX_VERSION_DECREMENTS)
        throw new Error(`No Chromium package found for ${startingRevision}`);
    }
  }

  await extractZip(archive, {dir: browserDir});
  console.log(`Executable extracted to ${browserDir}`);
  return getChromiumExecutable(browserDir);
}

function getFirefoxExecutable(dir)
{
  switch (process.platform)
  {
    case "win32":
      return path.join(dir, "core", "firefox.exe");
    case "linux":
      return path.join(dir, "firefox", "firefox");
    case "darwin":
      return path.join(dir, "Firefox.app", "Contents", "MacOS", "firefox");
    default:
      throw new Error(`Unexpected platform: ${process.platform}`);
  }
}

async function extractTar(archive, dir)
{
  await fs.promises.mkdir(dir);
  await promisify(exec)(["tar", "-jxf", archive, "-C", dir].join(" "));
}

async function extractDmg(archive, dir)
{
  let mpath = await promisify(dmg.mount)(archive);
  let files = await fs.promises.readdir(mpath);
  let target = files.find(file => path.extname(file) == ".app");
  let source = path.join(mpath, target);
  await fs.promises.mkdir(dir);
  try
  {
    await fsExtra.copy(source, path.join(dir, target));
  }
  finally
  {
    try
    {
      await promisify(dmg.unmount)(mpath);
    }
    catch (err)
    {
      console.error(`Error unmounting DMG: ${err}`);
    }
  }
}

async function runWinInstaller(archive, dir)
{
  // Procedure inspired from mozinstall. Uninstaller will also need to be run.
  // https://hg.mozilla.org/mozilla-central/file/tip/testing/mozbase/mozinstall/mozinstall/mozinstall.py
  await promisify(exec)(`"${archive}" /extractdir=${dir}`);
}

function extractFirefoxArchive(archive, dir)
{
  switch (process.platform)
  {
    case "win32":
      return runWinInstaller(archive, dir);
    case "linux":
      return extractTar(archive, dir);
    case "darwin":
      return extractDmg(archive, dir);
    default:
      throw new Error(`Unexpected platform: ${process.platform}`);
  }
}

export async function downloadFirefox(version)
{
  let {platform} = process;
  if (platform == "win32")
    platform += "-" + process.arch;
  let buildTypes = {
    "win32-ia32": ["win32", `Firefox Setup ${version}.exe`],
    "win32-x64": ["win64", `Firefox Setup ${version}.exe`],
    "linux": ["linux-x86_64", `firefox-${version}.tar.bz2`],
    "darwin": ["mac", `Firefox ${version}.dmg`]
  };

  let snapshotsDir = path.join(dirname, "firefox-snapshots");
  let browserDir = path.join(snapshotsDir, `firefox-${platform}-${version}`);
  try
  {
    await fs.promises.access(browserDir);
    console.log(`Reusing cached executable from ${browserDir}`);
    return getFirefoxExecutable(browserDir);
  }
  catch (e) {}

  await fs.promises.mkdir(path.dirname(browserDir), {recursive: true});

  let [buildPlatform, fileName] = buildTypes[platform];
  let archive = path.join(snapshotsDir, "download-cache", fileName);

  try
  {
    await fs.promises.access(archive);
    console.log(`Reusing cached archive ${archive}`);
  }
  catch (e)
  {
    let url = `https://archive.mozilla.org/pub/firefox/releases/${version}/${buildPlatform}/en-US/${fileName}`;
    console.log("Downloading Firefox...");
    await download(url, archive);
  }

  await extractFirefoxArchive(archive, browserDir);
  console.log(`Executable extracted to ${browserDir}`);
  return getFirefoxExecutable(browserDir);
}
