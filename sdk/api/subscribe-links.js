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

import {EventDispatcher} from "./events.js";

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

function isDomainAllowed(domain)
{
  if (domain.endsWith("."))
    domain = domain.substring(0, domain.length - 1);

  while (true)
  {
    if (ALLOWED_DOMAINS.has(domain))
      return true;
    let index = domain.indexOf(".");
    if (index == -1)
      return false;
    domain = domain.substr(index + 1);
  }
}

export function subscribeLinksEnabled(url)
{
  if (!dispatchFunction)
    return false;

  let {protocol, hostname} = new URL(url);
  return hostname == "localhost" ||
         protocol == "https:" && isDomainAllowed(hostname);
}

export function subscribeLinkClicked(url, title)
{
  if (dispatchFunction)
    dispatchFunction({url, title});
}

/**
 * Emitted when a subscribe link is clicked on a web page.
 *
 * A subscribe link has a URL pointing to `https://subscribe.adblockplus.org/`
 * or starting with `abp:subscribe` (deprecated), followed by a query string
 * with a `location` parameter, and optionally a `title` parameter. Subscribe
 * links can only be used on certain trusted domains (including `localhost`).
 * @example
 * <a href="https://subscribe.adblockplus.org?location=http%3A%2F%2Flocalhost%2Flist.txt&title=Example">Example</a>
 * <a href="abp:subscribe?location=location=http%3A%2F%2Flocalhost%2Flist.txt&title=Example">Example (deprecated)</a>
 * @event
 * @type {EventDispatcher.<{url: string, title: string}>}
 */
export let onSubscribeLinkClicked = new EventDispatcher(
  dispatch =>
  {
    dispatchFunction = dispatch;
  },
  () =>
  {
    dispatchFunction = null;
  }
);
