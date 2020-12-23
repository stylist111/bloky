import {EventDispatcher} from "./events.js";

const ALLOWED_DOMAINS = new Set([
  "abpchina.org",
  "abpindo.blogspot.com",
  "abpvn.com",
  "adblock.ee",
  "adblock.gardar.net",
  "adblockplus.me",
  "adblockplus.org",
  "easylist.to",
  "eyeo.com",
  "fanboy.co.nz",
  "filterlists.com",
  "forums.lanik.us",
  "github.com",
  "github.io",
  "gitlab.com",
  "gitlab.io",
  "gurud.ee",
  "i-dont-care-about-cookies.eu",
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

  let urlObj = new URL(url);
  return urlObj.protocol == "https:" && isDomainAllowed(urlObj.hostname);
}

export function subscribeLinkClicked(url, title)
{
  if (dispatchFunction)
    dispatchFunction({url, title});
}

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
