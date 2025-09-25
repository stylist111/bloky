/*
 * This file is part of Web Extensions Core Utilities (Web Extensions CU),
 * Copyright (C) 2024-present eyeo GmbH
 *
 * Web Extensions CU is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Web Extensions CU is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Web Extensions CU.  If not, see <http://www.gnu.org/licenses/>.
 */

export default {
  test_none: [],
  test_adblock_versions: [
    {
      ipm_id: "test_adblock_versions",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_versions",
      method: "default",
    },
  ],
  test_adblock_newtab: [
    {
      ipm_id: "test_adblock_newtab",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_newtab",
      method: "default",
    },
  ],
  test_adblock_force: [
    {
      ipm_id: "test_adblock_force",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_force",
      method: "force",
      license_state_list: "premium",
    },
  ],
  test_adblock_navigation_future: [
    {
      ipm_id: "test_adblock_navigation_future",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 7,
      domain_list: "google.com,wikipedia.org,example.com",
      sub_title: "OPD navigation title",
      lower_body: "ipmID: test_adblock_navigation",
      upper_body: "This is a test OPD based on navigation",
      button_label: "CTA navigation",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  ],
  test_adblock_exclusion_future: [
    {
      ipm_id: "test_adblock_exclusion_future",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 7,
      domain_list: "~example.com",
      sub_title: "OPD exclusion title",
      lower_body: "ipmID: test_adblock_exclusion",
      upper_body: "This is a test OPD based on exclusion",
      button_label: "CTA exclusion",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  ],
  test_adblock_cookie_future: [
    {
      ipm_id: "test_adblock_cookie_future",
      command_name: "create_on_page_dialog",
      timing: "cookie_banner",
      version: 7,
      domain_list: "dw.com,welt.de,example.com",
      sub_title: "OPD cookie title",
      lower_body: "ipmID: test_adblock_cookie",
      upper_body: "This is a test cookie baner OPD",
      button_label: "CTA cookie",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
      priority: 100,
    },
  ],
  test_adblock_navigation_legacy: [
    {
      ipm_id: "test_adblock_navigation_legacy",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 7,
      domain_list: "google.com,wikipedia.org,example.com",
      sub_title: "OPD navigation title",
      lower_body: "ipmID: test_adblock_navigation",
      upper_body: "This is a test OPD based on navigation",
      button_label: "CTA navigation",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  ],
  test_adblock_exclusion_legacy: [
    {
      ipm_id: "test_adblock_exclusion_legacy",
      command_name: "create_on_page_dialog",
      timing: "after_navigation",
      version: 7,
      domain_list: "~example.com",
      sub_title: "OPD exclusion title",
      lower_body: "ipmID: test_adblock_exclusion",
      upper_body: "This is a test OPD based on exclusion",
      button_label: "CTA exclusion",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
    },
  ],
  test_adblock_cookie_legacy: [
    {
      ipm_id: "test_adblock_cookie_legacy",
      command_name: "create_on_page_dialog",
      timing: "cookie_banner",
      version: 7,
      domain_list: "dw.com,welt.de,example.com",
      sub_title: "OPD cookie title",
      lower_body: "ipmID: test_adblock_cookie",
      upper_body: "This is a test cookie baner OPD",
      button_label: "CTA cookie",
      license_state_list: "free",
      button_target: "/premium",
      display_duration: 1,
      priority: 100,
    },
  ],
  test_adblock_priority: [
    {
      ipm_id: "test_adblock_priority_low",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_priority_low",
      method: "default",
    },
    {
      ipm_id: "test_adblock_priority_high",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_priority_high",
      method: "default",
      license_state_list: "free",
      priority: 3,
    },
  ],
  test_adblock_premium: [
    {
      ipm_id: "test_adblock_premium",
      command_name: "create_tab",
      version: 6,
      url: "/update",
      method: "default",
      license_state_list: "free",
    },
  ],
  test_adblock_delete: [
    {
      ipm_id: "test_adblock_delete_commands",
      command_name: "delete_commands",
      commands: "__all__",
      version: 2,
    },
  ],
  test_adblockplus_versions: [
    {
      ipm_id: "test_adblockplus_versions",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_versions",
      method: "default",
    },
  ],
  test_adblockplus_newtab: [
    {
      ipm_id: "test_adblockplus_newtab",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_newtab",
      method: "default",
    },
  ],
  test_adblockplus_force: [
    {
      ipm_id: "test_adblockplus_force",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_force",
      method: "force",
      license_state_list: "premium",
    },
  ],
  test_adblockplus_priority: [
    {
      ipm_id: "test_adblockplus_priority_low",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_priority_low",
      method: "default",
    },
    {
      ipm_id: "test_adblockplus_priority_high",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_priority_high",
      method: "default",
      license_state_list: "free",
      priority: 3,
    },
  ],
  test_adblockplus_premium: [
    {
      ipm_id: "test_adblockplus_premium",
      command_name: "create_tab",
      version: 6,
      url: "/update",
      method: "default",
      license_state_list: "free",
    },
  ],
  test_adblockplus_delete: [
    {
      ipm_id: "test_adblockplus_delete_commands",
      command_name: "delete_commands",
      commands: "__all__",
      version: 2,
    },
  ],
  test_adblockplus_navigation_future: [
    {
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
      button_target: "/update?ipmId=test_adblockplus_navigation",
      display_duration: 1,
    },
  ],
  test_adblockplus_exclusion_future: [
    {
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
      button_target: "/update",
      display_duration: 1,
    },
  ],
  test_adblockplus_cookie_future: [
    {
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
      button_target: "/update",
      display_duration: 1,
      priority: 100,
    },
  ],
  test_adblockplus_navigation_legacy: [
    {
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
      button_target: "/update?ipmId=test_adblockplus_navigation",
      display_duration: 1,
    },
  ],
  test_adblockplus_exclusion_legacy: [
    {
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
      button_target: "/update",
      display_duration: 1,
    },
  ],
  test_adblockplus_cookie_legacy: [
    {
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
      button_target: "/update",
      display_duration: 1,
      priority: 100,
    },
  ],
  test_error_unknown_command: [
    {
      ipm_id: "test_error_unknown_command",
      command_name: "unknown_command",
      version: 1,
      url: "/update",
    },
  ],
  test_error_invalid_command: [
    {
      ipm_id: "test_error_invalid_command",
      version: 1,
    },
  ],
  test_error_missing_params: [
    {
      ipm_id: "test_error_missing_params",
      command_name: "create_tab",
      version: 6,
    },
  ],
  test_error_wrong_version: [
    {
      ipm_id: "test_error_wrong_version",
      command_name: "create_on_page_dialog",
      version: 1,
      url: "/update",
    },
  ],
  test_adblock_cohort: [
    {
      ipm_id: "test_adblock_cohort",
      cohort: "test-countrycode",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblock_cohort",
      method: "default",
    },
  ],
  test_adblockplus_cohort: [
    {
      ipm_id: "test_adblockplus_cohort",
      cohort: "test-countrycode",
      command_name: "create_tab",
      version: 6,
      url: "/update?ipmId=test_adblockplus_cohort",
      method: "default",
    },
  ],
};
