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

export const defaultFacts = {
  hasPremium: false,
  installDate: new Date("2023-01-01T00:00:00Z").getTime(),
  blockedCount: 12345
};

export const cohort1Config = {
  name: "MAU Top 20 countries, free users, with install date older than 9 days",
  conditions: {
    all: [
      {
        fact: "countryCode",
        operator: "in",
        value: ["US", "DE", "RO"]
      },
      {
        fact: "installDate",
        operator: "olderThan",
        value: 777600000
      },
      {
        fact: "hasPremium",
        operator: "equal",
        value: false
      }
    ]
  },
  event: {
    type: "top20_free_9d"
  }
};

export const cohort2Config = {
  name: "Tier 1 country users",
  conditions: {
    all: [
      {
        fact: "countryCode",
        operator: "in",
        value: [
          "US", "FR", "CA", "GB", "MX", "ES", "DE", "IT", "AU", "TW",
          "JP", "NL", "BE", "SE", "IL", "DK", "CH", "AT", "IE", "NO"
        ]
      }
    ]
  },
  event: {
    type: "tier1"
  }
};

export const cohortsConfig = [
  cohort1Config,
  cohort2Config
];
