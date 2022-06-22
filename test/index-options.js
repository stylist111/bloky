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

"use strict";

const TEST_LINKS = ["unit", "reload"];
const TEXT_OPTIONS = ["grep", "timeout"];

function onLoad() {
  if (!document.location.search)
    return;

  let search = new URLSearchParams(document.location.search);
  for (let option of TEXT_OPTIONS)
    document.getElementById(option).value = search.get(option);
  document.getElementById("incognito").checked = search.get("incognito");
}

function onClick(event) {
  let id = event.target.id;
  if (!TEST_LINKS.includes(id))
    return;

  let elem = document.getElementById(id);
  let search = new URLSearchParams(elem.search);
  for (let option of TEXT_OPTIONS)
    search.set(option, document.getElementById(option).value);
  search.set("incognito", document.getElementById("incognito").checked);

  elem.search = search.toString();
}

window.addEventListener("load", onLoad);
window.addEventListener("click", onClick);
