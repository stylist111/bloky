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

import * as info from "info";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { start as startSettings } from "~/prefs/background";

async function bootstrap(): Promise<void> {
  void ewe.sentry.start(
    webpackDotenvPlugin.SENTRY_DSN,
    webpackDotenvPlugin.SENTRY_ENVIRONMENT,
    info.addonVersion,
  );

  try {
    // This is where new code should be initialized. This is not just for Sentry.
    startSettings();
  } catch (error) {
    if (!(error instanceof Error)) {
      console.error("Ignored error", error);
      return;
    }

    ewe.sentry.reportError(error);
  }
}

void bootstrap();
