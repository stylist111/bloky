export default {
  adblock_popup: {
    options_clicked: {
      description: "User clicked the gear icon"
    }
  },
  cohorts: {
    facts_snapshot: {
      description: "Cohorts facts snapshot used for cohort estimation",
      data: {
        description: "The updated facts",
        type: "object",
        properties: {
          extName: {
            description: "The name of the extension",
            type: "string"
          },
          extVersion: {
            description: "The version of the extension",
            type: "string"
          },
          browserName: {
            description: "The name of the browser",
            type: "string"
          },
          browserLanguage: {
            description: "The language of the browser",
            type: "string"
          },
          countryCode: {
            description: "The 2-letter country code of the user",
            type: "string"
          },
          aaEnabled: {
            description: "Whether Acceptable Ads is enabled",
            type: "boolean"
          },
          installType: {
            description: "The installation type of the extension",
            type: "string"
          },
          hasPremium: {
            description: "Whether the user has a premium subscription",
            type: "boolean"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          blockedCount: {
            description: "The number of blocked requests",
            type: "number"
          }
        }
      }
    }
  },
  test_ewe_background: {
    test_event: {
      description: "TEST: A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "TEST: A logging test event that has no associated data"
    }
  },
  test_ewe_content_api: {
    test_got_experiment_flag: {
      description: "TEST: In the content test script, an experiment was loaded",
      data: {
        description: "Information about the loaded experiment",
        type: "object",
        properties: {
          flagName: {
            description: "The flag name that was loaded",
            type: "string"
          },
          flag: {
            description: "The loaded value",
            type: "any"
          }
        }
      }
    }
  },
  test_ewe_ui_api: {
    test_message_received: {
      description:
        "TEST: A logger test event indicating the UI page received a request to log",
      data: {
        description: "The data sent to the test listener",
        type: "any"
      }
    },
    test_event: {
      description: "TEST: A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "TEST: A logging test event that has no associated data"
    }
  }
};
