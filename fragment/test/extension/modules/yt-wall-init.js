/**
 * This file is part of eyeo's Fragment Test Extension,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { start as startYtWallDetection } from "@eyeo-fragments/yt-wall-detection/background";
import * as mocks from "./mocks.js";

export function startYtWallFragment() {
  startYtWallDetection({
    port: mocks.port,
    prefs: mocks.prefs,
    logger: mocks.logger,
    addTrustedMessageTypes: mocks.addTrustedMessageTypes,
    sendAdWallEvents: mocks.sendAdWallEvents,
  });

  return { port: mocks.port };
}
