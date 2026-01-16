/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import expect from "expect";
import { validateRemoteConfig } from "../src/validator.js";

const COMMAND_ERROR =
  "instance.ipmCommands[0] is not any of <#/definitions/CreateOnpageDialogCommand>,<#/definitions/CreateTabCommand>,<#/definitions/DeleteCommandsCommand>";
const SCHEMA_ID = "1";

function expectErrors(commands, expectedErrors) {
  expectErrorsWithCohorts(commands, [], expectedErrors);
}

function expectErrorsWithCohorts(commands, cohortIds, expectedErrors) {
  const data = {
    schemaId: SCHEMA_ID,
    cohorts: cohortIds.map((cohortId) => {
      return {
        name: cohortId,
        conditions: {
          all: [],
        },
        event: {
          type: cohortId,
        },
      };
    }),
    experiments: [],
  };
  if (commands) {
    data.ipmCommands = commands;
  }
  expect(validateRemoteConfig(data)).toEqual(expectedErrors);
}

function getBaseCommand(commandName) {
  return {
    command_name: commandName,
    ipm_id: "123",
    version: 1,
  };
}

function getCommandContent() {
  return {
    en: {
      button_label: "Button label",
      sub_title: "Subtitle",
      upper_body: "Upper body",
    },
  };
}

function getCreateOnpageDialogCommand() {
  return {
    ...getBaseCommand("create_on_page_dialog"),
    content: getCommandContent(),
    button_target: "https://www.example.com/",
    timing: "after_navigation",
  };
}

function getCreateTabCommand() {
  return {
    ...getBaseCommand("create_tab"),
    url: "https://www.example.com/",
  };
}

function getDeleteCommandsCommand() {
  return {
    ...getBaseCommand("delete_commands"),
    commands: "__all__",
  };
}

describe("In-product messaging commands validation", function () {
  it("marks a missing IPM config as valid", function () {
    expectErrors([], []);
  });

  it("marks a valid command as valid", function () {
    const command = getCreateTabCommand();
    expectErrors([command], []);
  });

  it("allows optional known cohort", function () {
    const command = getCreateTabCommand();
    command.cohort = "foo";
    expectErrorsWithCohorts([command], ["foo"], []);
  });

  it("allows optional content", function () {
    const command = getCreateTabCommand();
    command.content = getCommandContent();
    expectErrors([command], []);
  });

  it("reports unknown cohort", function () {
    const command = getCreateTabCommand();
    command.cohort = "foo";
    expectErrorsWithCohorts(
      [command],
      [],
      ["`ipmCommands[0].cohort` foo cohort does not exist"],
    );
  });

  it("reports missing command name", function () {
    const command = getCreateTabCommand();
    delete command.command_name;
    expectErrors([command], [COMMAND_ERROR]);
  });

  it("reports missing IPM ID", function () {
    const command = getCreateTabCommand();
    delete command.ipm_id;
    expectErrors([command], [COMMAND_ERROR]);
  });

  it("reports missing command version", function () {
    const command = getCreateTabCommand();
    delete command.version;
    expectErrors([command], [COMMAND_ERROR]);
  });

  describe("create_on_page_dialog command", function () {
    it("marks a valid create_on_page_dialog command as valid", function () {
      const command = getCreateOnpageDialogCommand();
      expectErrors([command], []);
    });

    it("allows optional display duration", function () {
      const command = getCreateOnpageDialogCommand();
      command.display_duration = 10;
      expectErrors([command], []);
    });

    it("allows optional domain list", function () {
      const command = getCreateOnpageDialogCommand();
      command.domain_list = "example.com,adblockplus.org";
      expectErrors([command], []);
    });

    it("allows optional license state list", function () {
      const command = getCreateOnpageDialogCommand();
      command.license_state_list = "free,premium";
      expectErrors([command], []);
    });

    it("allows optional lower body", function () {
      const command = getCreateOnpageDialogCommand();
      command.content.en.lower_body = "Lower body";
      expectErrors([command], []);
    });

    it("reports missing button label", function () {
      const command = getCreateOnpageDialogCommand();
      delete command.content.en.button_label;
      expectErrors([command], [COMMAND_ERROR]);
    });

    it("reports missing button target", function () {
      const command = getCreateOnpageDialogCommand();
      delete command.button_target;
      expectErrors([command], [COMMAND_ERROR]);
    });

    it("reports missing subtitle", function () {
      const command = getCreateOnpageDialogCommand();
      delete command.content.en.sub_title;
      expectErrors([command], [COMMAND_ERROR]);
    });

    it("reports missing timing", function () {
      const command = getCreateOnpageDialogCommand();
      delete command.timing;
      expectErrors([command], [COMMAND_ERROR]);
    });

    it("reports missing upper body", function () {
      const command = getCreateOnpageDialogCommand();
      delete command.content.en.upper_body;
      expectErrors([command], [COMMAND_ERROR]);
    });
  });

  describe("create_tab command", function () {
    it("marks a valid create_tab command as valid", function () {
      const command = getCreateTabCommand();
      expectErrors([command], []);
    });

    it("allows optional license state list", function () {
      const command = getCreateTabCommand();
      command.license_state_list = "example.com,adblockplus.org";
      expectErrors([command], []);
    });

    it("allows optional tab creation method", function () {
      const command = getCreateTabCommand();
      command.method = "force";
      expectErrors([command], []);
    });

    it("allows optional priority", function () {
      const command = getCreateTabCommand();
      command.priority = 15;
      expectErrors([command], []);
    });

    it("reports missing URL", function () {
      const command = getCreateTabCommand();
      delete command.url;
      expectErrors([command], [COMMAND_ERROR]);
    });
  });

  describe("delete_commands command", function () {
    it("marks a valid delete_commands command as valid", function () {
      const command = getDeleteCommandsCommand();
      expectErrors([command], []);
    });

    it("reports missing commands to delete", function () {
      const command = getDeleteCommandsCommand();
      delete command.commands;
      expectErrors([command], [COMMAND_ERROR]);
    });
  });
});
