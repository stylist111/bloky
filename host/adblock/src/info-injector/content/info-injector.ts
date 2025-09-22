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
import { type InjectionInfo, getInfoCommand } from "../shared";
import { datasetKey, nodeId } from "./info-injector.types";

/**
 * Gets a reference to the document of the page to inject the element into.
 *
 * @returns A reference to the document
 */
function getDocumentReference(): Document {
  return window.document;
}

/**
 * Fetches the info that we want to inject.
 *
 * @returns The info that we want to inject
 */
async function getInfo(): Promise<InjectionInfo> {
  return await browser.runtime.sendMessage({ command: getInfoCommand });
}

/**
 * Creates the info element that we want to inject into the page.
 *
 * @param document The document reference to create the element with
 * @param info The info to add to the element
 * @returns The element containing the info
 */
function createInfoElement(document: Document, info: string): HTMLDivElement {
  const element = document.createElement("div");
  element.id = nodeId;
  element.style.display = "none";
  element.textContent = info;
  return element;
}

/**
 * Injects an element containing info about the extension, and adds a dataset
 * entry with the same info.
 */
async function injectInfo(): Promise<void> {
  const document = getDocumentReference();

  const info = JSON.stringify(await getInfo());
  const element = createInfoElement(document, info);

  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(element);
  });

  // The platform team wants to have this information as soon as possible, so
  // we try to provide the info also before the DOMContentLoaded event. If
  // this shows to be successful, we want to switch over to doing only this,
  // and not injecting a DOM element any longer.
  document.documentElement.dataset[datasetKey] = info;
}

/**
 * Starts the info-injector feature.
 */
function start(): void {
  void injectInfo();
}

start();
