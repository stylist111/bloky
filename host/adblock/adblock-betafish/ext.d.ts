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
/**
 * Global extension utilities
 */
declare namespace ext {
  const pages: Pages;

  interface Pages {
    onLoaded: OnLoadedEvent;
    onRemoved: OnRemovedEvent;
  }

  /**
   * Fired when a tab loading status is complete
   *
   */
  interface OnLoadedEvent {
    /**
     * Registers an event listener <em>callback</em> to the onLoaded event.
     *
     * @param callback Called when an tab is loaded.
     * The parameters of this function depend on the type of event.
     */
    addListener(callback: (tab: browser.Tabs.Tab) => unknown): void;

    /**
     * Removes an event listener <em>callback</em> to an event.
     *
     * @param callback Called when an tab is loaded.
     * The parameters of this function depend on the type of event.
     */
    removeListener(callback: (tab: browser.Tabs.Tab) => void): void;
  }

  /**
   * Fired when a tab is closed
   *
   */
  interface OnRemovedEvent {
    /**
     * Registers an event listener <em>callback</em> to the onRemoved event.
     *
     * @param callback Called when an tab is closed.
     * The parameters of this function depend on the type of event.
     */
    addListener(callback: (tab: browser.Tabs.Tab) => unknown): void;

    /**
     * Removes an event listener <em>callback</em> to an event.
     *
     * @param callback Called when an tab is closed.
     * The parameters of this function depend on the type of event.
     */
    removeListener(callback: (tab: browser.Tabs.Tab) => void): void;
  }

  /**
   * Adds trusted message types for certain origins
   *
   * @param origin - URL origin of sender page
   * @param types - Message types to trust for given origin
   */
  const addTrustedMessageTypes: (origin: string | null, types: string[]) => void;
}
