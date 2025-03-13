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

import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { FilterOrigin } from "../shared";
import { Prefs } from "~/alias/prefs";
import ServerMessages from "~/servermessages";
import { reportAndLogError } from "~/utilities/background/logger";

async function isMigrationActive(experimentFlag: string): Promise<boolean> {
  const locales = await ewe.experiments.getFlag(experimentFlag);
  if (!Array.isArray(locales)) {
    return false;
  }

  const migrationDisabledFlag = await ewe.experiments.getFlag("allowlist-migration-disabled");
  if (migrationDisabledFlag) {
    return false;
  }

  const userLocale = browser.i18n.getUILanguage();
  return !locales.includes(userLocale);
}

async function migratePopupAllowlistsToSmartAllowlisting(): Promise<boolean> {
  if (!(await isMigrationActive("allowlist-migration-disabled-locale"))) {
    return false;
  }

  const origins: string[] = [FilterOrigin.popup, FilterOrigin.wizard];
  const minDate = new Date(2020, 10, 11); // 11th November 2020
  const maxDate = new Date(2023, 11, 1); // 1st December 2023

  const filters = await ewe.filters.getUserFilters();
  const documentAllowLists = filters.filter(
    (filter) => filter.type === "allowing" && filter.text.includes("$document"),
  );
  const documentAllowListsWithMetadata = await Promise.all(
    documentAllowLists.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return { ...filter, metadata };
    }),
  );

  const nonSmartAllowlists = documentAllowListsWithMetadata.filter(
    ({ metadata }) => !metadata?.autoExtendMs && !metadata?.expiresAt,
  );

  const allowlistsFromGfc = nonSmartAllowlists.filter(
    ({ metadata }) =>
      metadata?.origin === FilterOrigin.web &&
      metadata?.created &&
      metadata.created >= minDate.getTime() &&
      metadata.created <= maxDate.getTime(),
  );

  const allowlistsToTransition = nonSmartAllowlists.filter(
    ({ metadata }) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      !metadata?.autoExtendMs && !metadata?.expiresAt && origins.includes(metadata?.origin),
  );

  // transition to smart allowlisting
  const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
  await Promise.all(
    allowlistsToTransition.map(async ({ text: filterText, metadata }) => {
      await ewe.filters.setMetadata(filterText, {
        ...metadata,
        autoExtendMs,
        expiresAt: Date.now() + autoExtendMs,
      });
    }),
  );

  ServerMessages.recordGeneralMessage("migrated_popup_allowlists", null, {
    transitionedCount: allowlistsToTransition.length,
    fromGfcCount: allowlistsFromGfc.length,
    allowlistsLeftCount:
      nonSmartAllowlists.length - allowlistsToTransition.length - allowlistsFromGfc.length,
  });

  return true;
}

async function migrateAllAllowlistsToSmartAllowlisting(): Promise<boolean> {
  if (!(await isMigrationActive("all-allowlists-migration-disabled-locale"))) {
    return false;
  }

  const filters = await ewe.filters.getUserFilters();
  const documentAllowLists = filters.filter(
    (filter) => filter.type === "allowing" && filter.text.includes("$document"),
  );
  const documentAllowListsWithMetadata = await Promise.all(
    documentAllowLists.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return { ...filter, metadata };
    }),
  );

  // filter allowlists from with origin == "web"
  const allowlistsFromWeb = documentAllowListsWithMetadata.filter(
    ({ metadata }) => metadata?.origin === FilterOrigin.web,
  );

  // filter allowlists without autoExtendMs and expiresAt and not set from "web"
  const allowlistsToTransition = documentAllowListsWithMetadata.filter(
    ({ metadata }) => !metadata?.autoExtendMs && !metadata?.expiresAt && !metadata?.origin,
  );

  const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
  await Promise.all(
    allowlistsToTransition.map(async ({ text: filterText, metadata }) => {
      await ewe.filters.setMetadata(filterText, {
        ...metadata,
        autoExtendMs,
        expiresAt: Date.now() + autoExtendMs,
      });
    }),
  );

  ServerMessages.recordGeneralMessage("migrated_all_allowlists", null, {
    transitionedCount: allowlistsToTransition.length,
    fromGfcCount: allowlistsFromWeb.length,
    allowlistsLeftCount:
      documentAllowListsWithMetadata.length -
      allowlistsToTransition.length -
      allowlistsFromWeb.length,
  });

  return true;
}

/**
 * Initializes the migration module
 */
export async function start(): Promise<void> {
  await Prefs.untilLoaded;
  const prefsKeyPopupMigration = "migration_popup_to_smart_allowlist_complete";
  const prefsKeyAllMigration = "migration_all_to_smart_allowlist_complete";

  if (!Prefs.get(prefsKeyPopupMigration)) {
    try {
      const migrated = await migratePopupAllowlistsToSmartAllowlisting();
      await Prefs.set(prefsKeyPopupMigration, migrated);
    } catch (error) {
      await Prefs.set(prefsKeyPopupMigration, false);
      reportAndLogError(error, "Failed to migrate allowlists from popup to smart allowlisting");
    }
  }

  if (!Prefs.get(prefsKeyAllMigration)) {
    try {
      const migrated = await migrateAllAllowlistsToSmartAllowlisting();
      await Prefs.set(prefsKeyAllMigration, migrated);
    } catch (error) {
      await Prefs.set(prefsKeyAllMigration, false);
      reportAndLogError(error, "Failed to migrate all allowlists to smart allowlisting");
    }
  }
}
