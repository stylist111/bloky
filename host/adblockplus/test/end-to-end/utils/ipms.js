/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2024-present eyeo GmbH
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

/* eslint-disable camelcase */

import { expect } from "expect";

export const expectedIPMCommands = {
  cookie: {
    legacy: {
      test_adblockplus_cookie_legacy: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_cookie_legacy",
        command_name: "create_on_page_dialog",
        timing: "cookie_banner",
        version: 7,
        domain_list: "dw.com,welt.de,example.org",
        sub_title: "OPD cookie title",
        lower_body: "ipmID: test_adblockplus_cookie",
        upper_body: "This is a test cookie baner OPD",
        button_label: "CTA cookie",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update",
        display_duration: 1,
        priority: 100
      }
    },
    future: {
      test_adblockplus_cookie_future: {
        ipm_id: "test_adblockplus_cookie_future",
        command_name: "create_on_page_dialog",
        timing: "cookie_banner",
        version: 7,
        domain_list: "dw.com,welt.de,example.org",
        sub_title: "OPD cookie title",
        lower_body: "ipmID: test_adblockplus_cookie",
        upper_body: "This is a test cookie baner OPD",
        button_label: "CTA cookie",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update",
        display_duration: 1,
        priority: 100
      }
    }
  },
  exclusion: {
    legacy: {
      test_adblockplus_exclusion_legacy: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_exclusion_legacy",
        command_name: "create_on_page_dialog",
        timing: "after_navigation",
        version: 7,
        domain_list: "~example.org",
        sub_title: "OPD exclusion title",
        lower_body: "ipmID: test_adblockplus_exclusion",
        upper_body: "This is a test OPD based on exclusion",
        button_label: "CTA exclusion",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update",
        display_duration: 1
      }
    },
    future: {
      test_adblockplus_exclusion_future: {
        ipm_id: "test_adblockplus_exclusion_future",
        command_name: "create_on_page_dialog",
        timing: "after_navigation",
        version: 7,
        domain_list: "~example.org",
        sub_title: "OPD exclusion title",
        lower_body: "ipmID: test_adblockplus_exclusion",
        upper_body: "This is a test OPD based on exclusion",
        button_label: "CTA exclusion",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update",
        display_duration: 1
      }
    }
  },
  lowPriority: {
    legacy: {
      test_adblockplus_priority_low: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_priority_low",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_low",
        version: 6
      }
    },
    future: {
      test_adblockplus_priority_low: {
        ipm_id: "test_adblockplus_priority_low",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_low",
        version: 6
      }
    }
  },
  navigation: {
    legacy: {
      test_adblockplus_navigation_legacy: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_navigation_legacy",
        command_name: "create_on_page_dialog",
        timing: "after_navigation",
        version: 7,
        domain_list: "google.com,example.net,example.com",
        sub_title: "OPD navigation title",
        lower_body: "ipmID: test_adblockplus_navigation",
        upper_body: "This is a test OPD based on navigation",
        button_label: "CTA navigation",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update?ipmId=test_adblockplus_navigation",
        display_duration: 1
      }
    },
    future: {
      test_adblockplus_navigation_future: {
        ipm_id: "test_adblockplus_navigation_future",
        command_name: "create_on_page_dialog",
        timing: "after_navigation",
        version: 7,
        domain_list: "google.com,example.net,example.com",
        sub_title: "OPD navigation title",
        lower_body: "ipmID: test_adblockplus_navigation",
        upper_body: "This is a test OPD based on navigation",
        button_label: "CTA navigation",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        button_target: "/update?ipmId=test_adblockplus_navigation",
        display_duration: 1
      }
    }
  },
  newtab: {
    legacy: {
      test_adblockplus_newtab: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_newtab",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_newtab",
        version: 6
      }
    },
    future: {
      test_adblockplus_newtab: {
        ipm_id: "test_adblockplus_newtab",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_newtab",
        version: 6
      }
    }
  },
  premium: {
    legacy: {
      test_adblockplus_premium: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_premium",
        command_name: "create_tab",
        method: "default",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update",
        version: 6
      }
    },
    future: {
      test_adblockplus_premium: {
        ipm_id: "test_adblockplus_premium",
        command_name: "create_tab",
        method: "default",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update",
        version: 6
      }
    }
  },
  priority: {
    legacy: {
      test_adblockplus_priority_low: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_priority_low",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_low",
        version: 6
      },
      test_adblockplus_priority_high: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_priority_high",
        command_name: "create_tab",
        method: "default",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_high",
        priority: 3,
        version: 6
      }
    },
    future: {
      test_adblockplus_priority_low: {
        ipm_id: "test_adblockplus_priority_low",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_low",
        version: 6
      },
      test_adblockplus_priority_high: {
        ipm_id: "test_adblockplus_priority_high",
        command_name: "create_tab",
        method: "default",
        license_state_list: "free",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_priority_high",
        priority: 3,
        version: 6
      }
    }
  },
  versions: {
    legacy: {
      test_adblockplus_versions: {
        attributes: {
          language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
          received: expect.any(Number)
        },
        ipm_id: "test_adblockplus_versions",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_versions",
        version: 6
      }
    },
    future: {
      test_adblockplus_versions: {
        ipm_id: "test_adblockplus_versions",
        command_name: "create_tab",
        method: "default",
        expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        url: "/update?ipmId=test_adblockplus_versions",
        version: 6
      }
    }
  }
};
