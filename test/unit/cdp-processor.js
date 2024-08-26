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

import expect from "expect";
import {SpecialDomainsProcessor, OnlySupportedDomainsProcessor}
  from "../../sdk/api/cdp-processor.js";

describe("CDP processors", function() {
  describe("SpecialDomainsProcessor", function() {
    const processor = new SpecialDomainsProcessor();

    it("returns base domain for not special domains", function() {
      processor.setConfig([]);
      expect(processor.getSiteId("domain.com"))
        .toEqual("domain.com");
      expect(processor.getSiteId("subdomain.domain.com"))
        .toEqual("domain.com");
      expect(processor.getSiteId("subdomain.domain.co.uk"))
        .toEqual("domain.co.uk");
    });

    it("groups subdomains with base domain", function() {
      processor.setConfig([]);
      expect(processor.getSiteId("domain.co.uk"))
        .toEqual("domain.co.uk");
      expect(processor.getSiteId("subdomain.domain.co.uk"))
        .toEqual("domain.co.uk");
      expect(processor.getSiteId("subsubdomain.subdomain.domain.co.uk"))
        .toEqual("domain.co.uk");
    });

    it("returns special domain if matches", function() {
      processor.setConfig(["subdomain.domain.com"]);
      expect(processor.getSiteId("subdomain.domain.com"))
        .toEqual("subdomain.domain.com");
    });

    it("counts geo-domains separately", function() {
      processor.setConfig([]);
      expect(processor.getSiteId("domain.com"))
        .toEqual("domain.com");
      expect(processor.getSiteId("domain.co.uk"))
        .toEqual("domain.co.uk");
    });

    it("notifies all domains on HTTP/HTTPS protocol", function() {
      expect(processor.shouldProcess(new URL("http://domain.com"))).toEqual(true);
      expect(processor.shouldProcess(new URL("http://www.domain.com"))).toEqual(true);
    });

    it("does not notify URLs not on HTTP/HTTPS domain", function() {
      expect(processor.shouldProcess(new URL("ftp://domain.com"))).toEqual(false);
      expect(processor.shouldProcess(new URL("some://www.domain.com"))).toEqual(false);
    });

    describe("Specs", function() {
      function assertGroups(domains, expectedSiteId) {
        const p = new SpecialDomainsProcessor();
        let actualSiteIds = new Set();
        for (const domain of domains) {
          actualSiteIds.add(p.getSiteId(domain));
        }
        expect(actualSiteIds.size).toEqual(1);
        if (expectedSiteId) {
          expect((Array.from(actualSiteIds))[0]).toEqual(expectedSiteId);
        }
      }

      function assertDoesNotGroup(domains) {
        const p = new SpecialDomainsProcessor();
        let siteIds = new Set();
        for (const domain of domains) {
          siteIds.add(p.getSiteId(domain));
        }
        expect(siteIds.size).toEqual(domains.length);
      }

      it("groups yahoo.com and domain.yahoo.com", function() {
        assertGroups(["yahoo.com", "domain.yahoo.com"], "yahoo.com");
      });

      it("does not group yahoo.com and yahoo.co.uk", function() {
        assertDoesNotGroup(["yahoo.com", "yahoo.co.uk"]);
      });

      it("does not group search.yahoo.com and yahoo.co.uk", function() {
        assertDoesNotGroup(["search.yahoo.com", "yahoo.co.uk"]);
      });

      it("groups news.search.yahoo.com and search.yahoo.com", function() {
        assertGroups(["news.search.yahoo.com", "search.yahoo.com"], "search.yahoo.com");
      });

      it("uses domain as siteId for unknown domains", function() {
        assertGroups(["domain.com", "cdn.domain.com"], "domain.com");
      });

      it("does not group domain geo-variations", function() {
        assertDoesNotGroup(["domain.com", "domain.co.uk"]);
      });

      it("groups amazon.com and domain.amazon.com", function() {
        assertGroups(["amazon.com", "domain.amazon.com"], "amazon.com");
      });

      it("does not group amazon.com and amazon.co.uk", function() {
        assertDoesNotGroup(["amazon.com", "amazon.co.uk"]);
      });

      it("does not group expedia.com and expedia.co.uk", function() {
        assertDoesNotGroup(["expedia.com", "expedia.co.uk"]);
      });

      it("does not group hotels.com and hoteles.com", function() {
        assertDoesNotGroup(["hotels.com", "hoteles.com"]);
      });
    });
  });

  describe("OnlySupportedDomainsProcessor", function() {
    const processor = new OnlySupportedDomainsProcessor();

    it("returns siteId for supported domain", function() {
      processor.setConfig([[["domain.*"], "siteid.*"]]);
      expect(processor.getSiteId("domain.com"))
        .toEqual("siteid.*");
      expect(processor.getSiteId("domain.co.uk"))
        .toEqual("siteid.*");
    });

    it("returns nothing for unsupported domain", function() {
      processor.setConfig([]);
      expect(processor.getSiteId("domain.com"))
        .toBeNull();
    });

    it("notifies supported domains", function() {
      processor.setConfig([[["domain.*"], "siteid.*"]]);
      expect(processor.shouldProcess(new URL("http://domain.com"))).toEqual(true);
    });

    it("does not notify unsupported domains", function() {
      processor.setConfig([]);
      expect(processor.shouldProcess(new URL("http://domain.com"))).toEqual(false);
    });
  });
});
