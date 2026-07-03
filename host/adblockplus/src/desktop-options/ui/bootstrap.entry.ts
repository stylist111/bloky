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

import "@/assets/styles/globals.css";
import "./unsupported-browser-banner.css";
import * as ewe from "@eyeo/webext-ad-filtering-solution/ui";

import { start as startUi } from "../../../js/pages/desktop-options/index.mjs";
import { start as startGlobals } from "../../globals/front/index";

async function bootstrap(): Promise<void> {
  // Where we start things
  ewe.sentry.start();
  startUi();
  startGlobals();
}

void bootstrap();
