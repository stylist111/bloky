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

import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { port } from "~/core/messaging/background";
import { type Message, isMessage } from "~/core/messaging/shared";
import { type AddFilterMessage } from "./filters.types";

/**
 * Checks whether given candidate is message of type "testing.addFilter"
 *
 * @param candidate - Candidate
 *
 * @returns whether candidate is message of type "testing.addFilter"
 */
function isAddFilterMessage(candidate: unknown): candidate is AddFilterMessage {
  return (
    isMessage(candidate) &&
    "text" in candidate &&
    typeof candidate.text === "string"
  );
}

/**
 * Initializes filter-related testing functionality.
 */
export function start(): void {
  port.on("testing.addFilter", async (message: Message) => {
    if (!isAddFilterMessage(message)) {
      return;
    }

    await ewe.filters.add([message.text]);
  });
}
