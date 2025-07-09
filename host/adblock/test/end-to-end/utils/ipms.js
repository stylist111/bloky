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

import { expect } from "expect";

export const expectedIPMCommandsNewtab = {
  test_adblock_newtab: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab",
    device_id: "test_adblock_ipm",
    command_name: "create_tab",
    method: "default",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update",
    version: 6,
  },
};

export const expectedIPMCommandsPriority = {
  test_adblock_newtab_priority_low: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_low",
    device_id: "test_adblock_ipm",
    command_name: "create_tab",
    method: "default",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_low",
    version: 6,
  },
  test_adblock_newtab_priority_high: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_high",
    device_id: "test_adblock_ipm",
    command_name: "create_tab",
    method: "default",
    license_state_list: "free",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_high",
    priority: 3,
    version: 6,
  },
};

export const expectedIPMCommandsLowPriority = {
  test_adblock_newtab_priority_low: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_priority_low",
    device_id: "test_adblock_ipm",
    command_name: "create_tab",
    method: "default",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update?ipmId=test_adblock_newtab_priority_low",
    version: 6,
  },
};

export const expectedIPMCommandsPremium = {
  test_adblock_newtab_premium: {
    attributes: {
      language: expect.stringMatching(/^[a-z]{2,3}-[A-Z]{2}$/),
      received: expect.any(Number),
    },
    ipm_id: "test_adblock_newtab_premium",
    device_id: "test_adblock_ipm",
    command_name: "create_tab",
    method: "default",
    license_state_list: "free",
    expiry: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    url: "/update",
    version: 6,
  },
};
