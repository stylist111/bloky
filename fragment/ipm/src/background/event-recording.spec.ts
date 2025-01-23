/*
 * This file is part of eyeo's In Product Messaging (IPM) fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { CommandName, CommandVersion } from "./command-library.types";
import * as DataCollection from "./data-collection";
import { recordEvent, recordGenericEvent } from "./event-recording";

describe("event-recording", () => {
  describe("recordEvent", () => {
    beforeEach(() => {
      jest.spyOn(DataCollection, "storeEvent").mockImplementation();
    });
    it("should call storeEvent with the correct parameters", async () => {
      const ipmId = "__ipm_id__";
      const command = CommandName.createTab;
      const commandVersion = CommandVersion[command];
      const eventName = "__event_name__";
      recordEvent(ipmId, command, eventName);

      expect(DataCollection.storeEvent).toHaveBeenCalledTimes(1);
      expect(DataCollection.storeEvent).toHaveBeenCalledWith(
        ipmId,
        command,
        commandVersion,
        eventName,
      );
    });
  });
  describe("recordGenericEvent", () => {
    beforeEach(() => {
      jest.spyOn(DataCollection, "storeEvent").mockImplementation();
    });
    it("should call storeEvent with the correct parameters", async () => {
      const eventName = "__event_name__";
      recordGenericEvent(eventName);

      expect(DataCollection.storeEvent).toHaveBeenCalledTimes(1);
      expect(DataCollection.storeEvent).toHaveBeenCalledWith(
        "__no_ipm__",
        "__no_command__",
        0,
        eventName,
      );
    });
  });
});
