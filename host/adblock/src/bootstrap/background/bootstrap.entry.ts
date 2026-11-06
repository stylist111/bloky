/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
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

import { start as startSettings } from "~/prefs/background";
import * as logger from "~/utilities/background";
import { start as startTestingEwe } from "../../testing/ewe/background";

/**
 * Runs initialization that can be done in parallel and doesn't have to be done
 * in the first turn of the event loop
 */
async function bootstrapAsync(): Promise<void> {
  try {
    // Bloky: removed cookie-banner detection (it only timed upsell dialogs),
    // remote filter experiments, in-product messaging, server-driven new tabs
    // and on-page dialogs, and telemetry.
    startTestingEwe();
  } catch (ex) {
    logger.reportAndLogError(ex);
  }
}

/**
 * Runs initalization that must be done in the first turn of the event loop
 */
function bootstrapSync(): void {
  // Bloky: no Sentry error reporting, no Premium enrollment and no "New" badge alarm.
}

async function bootstrap(): Promise<void> {
  bootstrapSync();

  startSettings();

  await bootstrapAsync();
}

void bootstrap();
