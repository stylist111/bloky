
import {domainSuffixes, getBaseDomain, isHttpOrHttps} from "adblockpluscore/lib/url.js";

/**
 * CDP processor, that keeps a list of special domains,
 * that have higher priority, but processes all the domains.
 * It results into subdomain being treated as an independent domain group,
 * not a parent domain group.
 */
export class SpecialDomainsProcessor {
  constructor() {
    this.restoreConfig();
  }

  restoreConfig() {
    this.setConfig([
      "search.yahoo.com"
    ]);
  }

  setConfig(config) {
    this.specialDomains = config;
  }

  shouldProcess(URL) {
    // ignore chrome://, about:// etc
    return isHttpOrHttps(URL);
  }

  getSiteId(domain) {
    // special domains has higher priority
    for (const suffix of domainSuffixes(domain)) {
      if (this.specialDomains.includes(suffix)) {
        return suffix;
      }
    }

    return getBaseDomain(domain);
  }
}

