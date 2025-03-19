#!/usr/bin/env node
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

import {ReleaseNotes} from "./release-notes.js";

async function run() {
  const host = process.argv[2];
  const version = process.argv[3];

  if (!host || !version) {
    console.error('Please provide a host and a version');
    console.error('Usage: node get-release-notes.js <host> <version>');
    process.exit(1);
  }      

  const releaseNotes = await ReleaseNotes.readFromHostFilepath(host);    
  const notesForVersion = releaseNotes.notesForVersion(version);
  console.log(notesForVersion); 
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});
