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

/* eslint-env node */
/* eslint-disable no-console */

import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import {startAdminServer} from "./admin-api.js";
import {startWebSocketServer} from "./web-socket-server.js";
import {startTestPagesServer} from "./test-pages-server.js";
import {TEST_PAGES_DOMAIN} from "./test-server-urls.js";

const args = yargs(hideBin(process.argv))
  .option("verbose", {
    alias: "v",
    type: "boolean",
    requiresArg: false,
    description: "Verbose console logging, including all requests"
  })
  .parse();

startAdminServer(TEST_PAGES_DOMAIN, args.verbose);
startWebSocketServer(TEST_PAGES_DOMAIN);
startTestPagesServer(TEST_PAGES_DOMAIN, args.verbose);
