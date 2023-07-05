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

import {TEST_PAGES_URL} from "./utils.js";

export const VALID_FILTER_TEXT = `|${TEST_PAGES_URL}$image`;
export const COMMENT_FILTER_TEXT = "!comment";
export const SECOND_VALID_FILTER_TEXT = "another-filter";

export let subCircumvention = {
  id: "00000000-0000-0000-0000-000000000030",
  type: "circumvention",
  title: "ABP filters",
  homepage: "https://github.com/abp-filters/abp-filters-anti-cv",
  url: "http://localhost:3003/anti-cv-subscription.txt",
  mv2_url: "http://localhost:3003/mv2_anti-cv-subscription.txt",
  diff_url: "http://localhost:3003/anti-cv-subscription_diff.json"
};
