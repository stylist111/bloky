export default {
  adblock_ui: {
    options_clicked: {
      description: "User clicked the gear icon"
    },
    support_icon_clicked: {
      description: "User clicked the support icon on the header of the Adblock popup"
    },
    opt_out_acceptable_ads_clicked: {
      description: "The user clicked the opt-out link to disable Acceptable Ads on the getadblock.com installed page"
    },
    cm_pause_on_site: {
      description: "User right clicked on the page to open the context menu and selected 'Pause on this site' from the AdBlock section."
    },
    cm_pause_on_all_sites: {
      description: "User right clicked on the page to open the context menu and selected 'Pause on all sites' from the AdBlock section."
    },
    cm_resume_adblock: {
      description: "User right clicked on the page to open the context menu and selected 'Resume blocking ads' from the AdBlock section."
    },
    pause_on_site: {
      description: "User clicked 'Pause on this site' on the Adblock popup"
    },
    resume_adblock: {
      description: "User clicked 'Resume Ad blocking' on the Adblock popup"
    },
    popup_opened: {
      description: "User clicked the AdBlock toolbar icon to open the popup menu",
      data: {
        description: "Data about the popup opened event",
        type: "object",
        properties: {
          isBadgeTextNew: {
            description: "The 'new' badge is shown on the popup icon",
            type: "boolean"
          },
          reason: {
            description: "The reason why the 'new' badge was shown",
            type: "string"
          }
        }
      }
    },
    hide_on_this_page_clicked: {
      description: "User clicked on the three dots in the popup menu, then clicked the 'Hide something on this page' link"
    },
    titletext_clicked: {
      description: "User clicked the AdBlock logo in the popup menu header"
    },
    more_pause_options_clicked: {
      description: "User clicked on the three dots in the popup menu, then clicked 'More pause options' link"
    },
    help_flow_results: {
      description: "Emitted when a user completes the help flow in the popup. The flow presents different options based on the user's issue (e.g., ads not blocked, site broken, etc.), and the emitted event includes the path representing the sequence of choices the user made",
      data: {
        description: "Data about the help flow results",
        type: "object",
        properties: {
          helpFlowPath: {
            description: "The path of the help flow (e.g. 'start,seeAd,seeAdEverywhere,link')",
            type: "string"
          }
        }
      }
    },
    premium_options_clicked: {
      description: "Triggered when a premium user clicks the 'Premium' label in the popup header which is shown next to the Adblock logo. The label is only visible to premium users and opens the Premium tab in the settings page"
    },
    popup_sub_clicked_cookies_premium: {
      description: "Triggered when a premium user clicks the toggle to enable the Premium Cookie Blocking filter list in the popup. The list is not enabled automatically when upgrading to premium"
    },
    popup_sub_clicked_distraction_control: {
      description: "Triggered when a premium user clicks the toggle to enable the Premium Block Distractions filter list in the popup. The list is not enabled automatically when upgrading to premium"
    },
    skip_cookie_walls_learn_more_clicked: {
      description: "A free user clicked the Learn More button on the 'Skip Cookie Walls' section in the AdBlock popup"
    },
    block_distractions_learn_more_clicked: {
      description: "A free user clicked the Learn More button on the 'Block Distractions' section in the AdBlock popup"
    },
    options_page_tab_premium_cta: {
      description: "User interacted with a premium CTA on a premium tab in the options page",
      data: {
        description: "Data about which tab the user was viewing",
        type: "object",
        properties: {
          tab: {
            description: "The name of the tab being viewed when the CTA was clicked",
            type: "string",
            enum: ["premium", "themes", "image_swap", "premium_filters"]
          },
          action: {
            description: "Type of interaction with the Premium CTA",
            type: "string",
            enum: ["clicked"]
          }
        }
      }
    },
    options_page_tab: {
      description: "User clicked or opened a tab on the options page side bar",
      data: {
        description: "Data about the user interaction with the options page tab",
        type: "object",
        properties: {
          tab: {
            description: "The tab that the user interacted with",
            type: "string",
            enum: ["stats", "general", "filter_lists", "customize", "support", "premium", "themes", "image_swap", "premium_filters"]
          },
          action: {
            description: "Type of interaction with the options page tab",
            type: "string",
            enum: ["opened", "clicked"]
          }
        }
      }
    },
    vpn_cta: {
      description: "User interacted with AdBlock VPN promotional banner in the popup menu. This CTA promotes the VPN with 'Introducing AdBlock VPN' message",
      data: {
        description: "Data about the user interaction with the AdBlock VPN promotional banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the AdBlock VPN promotional banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_themes_cta: {
      description: "User interacted with themes customization CTA in the popup menu, opening the themes section in options page",
      data: {
        description: "Information about the theme that was being promoted when clicked",
        type: "object",
        properties: {
          theme: {
            description: "The name of the theme being showcased when the user clicked",
            type: "string",
            enum: ["solarized", "solarized_light", "watermelon", "sunshine", "ocean"]
          },
          action: {
            description: "Type of interaction with the themes customization CTA",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    free_dc_cta: {
      description: "User interacted with Distraction Control promotional banner in the popup menu. This CTA promotes the premium Distraction Control feature with 'Block Floating Videos' message",
      data: {
        description: "Data about the user interaction with the Distraction Control promotional banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Distraction Control promotional banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_dc_cta: {
      description: "Premium user interacted with the enhanced Distraction Control CTA in the popup menu. This CTA highlights 'New Premium feature available!' to promote advanced distraction blocking options",
      data: {
        description: "Data about the user interaction with the Distraction Control CTA",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Distraction Control CTA",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_upsell_cta: {
      description: "User interacted with Premium upsell upgrade banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
      data: {
        description: "Data about the user interaction with the Premium upsell upgrade banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Premium upsell upgrade banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_filter_list_cta: {
      description: "User interacted with Premium filter list banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
      data: {
        description: "Data about the user interaction with the premium filter list CTA",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the premium filter list CTA",
            type: "string",
            enum: ["seen", "clicked"]
          }
        }
      }
    },
    data_collection_opt_out: {
      description: "User opted out of data collection in the options page"
    }
  },
  extensions_ui: {
    acceptable_ads_toggled: {
      description: "User toggled the Acceptable Ads checkbox on the extension options page. This is a shared event fired by both AB and ABP.",
      data: {
        description: "Data about the acceptable ads toggle interaction",
        type: "object",
        properties: {
          action: {
            description: "Whether the user opted in or out of acceptable ads",
            type: "string",
            enum: ["opted_in", "opted_out"]
          },
          source: {
            description: "Where the toggle occurred. This could be from the general or filter lists options tabs.",
            type: "string",
            enum: ["options_general", "options_filter_list"]
          }
        }
      }
    }
  },
  adblockplus_ui: {
    issue_report_submitted: {
      description: "Issue report was submitted"
    }
  },
  smart_allowlisting: {
    allowlisting_expired: {
      description: "An allowlisting filter expired automatically",
      data: {
        description: "Details about the filter at the time of expiration.",
        type: "object",
        properties: {
          allowlistExtendDuration: {
            description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
            type: "number"
          }
        }
      }
    },
    allowlisting_renewed: {
      description: "An allowlisting filter was renewed automatically",
      data: {
        description: "Details about the filter at the time of renewal.",
        type: "object",
        properties: {
          allowlistExtendDuration: {
            description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
            type: "number"
          }
        }
      }
    }
  },
  cdp: {
    built_cdp_payload: {
      description: "A payload has been built with the intention of sending it to CDP. This is debug information, and will temporarily include the eventStats until the CDP server is ready to ingest them.",
      data: {
        description: "Data about the built payload",
        type: "object",
        properties: {
          eventStats: {
            description: "Counts of behavior event logs since the last payload.",
            type: "any"
          },
          uncompressedPayloadSize: {
            description: "Size in bytes of the uncompressed and unencrypted payload.",
            type: "integer"
          }
        }
      }
    }
  },
  detection_snippets: {
    snippet_detection_event: {
      description: "Recorded when a snippet detects a condition on a page (e.g. wall detection). Each detection snippet calls this event from a single location with a unique type value. Other snippet concerns (blocking, breakage) should register separate events. Data is reliable from 2026-04-29 onwards; data before this date may have schema mismatches due to ongoing pipeline development.",
      data: {
        description: "Metadata about the detected condition",
        type: "object",
        properties: {
          type: {
            description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'. Each snippet can have multiple types within a distinct type group for traceability.",
            type: "string"
          },
          domain: {
            description: "Domain where the condition was detected, e.g. 'example.com'",
            type: "string"
          },
          specifier: {
            description: "Optional additional context for filtering in BigQuery, e.g. the CSS selector that matched ('.overlay-wall-container') or a filter list identifier",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  hit_snippets: {
    snippet_hit_event: {
      description: "Recorded when a snippet successfully executes on a page.",
      data: {
        description: "Metadata about the snippet execution",
        type: "object",
        properties: {
          filter: {
            description: "Snippet filter body, e.g. 'json-prune ads userId'",
            type: "string"
          },
          domain: {
            description: "Domain where the snippet fired (document.location.hostname of the frame)",
            type: "string"
          },
          topLevelDomain: {
            description: "Top-level page domain. Equals domain for main-frame snippets; differs for cross-origin iframe snippets.",
            type: "string"
          }
        }
      }
    }
  },
  snippets: {
    context_tampering: {
      description: "Recorded when the website is trying to disable the snippets"
    },
    local_storage_unavailable: {
      description: "The extension intended to use localStorage as a cache, but localStorage was unavailable",
      data: {
        description: "Metadata about the context where localStorage was unavailable",
        type: "object",
        properties: {
          isMainFrame: {
            description: "This occurred in the main frame, not in an iframe",
            type: "boolean"
          }
        }
      }
    },
    zero_delay_cleanup: {
      description: "Recorded when we cleaned up zero-delay storage key from previous extension versions.",
      data: {
        description: "Metadata about the cleanup operation",
        type: "object",
        properties: {
          key: {
            description: "The storage key that was cleaned up",
            type: "string"
          }
        }
      }
    },
    snippet_detection_domainless: {
      description: "Domain omitted intentionally to support user-level retention signals without per-domain identification. Introduced on 2026-04-29; no data exists before this date.",
      data: {
        description: "Metadata about the detected condition",
        type: "object",
        properties: {
          type: {
            description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'.",
            type: "string"
          },
          specifier: {
            description: "Extra context from the detection snippet, e.g. a matched CSS selector or filter rule identifier. null when no specifier is available.",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  youtube: {
    yt_site_navigation: {
      description: "Recorded 5 seconds after a user navigates to a YouTube page. This event is sent only once per session. Refreshing or opening a new tab will start a new session. Navigating through videos without refreshing (aka SPA navigation) will not trigger another event.",
      data: {
        description: "Data about the YouTube navigation event",
        type: "object",
        properties: {
          userLoggedIn: {
            description: "Indicates whether the user is logged in to a YouTube account. '1' for logged in, '0' for not logged in.",
            type: "string",
            enum: ["1", "0"]
          }
        }
      }
    },
    yt_site_ad_shown: {
      description: "Recorded when a video ad on YouTube stops playing, either because it was skipped, the user navigated away, or it finished playing",
      data: {
        description: "Data for the YouTube ad shown event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "Indicates whether the page is allowlisted. '1' for allowlisted, '0' for not allowlisted.",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription. Used to be called 'p' in getadblock.logs_unified.logs_fact",
            type: "boolean"
          },
          adFormat: {
            description: "Format ID of the displayed ad. Used to be called 'category' in getadblock.logs_unified.logs_fact",
            type: "string"
          },
          totalAdDurationMs: {
            description: "Total duration of the ad, in milliseconds. Used to be called 'bc' in getadblock.logs_unified.logs_fact",
            type: "number"
          },
          adShownDurationMs: {
            description: "Actual playback duration of the ad, in milliseconds. Used to be called 'amount' in getadblock.logs_unified.logs_fact",
            type: "number"
          }
        }
      }
    },
    yt_site_ad_wall_detected: {
      description: "Recorded when the YouTube ad wall is detected and the page is not yet allowlisted.",
      data: {
        description: "Data for YouTube ad wall detection when the page is not yet allowlisted",
        type: "object",
        properties: {
          adwallCategory: {
            description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
            type: "string",
            enum: ["soft", "hard"]
          },
          userLoggedIn: {
            description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '0' for this event.",
            type: "string",
            enum: ["1", "0"]
          },
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_site_already_allowlisted: {
      description: "Recorded when the YouTube ad wall is detected, but the page was already allowlisted.",
      data: {
        description: "Data for YouTube ad wall detection when the page is already allowlisted",
        type: "object",
        properties: {
          adwallCategory: {
            description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
            type: "string",
            enum: ["soft", "hard"]
          },
          userLoggedIn: {
            description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '1' for this event.",
            type: "string",
            enum: ["1", "0"]
          },
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_auto_allowlisted: {
      description: "Recorded immediately after the extension automatically allowlists a YouTube page in response to an ad wall.",
      data: {
        description: "Data for the YouTube auto allowlisted event",
        type: "object",
        properties: {
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_site_toast_shown: {
      description: "Recorded when the YouTube 'ad blocker' toast notification appears in the DOM. This is an experiment ran by YouTube that only appears for certain adblocking users, warning them that their adblocker might be causing interruptions.",
      data: {
        description: "Data for the YouTube toast shown event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription",
            type: "boolean"
          }
        }
      }
    },
    yt_site_context_tampering: {
      description: "Recorded when the YouTube error_204 beacon indicates a possible script conflict that could interfere with the extension.",
      data: {
        description: "Data for the YouTube context tampering event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription",
            type: "boolean"
          },
          applicationVersion: {
            description: "YouTube client version from the client.version query param on the error_204 request.",
            type: "string"
          }
        }
      }
    },
    yt_site_yt_error: {
      description: "This event is triggered in the event of an error on YouTube. There could be multiple types of errors happening on the page, so we try to differentiate them via the category parameter.",
      data: {
        description: "Data for the YouTube error event",
        type: "object",
        properties: {
          category: {
            description: "Indicates the error type as defined in our extension code. It can be one of the following: 'uncaught_exception', 'player_error' or 'sww_error'.",
            type: "string",
            enum: ["uncaught_exception", "player_error", "sww_error"]
          },
          applicationVersion: {
            description: "The client version of the YouTube application (e.g., '2.20251020.01.00').",
            type: "string"
          },
          error: {
            description: "Indicates the exception type of JavaScript error, captured by the YouTube error handler (e.g., 'TypeError').",
            type: "string"
          },
          errorMsg: {
            description: "Either the stack trace of the error or an empty string.",
            type: "string"
          },
          isAllowListed: {
            description: "String flag indicating whether the site is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription.",
            type: "boolean"
          }
        }
      }
    }
  },
  conflict_detection: {
    bt_loader_blocked: {
      description: "Recorded on every website when the script from Blockthrough fails to load. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event indicates the script was blocked, which can happen when the user has disabled Acceptable Ads, installed another ad blocker that blocks BTLoader, or allowlisted the page. When BTLoader is blocked, ad recovery cannot occur and monetization is lost.",
      data: {
        description: "Data about why BTLoader was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    bt_loader_success: {
      description: "Recorded on every website when the script from Blockthrough successfully loads. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event confirms that ad recovery can proceed normally on this page.",
      data: {
        description: "Data about the BTLoader success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_bait1_blocked: {
      description: "Acceptable Ads bait 1 was blocked",
      data: {
        description: "Data about why Acceptable Ads bait 1 was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_bait1_success: {
      description: "Acceptable Ads bait 1 was successfully loaded",
      data: {
        description: "Data about the Acceptable Ads bait 1 success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_bait2_blocked: {
      description: "Acceptable Ads bait 2 was blocked",
      data: {
        description: "Data about why Acceptable Ads bait 2 was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_bait2_success: {
      description: "Acceptable Ads bait 2 was successfully loaded",
      data: {
        description: "Data about the Acceptable Ads bait 2 success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_other_blocked: {
      description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were blocked",
      data: {
        description: "Data about why Acceptable Ads filters were blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_other_success: {
      description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were successfully loaded",
      data: {
        description: "Data about the Acceptable Ads filters success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
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
          browserVersion: {
            description: "The version of the browser",
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
          },
          isTrial: {
            description: "Whether the user is on a trial",
            type: "boolean"
          },
          trialDaysLeft: {
            description: "Days left in trial",
            type: ["number", "null"]
          },
          marketingConsent: {
            description: "Whether the user consented to marketing emails",
            type: "boolean"
          },
          dynamicRuleCount: {
            description: "The number of dynamic DNR rules (MV3 only)",
            type: "number"
          },
          staticRuleCount: {
            description: "The number of static DNR rules (MV3 only)",
            type: ["number", "null"]
          },
          filterLists: {
            description: "Hashes of the first 10 active filter list URLs",
            type: "array",
            items: {
              type: "string"
            }
          },
          clientIdStability: {
            description: "Frequency of the most common client ID in the client ID history, as a percentage of all entries. 0 if there isn't enough history yet.",
            type: "number"
          },
          clientIdRotationFrequency: {
            description: "How often the client ID rotates, in days (e.g. 1 for daily, 7 for weekly). 0 if there isn't enough history yet, or no rotation was observed.",
            type: "number"
          }
        }
      }
    }
  },
  dnr_filters: {
    recreated_dnr_rules: {
      description: "On extension upgrade, our DNR filter management module will compare the dynamic DNR rules that the browser has with the filters that we know about. If these do not match, we recreate the DNR rules and log this report.",
      data: {
        description: "Report on the before and after state of the recreation",
        type: "object",
        properties: {
          recreateStats: {
            description: "Stats on how many DNR rules were recreated",
            type: "object",
            properties: {
              recreatedRulesCount: {
                description: "How many DNR rules were recreated",
                type: "integer"
              },
              removedRulesCount: {
                description: "How many existing DNR rules were removed",
                type: "integer"
              }
            }
          },
          checkResultBefore: {
            description: "Results of the data integrity check done before recreating the DNR rules.",
            type: "object",
            properties: {
              valid: {
                description: "True if the data integrity check passed. We only do the recreation if it failed, so this would be expected to always be false.",
                type: "boolean"
              },
              extraRulesInDNRCount: {
                description: "Count of the number of active dynamic DNR rules which we do not expect to see",
                type: "integer"
              },
              missingRulesInDNRCount: {
                description: "Count of the number of rules that our filters expected to exist but didn't",
                type: "integer"
              }
            }
          },
          checkResultAfter: {
            description: "Results of the data integrity check done after recreating the DNR rules.",
            type: "object",
            properties: {
              valid: {
                description: "True if the data integrity check passed. We expect this to be true after the rule recreation has run.",
                type: "boolean"
              },
              extraRulesInDNRCount: {
                description: "Count of the number of active dynamic DNR rules which we do not expect to see. We expect this to be 0 after the rule recreation has run.",
                type: "integer"
              },
              missingRulesInDNRCount: {
                description: "Count of the number of rules that our filters expected to exist but didn't. We expect this to be 0 after the rule recreation has run.",
                type: "integer"
              }
            }
          }
        }
      }
    },
    exceeded_static_rule_count_limit: {
      description: "Debug log when someone runs into the 'set of enabled rulesets exceeds the rule count limit' error when enabling static rulesets",
      data: {
        description: "Data on the current state of static rules and the rulesets being enabled or disabled. Rule counts refer to static DNR rules, bundled in the extension at build time in rulesets.",
        type: "object",
        properties: {
          enableRulesetIds: {
            description: "Ruleset IDs that were to be enabled",
            type: "array",
            items: {
              type: "string"
            }
          },
          enableRuleCount: {
            description: "Static rules that we are trying to enable",
            type: "integer"
          },
          disableRulesetIds: {
            description: "Ruleset IDs that were to be disabled",
            type: "array",
            items: {
              type: "string"
            }
          },
          disableRuleCount: {
            description: "Static rules that we are trying to disable",
            type: "integer"
          },
          currentEnabledRulesetIdsBefore: {
            description: "Currently enabled ruleset IDs, gathered before calling updateEnabledRulesets",
            type: "array",
            items: {
              type: "string"
            }
          },
          currentEnabledRulesetIdsAfter: {
            description: "Currently enabled ruleset IDs, gathered after calling updateEnabledRulesets",
            type: "array",
            items: {
              type: "string"
            }
          },
          currentEnabledRuleCountBefore: {
            description: "Used static rules, gathered before calling updateEnabledRulesets",
            type: "integer"
          },
          currentEnabledRuleCountAfter: {
            description: "Used static rules, gathered after calling updateEnabledRulesets",
            type: "integer"
          },
          availableRuleCountBefore: {
            description: "Available static rules, gathered before calling updateEnabledRulesets",
            type: "integer"
          },
          availableRuleCountAfter: {
            description: "Available static rules, gathered after calling updateEnabledRulesets",
            type: "integer"
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
  startup: {
    startup_error: {
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
          },
          timings: {
            description: "Profiling information about startup performance",
            type: "object",
            properties: {
              marks: {
                type: "array",
                description: "Specific points in time when something happened",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "Milliseconds elapsed since the service worker started",
                      type: "number"
                    }
                  }
                }
              },
              measures: {
                type: "array",
                description: "Measurements of how long steps took",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "When the measure started, in milliseconds elapsed since the service worker started",
                      type: "number"
                    },
                    duration: {
                      description: "Duration that the step took in milliseconds",
                      type: "number"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    subscriptions_reset: {
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
  customer_lifecycle: {
    new_install_normal: {
      description: "The extension was installed from the browser's official web store (Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons)"
    },
    new_install_development: {
      description: "The extension was installed manually in development mode, either as an unpacked directory or from a local .zip/.crx/.xpi package"
    },
    new_install_admin: {
      description: "The extension was installed and managed by an administrator through a policy setting"
    },
    new_install_sideload: {
      description: "The extension was installed by other software on the user's computer"
    },
    new_install_other: {
      description: "The extension was installed through an unrecognized method not covered by other install types(normal/development/admin/sideload)"
    },
    new_install_unknown: {
      description: "The extension was installed but the installation type could not be determined"
    },
    trial_license_expired: {
      description: "The premium trial license has expired"
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
    }
  },
  onpage_dialog_ui: {
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
      description: "The extension injected the dialog into the page and rendered it. This doesn't mean that the dialog is visible to the user, or that it looks as expected",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_display_duration: {
      description: "How long the dialog was visible in MS before it was dismissed",
      data: {
        description: "Information about the dismissal",
        type: "object",
        properties: {
          terminationCause: {
            description: "Termination reason closed: tab_navigated or tab_removed",
            type: "string"
          },
          durationMs: {
            description: "How long the OPD was displayed",
            type: "number"
          },
          ipmId: {
            description: "The ID of the IPM OPD campaign",
            type: "string"
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
  },
  reverse_trial: {
    dialog_shown: {
      description: "The reverse trial dialog was shown to the user",
      data: {
        description: "Details about the dialog shown",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog shown",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_skipped_yt_premium: {
      description: "The reverse trial dialog would have been shown but was skipped because the user has YouTube Premium",
      data: {
        description: "Details about the skipped dialog",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog that was skipped",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_should_still_show_checked: {
      description: "The service worker checked whether a visible reverse trial dialog should still be shown after the tab became active",
      data: {
        description: "Details about the check",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog being checked",
            type: "number"
          },
          shouldStillShow: {
            description: "Whether the dialog should remain visible",
            type: "boolean"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_action: {
      description: "The user interacted with the reverse trial dialog",
      data: {
        description: "Details about the interaction",
        type: "object",
        properties: {
          action: {
            description: "Identifier of the clicked element: the i18n key of a configured ctaButton or link (e.g. 'mid_cta', 'mid_end_trial'), or an uppercase built-in value ('CLOSE' for the x button, 'AUTO_DISMISS' for the auto-dismiss timeout)",
            type: "string"
          },
          touchPointStep: {
            description: "The touch point step number of the dialog that was interacted with",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    config_validation_failed: {
      description: "The remote reverse-trial OPD config failed validation. Fires at load time when the experiment flag is present but the schema is invalid (e.g. missing field, unknown action type, URL not on the allowlist), and at runtime when a NAVIGATE URL fails the allowlist check after template substitution. The full URL is intentionally not logged because template variables may contain PII.",
      data: {
        description: "Details about the validation failure.",
        type: "object",
        properties: {
          reason: {
            description: "Why validation failed. Load-time reasons include 'config_missing' (flag absent despite the user being in a reverse-trial variant), 'trial_duration_days_invalid', 'require_opt_in_invalid', 'steps_invalid', 'step_id_invalid', 'step_title_invalid', 'step_body_invalid', 'step_i18n_en_missing', 'step_i18n_key_missing_in_en', 'navigate_url_missing', 'navigate_url_not_allowlisted', 'action_type_unknown'. Runtime reason is 'url_validation_failed_after_substitution'.",
            type: "string"
          },
          hostname: {
            description: "Hostname of the failing URL for runtime URL validation failures; absent for load-time schema failures.",
            type: "string"
          }
        }
      }
    }
  },
  remote_config: {
    validation_error: {
      description: "The remote config failed validation and was not applied.",
      data: {
        description: "The error messages from the validator.",
        type: "array",
        items: {
          type: "string"
        }
      }
    },
    invalid_condition: {
      description: "The remote config contained conditions referencing facts or operators not recognized by this client version. The config was applied; affected conditions should be skipped at evaluation time.",
      data: {
        description: "The warning messages from the validator for each unrecognized fact or operator.",
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  }
};
