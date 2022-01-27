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

import {EventDispatcher} from "./types.js";

const ALLOWED_DOMAINS = new Set([
  "abpchina.org",
  "abpindo.blogspot.com",
  "abpvn.com",
  "adblock.ee",
  "adblock.gardar.net",
  "adblockplus.me",
  "adblockplus.org",
  "commentcamarche.net",
  "droit-finances.commentcamarche.com",
  "easylist.to",
  "eyeo.com",
  "fanboy.co.nz",
  "filterlists.com",
  "forums.lanik.us",
  "gitee.com",
  "gitee.io",
  "github.com",
  "github.io",
  "gitlab.com",
  "gitlab.io",
  "gurud.ee",
  "hugolescargot.com",
  "i-dont-care-about-cookies.eu",
  "journaldesfemmes.fr",
  "journaldunet.com",
  "linternaute.com",
  "spam404.com",
  "stanev.org",
  "void.gr",
  "xfiles.noads.it",
  "zoso.ro"
]);

let dispatchFunction;

function isDomainAllowed(domain) {
  if (domain.endsWith("."))
    domain = domain.substring(0, domain.length - 1);

  while (true) {
    if (ALLOWED_DOMAINS.has(domain))
      return true;
    let index = domain.indexOf(".");
    if (index == -1)
      return false;
    domain = domain.substr(index + 1);
  }
}

export function subscribeLinksEnabled(url) {
  if (!dispatchFunction)
    return false;

  let {protocol, hostname} = new URL(url);
  return hostname == "localhost" ||
         protocol == "https:" && isDomainAllowed(hostname);
}

export function subscribeLinkClicked(url, title) {
  if (dispatchFunction)
    dispatchFunction({url, title});
}

export let onSubscribeLinkClicked = new EventDispatcher(
  dispatch => {
    dispatchFunction = dispatch;
  },
  () => {
    dispatchFunction = null;
  }
);
