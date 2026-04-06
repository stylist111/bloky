/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
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

import { type Tabs } from "webextension-polyfill";
import { type DialogContent } from "../shared";
import { type Dialog } from "./dialog.types";
import { Timing } from "./timing.types";

/**
 * Fake `Tabs.Tab` object, with index 0.
 */
export const tab: Tabs.Tab = {
  index: 0,
  highlighted: true,
  active: true,
  pinned: false,
  incognito: false
};

/**
 * Empty dialog content.
 */
export const content: DialogContent = {
  body: [],
  button: "",
  title: ""
};

/**
 * A list of `Dialog`s to run tests with. IDs are the array index.
 */
export const dialogs: Dialog[] = [
  /*
   * Dialogs to test priority, highest priority first. The last two have the same priority.
   */
  {
    behavior: {
      priority: 5,
      displayDuration: 0,
      target: "",
      timing: Timing.afterNavigation
    },
    content,
    id: "0",
    ipmId: "a"
  },
  {
    behavior: {
      priority: 2,
      displayDuration: 0,
      target: "",
      timing: Timing.afterNavigation
    },
    content,
    id: "1",
    ipmId: "b"
  },
  {
    behavior: {
      priority: 2,
      displayDuration: 0,
      target: "",
      timing: Timing.afterNavigation
    },
    content,
    id: "2",
    ipmId: "c"
  },
  {
    behavior: {
      priority: 1,
      displayDuration: 0,
      target: "",
      timing: Timing.afterNavigation
    },
    content,
    id: "3",
    ipmId: "d"
  },
  {
    behavior: {
      priority: 1,
      displayDuration: 0,
      target: "",
      timing: Timing.afterNavigation
    },
    content,
    id: "4",
    ipmId: "d"
  },
  /*
   * Dialog to test `showOnpageDialog()` behavior.
   */
  {
    behavior: {
      displayDuration: 1,
      target: "http://example.com",
      timing: Timing.afterNavigation,
      priority: 1
    },
    content,
    id: "5"
  },
  /**
   * Cookie banner dialogs
   */
  {
    behavior: {
      displayDuration: 1,
      target: "",
      timing: Timing.cookieBanner,
      priority: 1
    },
    content,
    id: "6"
  },
  {
    behavior: {
      displayDuration: 1,
      target: "",
      timing: Timing.cookieBanner,
      priority: 1
    },
    content,
    id: "7"
  },
  /**
   * Cookie banner dialog targeting Premium users
   */
  {
    behavior: {
      displayDuration: 1,
      target: "",
      timing: Timing.cookieBanner,
      priority: 1
    },
    content,
    id: "8"
  }
];
