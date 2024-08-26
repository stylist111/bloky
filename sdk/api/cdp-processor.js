
import {domainSuffixes, getBaseDomain,
        matchesWildcards, hasWildcard} from "adblockpluscore/lib/url.js";

/**
 * CDP processor, that keeps a list of supported domains (and their wildcards).
 * Currently used in CDP Phase 1 and 2.
 */
export class OnlySupportedDomainsProcessor {
  constructor() {
    this.restoreConfig();
  }

  restoreConfig() {
    // Array<Array<String(domainWithWildcard)>>, String(siteId)>
    this.setConfig([
      // Amazon
      [["amazon.*"], "amazon.*"],
      // Yahoo
      [["search.yahoo.com"], "search.yahoo.com"], // the order matters: earlier than "yahoo.com" below
      [["yahoo.com"], "yahoo.com"],
      // Expedia
      [["expedia.*"], "expedia.*"],
      [["hotels.*", "hoteles.com"], "hotels.*"]
    ]);
  }

  /**
   * @param {Array} config An array of array(domain, siteId).
   *                       WARNING: the order makes a difference:
   *                       more specific site buckets should come earlier
   *                       (eg. subdomain earlier than it's higher level domain)
   */
  setConfig(config) {
    this.cdpDomains = new Map();

    for (const mapping of config) {
      const domainsList = mapping[0];
      const siteId = mapping[1];
      for (const eachDomain of domainsList) {
        /*
        WARNING: in order to handle more specific site buckets first,
        we need to preserve the original entries order, so we rely on `Map`
        specification (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#objects_vs._maps):
        > Iteration happens in insertion order, which corresponds to the order
        > in which each key-value pair was first inserted into the map
        > by the set() method.
        */
        this.cdpDomains.set(eachDomain, siteId);
      }
    }
  }

  shouldProcess(URL) {
    return this.getSiteId(URL.hostname) != null;
  }

  getSiteId(domain) {
    // prefer exact match over wildcard match
    const suffixes = [...domainSuffixes(domain)];
    for (const [eachDomain, siteId] of this.cdpDomains) {
      if (suffixes.includes(eachDomain)) {
        return siteId;
      }
    }

    // wildcard match
    for (const [domainWildcard, siteId] of this.cdpDomains) {
      // the order of iteration corresponds the order of inserting,
      // we so assume the more specific entries come first in CDP config
      if (hasWildcard(domainWildcard) &&
        matchesWildcards(domain, domainWildcard)) {
        return siteId;
      }
    }

    return null;
  }
}

/**
 * CDP processor, that keeps a list of special domains,
 * that have higher priority, but processes all the domains.
 * It results into subdomain being treated as an independent domain group,
 * not a parent domain group.
 *
 * To be used when migrating to CDP Phase 3.
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
    const protocol = URL.protocol;
    return protocol == "http:" || protocol == "https:";
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

