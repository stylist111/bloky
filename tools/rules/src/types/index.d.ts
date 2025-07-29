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

interface Filterlist {
  diff_url: string;
  expires: string;
  homepage?: string;
  id: string;
  includes?: string[];
  languages?: string[];
  mv2_url: string;
  privileged?: boolean;
  requires?: string[];
  title: string;
  type: string;
  url: string;
}

declare const filterlists: Filterlist[];
export default filterlists;
