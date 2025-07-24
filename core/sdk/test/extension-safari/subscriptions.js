import * as EWE from "../../dist/ewe-api.js";

export const EASYLIST_URL = "https://easylist-downloads.adblockplus.org/v3/full/easylist.txt";
export const AA_URL = "https://easylist-downloads.adblockplus.org/v3/full/exceptionrules.txt";
export const TESTPAGES_URL = "https://abptestpages.org/en/abp-testcase-subscription.txt";
export const COOKIE_CONSENT_URL = "https://easylist-downloads.adblockplus.org/v3/full/cookie-filter-list.txt";
export const FANBOY_NOTIFICATIONS_URL = "https://easylist-downloads.adblockplus.org/v3/full/fanboy-notifications.txt";
export const ANTI_CV_URL = "https://easylist-downloads.adblockplus.org/v3/full/abp-filters-anti-cv.txt";

/**
 * Subscriptions list for EWE initialization.
 * NOTE: keep consistent with "Scripts/subscriptions.json" file.
 */
export let subscriptions = [
  // Acceptable Ads
  {
    id: "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
    type: "allowing",
    title: "Allow nonintrusive advertising",
    homepage: "https://acceptableads.com/",
    url: AA_URL,
    mv2_url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
  },
  // Easylist
  {
    id: "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
    type: "ads",
    languages: [
      "en"
    ],
    title: "EasyList",
    homepage: "https://easylist.to/",
    url: EASYLIST_URL,
    mv2_url: "https://easylist-downloads.adblockplus.org/easylist.txt"
  },
  // Cookie consent pop-ups
  {
    id: "588470E8-E163-4CD9-A909-521B2A3BE73F",
    type: "cookies-premium",
    title: "Premium - Block cookie consent pop-ups",
    url: COOKIE_CONSENT_URL,
    mv2_url: "https://easylist-downloads.adblockplus.org/cookie-filter-list.txt"
  },
  // Fanboy notifications (newsletter sign-up blocking filters)
  {
    id: "5BD2BB73-459D-4A74-AF9D-A10157268350",
    type: "notifications",
    title: "Fanboy's Notifications Blocking List",
    homepage: "https://easylist.to/",
    url: FANBOY_NOTIFICATIONS_URL,
    mv2_url: "https://easylist-downloads.adblockplus.org/fanboy-notifications.txt"
  },
  // Anti-circumvention (snippets)
  {
    id: "D4028CDD-3D39-4624-ACC7-8140F4EC3238",
    type: "circumvention",
    title: "ABP filters",
    homepage: "https://gitlab.com/eyeo/anti-cv/abp-filters-anti-cv",
    url: ANTI_CV_URL,
    mv2_url: "https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt"
  }
];

/**
 * Check default subscriptions.
 * This will add the subscriptions if not already added.
 */
export async function checkDefaultSubscriptions() {
  let existingSubsUrls = (await EWE.subscriptions.getSubscriptions())
    .map(sub => sub.url);

  for (let {url} of subscriptions) {
    if (!existingSubsUrls.includes(url)) {
      if (url === ANTI_CV_URL) {
        // snippets require higher privilege level
        await EWE.subscriptions.add(url, {privileged: true});
      }
      else {
        await EWE.subscriptions.add(url);
      }
    }
  }
}
