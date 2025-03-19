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

import path from 'path';

import { projectRootPath, readFile, writeFile } from "./utils.js";

export function updateVersionInConfigContent(content, version) {
  const regex = /(version:\s*)\"[^\"]+\"/;

  if (!regex.test(content)) {
    throw new Error('Could not find version field in the config file');
  }
  
  return content.replace(regex, "$1\"" + version + "\"");
}

export async function updateVersionInConfig(host, version) {
  const configPath = host === 'adblock'
    ? 'host/adblock/build/config/base.mjs'
    : 'host/adblockplus/build/webext/config/base.mjs';

  const fullPath = path.join(projectRootPath(), configPath);
  const content = await readFile(fullPath);
  const updatedContent = updateVersionInConfigContent(content, version);
  await writeFile(fullPath, updatedContent);
}
