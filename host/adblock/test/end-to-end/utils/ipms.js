/* eslint-disable camelcase */
/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2024-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

export const expectedIPMCommands = {
  cohort: {
    test_adblock_cohort: {
      ipm_id: "test_adblock_cohort",
      cohort: "test-countrycode",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_cohort",
      version: 6,
    },
  },
  cookie: {
    test_adblock_cookie: {
      ipm_id: "test_adblock_cookie",
      command_name: "create_on_page_dialog",
      timing: "cookie_banner",
      version: 8,
      domain_list: "dw.com,welt.de,example.com",
      content: {
        en: {
          sub_title: "OPD cookie title",
          lower_body: "ipmID: test_adblock_cookie",
          upper_body: "This is a test cookie baner OPD",
          button_label: "CTA cookie",
        },
      },
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
      priority: 100,
    },
  },
  error_unknown_command: {
    test_error_unknown_command: {
      ipm_id: "test_error_unknown_command",
      command_name: "unknown_command",
      version: 1,
      url: "/update",
    },
  },
  exclusion: {
    test_adblock_exclusion: {
      ipm_id: "test_adblock_exclusion",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 8,
      domain_list: "~example.com",
      content: {
        en: {
          sub_title: "OPD exclusion title",
          lower_body: "ipmID: test_adblock_exclusion",
          upper_body: "This is a test OPD based on exclusion",
          button_label: "CTA exclusion",
        },
      },
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  },
  lowPriority: {
    test_adblock_priority_low: {
      ipm_id: "test_adblock_priority_low",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_priority_low",
      version: 6,
    },
  },
  navigation: {
    test_adblock_navigation: {
      ipm_id: "test_adblock_navigation",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 8,
      domain_list: "google.com,wikipedia.org,example.com",
      content: {
        en: {
          sub_title: "OPD navigation title",
          lower_body: "ipmID: test_adblock_navigation",
          upper_body: "This is a test OPD based on navigation",
          button_label: "CTA navigation",
        },
      },
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  },
  newtab: {
    test_adblock_newtab: {
      ipm_id: "test_adblock_newtab",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_newtab",
      version: 6,
    },
  },
  premium: {
    test_adblock_premium: {
      cohort: "test-free-users",
      ipm_id: "test_adblock_premium",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_premium",
      version: 6,
    },
  },
  priority: {
    test_adblock_priority_low: {
      ipm_id: "test_adblock_priority_low",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_priority_low",
      version: 6,
    },
    test_adblock_priority_high: {
      ipm_id: "test_adblock_priority_high",
      command_name: "create_tab",
      method: "default",
      license_state_list: "free",
      url: "/update?ipmId=test_adblock_priority_high",
      priority: 3,
      version: 6,
    },
  },
  translations: {
    test_adblock_translations: {
      ipm_id: "test_adblock_translations",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 8,
      domain_list: "google.com,wikipedia.org,example.com",
      content: {
        "de-AT": {
          sub_title: "[de-AT] OPD translations title",
          lower_body: "[de-AT] ipmID: test_adblock_translations",
          upper_body: "[de-AT] This is a test translations OPD",
          button_label: "[de-AT] CTA translations",
        },
        de: {
          sub_title: "[de] OPD translations title",
          lower_body: "[de] ipmID: test_adblock_translations",
          upper_body: "[de] This is a test translations OPD",
          button_label: "[de] CTA translations",
        },
        en: {
          sub_title: "[en] OPD translations title",
          lower_body: "[en] ipmID: test_adblock_translations",
          upper_body: "[en] This is a test translations OPD",
          button_label: "[en] CTA translations",
        },
      },
      license_state_list: "free",
      button_target: "/update?ipmId=test_adblock_translations",
      display_duration: 1,
    },
  },
  versions: {
    test_adblock_versions: {
      ipm_id: "test_adblock_versions",
      command_name: "create_tab",
      method: "default",
      url: "/update?ipmId=test_adblock_versions",
      version: 6,
    },
  },
  trialCohort: {
    test_adblock_trial_cohort: {
      ipm_id: "test_adblock_trial_cohort",
      cohort: "test-trial-users",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 8,
      content: {
        en: {
          sub_title: "Trial OPD title",
          lower_body: "ipmID: test_adblock_trial_cohort",
          upper_body: "This is a test OPD for trial users",
          button_label: "CTA trial",
        },
      },
      button_target: "/update?ipmId=test_adblock_trial_cohort",
      display_duration: 1,
    },
  },
};
