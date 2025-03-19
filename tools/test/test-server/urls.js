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

import { testPagesPort } from "./test-pages-server.js";

export const blockHideUrl = `http://testpages.eyeo.com:${testPagesPort}/easylist-filters.html`;
export const blockHideLocalhostUrl = `http://localhost:${testPagesPort}/easylist-filters.html`;
export const aaTestPageUrl = `http://testpages.eyeo.com:${testPagesPort}/aa-filters.html`;
export const dcTestPageUrl = `http://testpages.eyeo.com:${testPagesPort}/dc-filters.html`;
export const snippetTestPageUrl = `http://testpages.eyeo.com:${testPagesPort}/snippet-filters.html`;
export const localTestPageUrl = `http://localhost:${testPagesPort}/test.html`;
