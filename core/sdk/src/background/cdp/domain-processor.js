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

import {domainSuffixes, getBaseDomain, isHttpOrHttps} from "#adblockpluscore/lib/url.js";

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

