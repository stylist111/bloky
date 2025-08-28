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
import { type SetRemoteConfigUrlMessage } from "./remote-config.types";

/**
 * Checks whether given candidate is message of type "testing.setRemoteConfigUrl"
 *
 * @param candidate - Candidate
 *
 * @returns whether candidate is message of type "testing.setRemoteConfigUrl"
 */
function isSetRemoteConfigUrlMessage(
  candidate: unknown
): candidate is SetRemoteConfigUrlMessage {
  return isMessage(candidate) && "url" in candidate;
}

/**
 * Initializes remote configuration testing functionality
 */
export function start(): void {
  port.on("testing.setRemoteConfigUrl", (message: Message) => {
    if (!isSetRemoteConfigUrlMessage(message)) {
      return;
    }

    ewe.remoteConfig.setUrl(message.url);
  });
  port.on("testing.syncRemoteConfig", async () => {
    await ewe.remoteConfig.sync();
  });
}
