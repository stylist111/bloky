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

import path from "path";
import url from "url";
import express from "express";

import requestLogger from "./request-logger.js";
import {bypassCache, sitekeyHeader, invalidSitekeyHeader, delay, testHeader, webbundleResponseType} from "./api-middleware.js";
import {TEST_PAGES_PORT} from "./test-server-urls.js";

let app = express();
let dirname = path.dirname(url.fileURLToPath(import.meta.url));

app.use(bypassCache);
app.use(sitekeyHeader);
app.use(invalidSitekeyHeader);
app.use(delay);
app.use(testHeader);
app.use(requestLogger.logRequests);
app.use(webbundleResponseType);
app.use(express.static(path.join(dirname, "pages")));

app.post("/ping-handler", (req, res) => res.sendStatus(200));

export function startTestPagesServer(host, verbose) {
  requestLogger.setVerbose(verbose);
  app.listen(TEST_PAGES_PORT, () => {
    console.log(`Test pages server listening at http://${host}:${TEST_PAGES_PORT}`);
  });
}

