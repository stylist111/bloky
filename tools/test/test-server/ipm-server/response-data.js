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

import * as supportedIds from "./user-ids.js";
import { getMultipleOPDCommands } from "./utils.js";

/**
 * Data that will be sent as response from the server
 *
 * @typedef {Object} ResponseData
 * @property {number} statusCode - The server response status code
 * @property {string | undefined} body - The server response body
 */

/**
 * Gets the server response data for a specific user Id
 *
 * @param {string} userId - Server user identifier
 * @param {boolean} singleObjectMode
 *        Should the server respond with legacy single command object or not
 * @returns {ResponseData}
 */
export function getResponseData(userId, singleObjectMode = false) {
  let statusCode;
  let bodyData;

  switch (userId) {
    /* ABP */
    case supportedIds.ABP_DELETE_COMMANDS:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "deletecommandsABP_1",
          device_id: "deletecommandsABP",
          command_name: "delete_commands",
          // replace the following value with a string of comma-separated IPM IDs
          // to delete specific IPM commands in the extension,
          // or use the `"__all__"` value to delete all IPM commands
          commands: "__all__",
          version: 1,
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_OPD_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationfreeuserABP_1",
          device_id: "opdnavigationfreeuserABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationfreeuserABP",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          license_state_list: "free",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_OPD_NAVIGATION_SUBDOMAIN:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationsubdomainABP_1",
          device_id: "opdnavigationsubdomainABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationsubdomainABP",
          upper_body:
            "Should only be shown to FREE users, button target is https://new.adblockplus.org/, CTA button should be clicked",
          button_label: "CTA CLICK ME",
          button_target: "https://new.adblockplus.org",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_CTA_OPD_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationctaABP_1",
          device_id: "opdnavigationctaABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationctaABP",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
          button_label: "CTA CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_DUPLICATE_OPD_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationduplicateABP_1",
          device_id: "opdnavigationduplicateABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationduplicateABP",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_TRIGGERS_OPD_NAVIGATION_CLICKED:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationclickedtriggerABP_1",
          device_id: "opdnavigationclickedtriggerABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationclickedtriggerABP",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
          button_label: "CTA CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_TRIGGERS_OPD_NAVIGATION_IGNORED:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationignoredtriggerABP_1",
          device_id: "opdnavigationignoredtriggerABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationignoredtriggerABP",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA should be ignored",
          button_label: "CTA DO NOT CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_PREMIUM_USER_NAVIGATION_FREE:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationfreepremiumuserABP_1",
          device_id: "opdnavigationfreepremiumuserABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationfreepremiumuserABP",
          upper_body: "Should only be shown to FREE users, button target it /premium",
          button_label: "CTA button",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_OPD_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationpremiumfreeuserABP_1",
          device_id: "opdnavigationpremiumfreeuserABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationpremiumfreeuserABP",
          upper_body: "Should only be shown to PREMIUM users, button target it /premium",
          button_label: "CTA button",
          button_target: "/premium",
          license_state_list: "premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_MULTIPLE_CAMPAIGNS_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdmultiplenavigationABP_1",
          device_id: "opdmultiplenavigationABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdmultiplenavigationABP",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_OPD_EXCLUSION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationexclusionfreeuserABP_1",
          device_id: "opdnavigationexclusionfreeuserABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "~google.com,~wikipedia.org,~example.com",
          sub_title:
            "OPD was created after navigation to any site THAT IS NOT: google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationexclusionABP",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.ABP_MULTIPLE_CAMPAIGNS_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdmultiplenewtabABP_1",
          device_id: "opdmultiplenewtabABP",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.ABP_PREMIUM_USER_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumuserABP_1",
          device_id: "newtabpremiumuserABP",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.ABP_TRIGGERS_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabtriggerABP_1",
          device_id: "newtabtriggerABP",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_NEWTAB_FORCE:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabforcefreeuserABP_1",
          device_id: "newtabforcefreeuserABP",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "force",
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabfreefreeuserABP_1",
          device_id: "newtabfreeABP",
          command_name: "create_tab",
          license_state_list: "free",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.ABP_NEWTAB_SUBDOMAIN:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabsubdomainABP_1",
          device_id: "newtabsubdomainABP",
          command_name: "create_tab",
          license_state_list: "free",
          version: 4,
          url: "https://new.adblockplus.org",
        },
      ];
      break;
    case supportedIds.ABP_PREMIUM_USER_NEWTAB_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumpremiumuserABP_1",
          device_id: "newtabpremiumpremiumuserABP",
          command_name: "create_tab",
          license_state_list: "premium",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.ABP_FREE_USER_NEWTAB_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumfreeuserABP_1",
          device_id: "newtabpremiumfreeuserABP",
          command_name: "create_tab",
          license_state_list: "premium",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.ABP_MULTIPLE_COMMANDS:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "multiplecommandsopdABP_1",
          device_id: "multiplecommandsABP",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: multiplecommandsABP",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          license_state_list: "free",
          button_target: "/premium",
          display_duration: 1,
        },
        {
          ipm_id: "multiplecommandsnewtabABP_1",
          device_id: "multiplecommandsABP",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];

      /* ADBLOCK */
      break;
    case supportedIds.AB_DELETE_COMMANDS:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "deletecommandsAB_1",
          device_id: "deletecommandsAB",
          command_name: "delete_commands",
          // replace the following value with a string of comma-separated IPM IDs
          // to delete specific IPM commands in the extension,
          // or use the `"__all__"` value to delete all IPM commands
          commands: "__all__",
          version: 1,
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_OPD_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationfreeuserAB_1",
          device_id: "opdnavigationfreeuserAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationfreeuserAB",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          license_state_list: "free",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_OPD_NAVIGATION_SUBDOMAIN:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationsubdomainAB_1",
          device_id: "opdnavigationsubdomainAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationsubdomainAB",
          upper_body:
            "Should only be shown to FREE users, button target is https://vpn.getadblock.com",
          button_label: "CTA button",
          license_state_list: "free",
          button_target: "https://vpn.getadblock.com",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_OPD_EXCLUSION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationexclusionfreeuserAB_1",
          device_id: "opdnavigationexclusionfreeuserAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "~google.com,~wikipedia.org,~example.com",
          sub_title:
            "OPD was created after navigation to any site THAT IS NOT: google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationexclusionAB",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_OPD_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationpremiumfreeuserAB_1",
          device_id: "opdnavigationpremiumfreeuserAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationpremiumfreeuserAB",
          upper_body: "Should only be shown to PREMIUM users, button target it /premium",
          button_label: "CTA button",
          button_target: "/premium",
          license_state_list: "premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_OPD_NAVIGATION_CTA:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationctaAB_1",
          device_id: "opdnavigationctaAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationctaAB",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
          button_label: "CTA CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_DUPLICATE_OPD_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationduplicateAB_1",
          device_id: "opdnavigationduplicateAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationduplicateAB",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_MULTIPLE_CAMPAIGNS_NAVIGATION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdmultiplenavigationAB_1",
          device_id: "opdmultiplenavigationAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdmultiplenavigationAB",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          button_target: "/premium",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_TRIGGERS_OPD_NAVIGATION_CLICKED:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationclickedtriggerAB_1",
          device_id: "opdnavigationclickedtriggerAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationclickedtriggerAB",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA button should be clicked",
          button_label: "CTA CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_TRIGGERS_OPD_NAVIGATION_IGNORED:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationignoredtriggerAB_1",
          device_id: "opdnavigationignoredtriggerAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationignoredtriggerAB",
          upper_body:
            "Should only be shown to FREE users, button target is /premium, CTA should be ignored",
          button_label: "CTA DO NOT CLICK ME",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_PREMIUM_USER_NAVIGATION_FREE:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdnavigationfreepremiumuserAB_1",
          device_id: "opdnavigationfreepremiumuserAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: opdnavigationfreepremiumuserAB",
          upper_body: "Should only be shown to FREE users, button target it /premium",
          button_label: "CTA button",
          button_target: "/premium",
          license_state_list: "free",
          display_duration: 1,
        },
      ];
      break;
    case supportedIds.AB_MULTIPLE_CAMPAIGNS_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "opdmultiplenewtabAB_1",
          device_id: "opdmultiplenewtabAB",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.AB_TRIGGERS_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabtriggerAB_1",
          device_id: "newtabtriggerAB",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_NEWTAB_FORCE:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabforcefreeuserAB_1",
          device_id: "newtabforcefreeuserAB",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "force",
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabfreefreeuserAB_1",
          device_id: "newtabfreeAB",
          command_name: "create_tab",
          license_state_list: "free",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.AB_NEWTAB_SUBDOMAIN:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabsubdomainAB_1",
          device_id: "newtabsubdomainAB",
          command_name: "create_tab",
          license_state_list: "free",
          version: 4,
          url: "https://vpn.getadblock.com",
        },
      ];
      break;
    case supportedIds.AB_FREE_USER_NEWTAB_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumfreeuserAB_1",
          device_id: "newtabpremiumfreeuserAB",
          command_name: "create_tab",
          license_state_list: "premium",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.AB_PREMIUM_USER_NEWTAB:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumuserAB_1",
          device_id: "newtabpremiumuserAB",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      break;
    case supportedIds.AB_PREMIUM_USER_NEWTAB_PREMIUM:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "newtabpremiumpremiumuserAB_1",
          device_id: "newtabpremiumpremiumuserAB",
          command_name: "create_tab",
          license_state_list: "premium",
          version: 4,
          url: "/update",
        },
      ];
      break;
    case supportedIds.AB_MULTIPLE_COMMANDS:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "multiplecommandsopdAB_1",
          device_id: "multiplecommandsAB",
          command_name: "create_on_page_dialog",
          timing: "after_navigation",
          version: 4,
          domain_list: "google.com,wikipedia.org,example.com",
          sub_title: "OPD was created after navigation to google.com, example.com, wikipedia.org",
          lower_body: "deviceID: multiplecommandsAB",
          upper_body: "Should only be shown to FREE users, button target is /premium",
          button_label: "CTA button",
          license_state_list: "free",
          button_target: "/premium",
          display_duration: 1,
        },
        {
          ipm_id: "multiplecommandsnewtabAB_1",
          device_id: "multiplecommandsAB",
          command_name: "create_tab",
          version: 4,
          url: "/update",
          method: "default",
        },
      ];
      /* ERRORS */
      break;
    case supportedIds.UNKNOWN_COMMAND:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "unknowncommand_1",
          device_id: "unknowncommand",
          command_name: "unknown_command",
          version: 1,
          url: "/update",
        },
      ];
      break;
    case supportedIds.MISSING_PARAMETER:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "missingparameter_1",
          device_id: "missingparameter",
          command_name: "create_tab",
          version: 4,
        },
      ];
      break;
    case supportedIds.WRONG_VERSION:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "wrongversion_1",
          device_id: "wrongversion",
          command_name: "create_on_page_dialog",
          version: 1,
          url: "/update",
        },
      ];
      break;
    case supportedIds.INVALID_COMMAND:
      statusCode = 200;
      bodyData = [
        {
          ipm_id: "invalidcommand_1",
          device_id: "invalidcommand",
          version: 1,
        },
      ];
      break;
    case supportedIds.TOO_MANY_COMMANDS:
      statusCode = 200;
      // the extensions are currently limited to receive at maximum 100 commands
      bodyData = getMultipleOPDCommands(100 + 1, supportedIds.TOO_MANY_COMMANDS);
      break;
    case supportedIds.NO_CAMPAIGN:
      statusCode = 200;
      bodyData = undefined;
      break;
    default:
      statusCode = 401;
      bodyData = [
        {
          message: "unknown device ID",
        },
      ];
  }

  // providing legacy command server response as a single object
  if (singleObjectMode && Array.isArray(bodyData)) {
    if (bodyData.length > 1) {
      // multiple command response is not compatible in legacy mode
      statusCode = 401;
      bodyData = {
        message: "unknown device ID",
      };
    } else {
      bodyData = bodyData[0];
    }
  }

  const body = JSON.stringify(bodyData);

  return { statusCode, body };
}
