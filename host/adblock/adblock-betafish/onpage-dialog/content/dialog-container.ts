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
 * Determines the element the on-page dialog should be appended to
 *
 * `document.body` resolves to the `<frameset>` element on pages that use a
 * frameset instead of a body (e.g. some router admin UIs), which doesn't
 * behave like a normal container, so this falls back to the document element.
 *
 * @returns the element to append the dialog to
 */
export function getDialogContainer(): HTMLElement {
  const { body } = document;
  return body && body.tagName !== "FRAMESET" ? body : document.documentElement;
}
