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

import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { port } from "~/core/messaging/background";
import { FilterOrigin } from "../shared";
import { Prefs } from "../../../adblockpluschrome/lib/prefs";

async function isMigrationActive(experimentFlag: string): Promise<boolean> {
  const locales = await ewe.experiments.getFlag(experimentFlag);
  if (!Array.isArray(locales)) {
    return false;
  }

  const migrationDisabledFlag = await ewe.experiments.getFlag(
    "allowlist-migration-disabled"
  );
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

  const filters = await ewe.filters.getUserFilters();
  const documentAllowLists = filters.filter(
    (filter) => filter.type === "allowing" && filter.text.includes("$document")
  );
  const documentAllowListsWithMetadata = await Promise.all(
    documentAllowLists.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return { ...filter, metadata };
    })
  );

  const allowlistsToTransition = documentAllowListsWithMetadata.filter(
    ({ metadata }) =>
      !metadata?.autoExtendMs &&
      !metadata?.expiresAt &&
      metadata?.origin === FilterOrigin.popup
  );

  // transition to smart allowlisting
  const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
  await Promise.all(
    allowlistsToTransition.map(async ({ text: filterText, metadata }) => {
      await ewe.filters.setMetadata(filterText, {
        ...metadata,
        autoExtendMs,
        expiresAt: Date.now() + autoExtendMs
      });
    })
  );

  return true;
}

async function migrateAllAllowlistsToSmartAllowlisting(): Promise<boolean> {
  if (!(await isMigrationActive("all-allowlists-migration-disabled-locale"))) {
    return false;
  }

  const filters = await ewe.filters.getUserFilters();
  const documentAllowLists = filters.filter(
    (filter) => filter.type === "allowing" && filter.text.includes("$document")
  );
  const documentAllowListsWithMetadata = await Promise.all(
    documentAllowLists.map(async (filter) => {
      const metadata = await ewe.filters.getMetadata(filter.text);
      return { ...filter, metadata };
    })
  );

  const allowlistsToTransition = documentAllowListsWithMetadata.filter(
    ({ metadata }) =>
      !metadata?.autoExtendMs && !metadata?.expiresAt && !metadata?.origin
  );

  // transition to smart allowlisting
  const autoExtendMs = Prefs.get("allowlisting_auto_extend_ms");
  await Promise.all(
    allowlistsToTransition.map(async ({ text: filterText, metadata }) => {
      await ewe.filters.setMetadata(filterText, {
        ...metadata,
        autoExtendMs,
        expiresAt: Date.now() + autoExtendMs
      });
    })
  );

  return true;
}

/**
 * Initializes the migration module
 */
export async function start(): Promise<void> {
  port.on("filters.isMigrationActive", async () => {
    const isPopupMigrationActive = await isMigrationActive(
      "allowlist-migration-disabled-locale"
    );
    const isAllMigrationActive = await isMigrationActive(
      "all-allowlists-migration-disabled-locale"
    );
    return isPopupMigrationActive || isAllMigrationActive;
  });

  await Prefs.untilLoaded;
  const prefsKeyPopupMigration = "migration_popup_to_smart_allowlist_complete";
  const prefsKeyAllMigration = "migration_all_to_smart_allowlist_complete";

  if (!Prefs.get(prefsKeyPopupMigration)) {
    try {
      const migrated = await migratePopupAllowlistsToSmartAllowlisting();
      await Prefs.set(prefsKeyPopupMigration, migrated);
    } catch (error) {
      await Prefs.set(prefsKeyPopupMigration, false);
      console.error(
        "Failed to migrate allowlists from popup to smart allowlisting",
        error
      );
    }
  }

  if (!Prefs.get(prefsKeyAllMigration)) {
    try {
      const migrated = await migrateAllAllowlistsToSmartAllowlisting();
      await Prefs.set(prefsKeyAllMigration, migrated);
    } catch (error) {
      await Prefs.set(prefsKeyAllMigration, false);
      console.error(
        "Failed to migrate all allowlists to smart allowlisting",
        error
      );
    }
  }
}
