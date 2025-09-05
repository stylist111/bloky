export default {
  adblock_popup: {
    options_clicked: {
      description: "User clicked the gear icon"
    }
  },
  conflict_detection: {
    bt_loader_blocked: {
      description: "BTLoader was blocked, possibly indicating a non-partner extension is present",
      data: {
        description: "Browser string indicating the error that occurred",
        type: "string"
      }
    },
    bt_loader_success: {
      description: "BTLoader was successfully loaded"
    },
    aa_bait1_blocked: {
      description: "Acceptable Ads bait 1 was blocked",
      data: {
        description: "Browser string indicating the error that occurred",
        type: "string"
      }
    },
    aa_bait1_success: {
      description: "Acceptable Ads bait 1 was successfully loaded"
    },
    aa_bait2_blocked: {
      description: "Acceptable Ads bait 2 was blocked",
      data: {
        description: "Browser string indicating the error that occurred",
        type: "string"
      }
    },
    aa_bait2_success: {
      description: "Acceptable Ads bait 2 was successfully loaded"
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
  dnr_filters: {
    data_integrity_check_failed: {
      description: "On initialization, our DNR filter management module will compare the dynamic DNR rules that the browser has with the filters that we know about. If these do not match, this warning is emitted.",
      data: {
        description: "Data about the difference between our filters and the DNR dynamic rules",
        type: "object",
        properties: {
          extraRulesInDNR: {
            description: "Count of the number of active dynamic DNR rules which we do not expect to see",
            type: "number"
          },
          missingRulesInDNR: {
            description: "Count of the number of rules that our filters expected to exist but didn't",
            type: "number"
          }
        }
      }
    }
  },
  in_product_messaging: {
    command_received: {
      description: "Extension received a valid IPM command from the remote config",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  initialization: {
    initialization_complete: {
      description: "The extension has finished initializing without any errors",
      data: {
        description: "Data about the initialized system",
        type: "object",
        properties: {
          subscriptionsCount: {
            description: "The number of subscriptions the user has active",
            type: "number"
          }
        }
      }
    },
    adddefaults_complete: {
      description: "Default subscriptions have been added during initialization",
      data: {
        description: "Data about the rules and rulesets before and after adding defaults",
        type: "object",
        properties: {
          beforeRulesets: {
            description: "Array of enabled DNR ruleset IDs before adding defaults",
            type: "array",
            items: {
              type: "string"
            }
          },
          afterRulesets: {
            description: "Array of enabled DNR ruleset IDs after adding defaults",
            type: "array",
            items: {
              type: "string"
            }
          },
          beforeAvailableStaticRuleCount: {
            description: "Number of available static DNR rules before adding defaults",
            type: "number"
          },
          afterAvailableStaticRuleCount: {
            description: "Number of available static DNR rules after adding defaults",
            type: "number"
          },
          beforeSubscriptionCount: {
            description: "Number of enabled subscriptions before adding defaults",
            type: "number"
          },
          afterSubscriptionCount: {
            description: "Number of enabled subscriptions after adding defaults",
            type: "number"
          }
        }
      }
    },
    adddefaults_error: {
      description: "Error occurred while adding default subscriptions during initialization",
      data: {
        description: "Error details and context",
        type: "object",
        properties: {
          error: {
            description: "Error message",
            type: "string"
          },
          stack: {
            description: "Error stack trace",
            type: "string"
          },
          force: {
            description: "Force parameter passed to addDefaults",
            type: "boolean"
          }
        }
      }
    },
    initialization_error: {
      description: "Errors recorded during the initialization of the extension",
      data: {
        description: "Data about the initializion error",
        type: "object",
        properties: {
          errorMsg: {
            description: "The error message that was recorded",
            type: "string"
          },
          hasInternalError: {
            description: "Whether or not the error string matched 'internal error' which indicates that it is a browser error",
            type: "boolean"
          }
        }
      }
    },
    zero_subs_reset: {
      description: "Event logged when subscriptions are reset to defaults due to zero enabled subscriptions",
      data: {
        description: "Debug metadata about the subscription reset",
        type: "object",
        properties: {
          subs: {
            description: "The total number of subscriptions after reset",
            type: "number"
          },
          enabledSubs: {
            description: "The number of enabled subscriptions after reset",
            type: "number"
          },
          enabledRulesets: {
            description: "The number of enabled DNR rulesets after reset",
            type: "number"
          },
          totalUserFilters: {
            description: "The total number of user filters after reset",
            type: "number"
          },
          dynamicRules: {
            description: "The number of dynamic DNR rules after reset",
            type: "number"
          },
          dataCorrupted: {
            description: "Whether the data is corrupted. True if the extension has detected that storage has thrown an error.",
            type: "boolean"
          },
          firstRun: {
            description: "Whether this is the first run of the extension based on the number of subscriptions and user filters.",
            type: "boolean"
          },
          reinitialized: {
            description: "Whether the extension was reinitialized before reset.",
            type: "boolean"
          },
          errorMsg: {
            description: "An error that occurred when readding subscriptions, if any",
            type: ["string", "null"]
          },
          lastErrorMsg: {
            description: "The last error in the browser runtime, if any",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  new_tab: {
    command_ready: {
      description: "'create_tab' IPM command has passed all checks and new tab is going to be created at the next possible opportunity",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    tab_created: {
      description: "A tab has been created for the IPM command",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    tab_loaded: {
      description: "The contents of the tab for the IPM command have been loaded",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  onpage_dialog: {
    command_ready: {
      description: "'create_on_page_dialog' IPM command has passed all checks and on-page dialog is going to be created at the next possible opportunity",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_button_clicked: {
      description: "The user clicked on the button presented on the dialog",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_closed: {
      description: "The user closed the dialog by clicking the close icon in the dialog header",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_ignored: {
      description: "The user did not interact with the dialog while being injected into the page, and the dialog no longer can be interacted with",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_injected: {
      description: "The extension injected the dialog into the page and rendered it. This doesn’t mean that the dialog is visible to the user, or that it looks as expected",
      data: {
        description: "IPM command ID",
        type: "string"
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
