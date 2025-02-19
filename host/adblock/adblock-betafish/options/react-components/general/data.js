import {
  toggleAcceptableAds,
  toggleAcceptableAdsPrivacy,
  toggleAdvancedOptions,
  toggleDataCollection,
  toggleDataCollectionOptOut,
  togglePrefs,
  toggleSettings,
  toggleShowContextMenus,
  toggleTwitchAllowlist,
  toggleYoutubeChannelWhitelist,
} from "./events";

export const aaOptionsData = [
  {
    name: "acceptable_ads",
    onChange: toggleAcceptableAds,
    textKey: "acceptableadsoption",
    helpLink:
      "https://helpcenter.getadblock.com/hc/en-us/articles/9738480686483-About-the-Acceptable-Ads-program-and-non-intrusive-ads",
    subOptions: [
      {
        name: "acceptable_ads_privacy",
        onChange: toggleAcceptableAdsPrivacy,
        textKey: "acceptable_ads_privacy",
        helpLink:
          "https://helpcenter.getadblock.com/hc/en-us/articles/9738459986707-About-Acceptable-Ads-and-Third-Party-Tracking",
      },
    ],
  },
];

export const getOptionsData = (application) => [
  {
    name: "youtube_channel_whitelist",
    onChange: toggleYoutubeChannelWhitelist,
    textKey: "allow_whitelisting_youtube_channels2",
    extraInfo: "require_restart_browser",
    subOptions: [
      {
        name: "youtube_manage_subscribed",
        onChange: toggleSettings,
        textKey: "youtube_manage_subscribed",
        helpLink:
          "https://helpcenter.getadblock.com/hc/en-us/articles/9738459986707-About-Acceptable-Ads-and-Third-Party-Tracking",
        additionalInfoLink: {
          textKey: "settings",
          href: "https://www.youtube.com/feed/channels",
        },
      },
    ],
    helpLink:
      "https://helpcenter.getadblock.com/hc/en-us/articles/9738502154131-Can-I-use-AdBlock-and-still-allow-ads-on-my-favorite-YouTube-channels",
  },
  {
    name: "twitch_channel_allowlist",
    onChange: toggleTwitchAllowlist,
    textKey: "allowlisting_twitch_channels",
    extraInfo: "require_restart_browser",
    helpLink:
      "https://helpcenter.getadblock.com/hc/en-us/articles/9738502507283-Does-AdBlock-block-ads-on-Twitch",
  },
  {
    name: "shouldShowBlockElementMenu",
    onChange: toggleShowContextMenus,
    textKey: "showcontextmenus2",
  },
  {
    name: "show_statsinicon",
    onChange: togglePrefs,
    textKey: "show_on_adblock_button",
  },
  {
    name: "display_menu_stats",
    onChange: toggleSettings,
    textKey: "show_on_adblock_menu",
  },
  {
    name: "show_devtools_panel",
    onChange: togglePrefs,
    textKey: "show_devtools_panel",
  },
  {
    name: "data_collection_opt_out",
    disabled: application === "firefox",
    onChange: toggleDataCollectionOptOut,
    textKey: "data_collection_opt_out",
    showSubsParentState: false,
    subOptions: [
      {
        name: "data_collection_v2",
        onChange: toggleDataCollection,
        textKey: "datacollectionoption",
        helpLink:
          "https://helpcenter.getadblock.com/hc/en-us/articles/9738517370259-About-AdBlock-s-opt-in-anonymous-filter-list-usage-and-data-collection",
      },
      {
        name: "send_ad_wall_messages",
        onChange: togglePrefs,
        textKey: "allow_ad_wall_messages",
        helpLink: "https://helpcenter.getadblock.com/hc/en-us/articles/22696374171027/",
      },
      {
        name: "onpageMessages",
        onChange: toggleSettings,
        textKey: "onpage_messages",
      },
    ],
  },
  {
    name: "show_advanced_options",
    onChange: toggleAdvancedOptions,
    textKey: "advanced_options2",
    subOptions: [
      {
        name: "debug_logging",
        onChange: toggleSettings,
        textKey: "debuginlogoption2",
        extraInfo: "slows_down_extension",
      },
    ],
  },
];

const flattenEvents = ({ name, onChange, subOptions }) => {
  let flattenedSubs = [];

  if (subOptions) {
    flattenedSubs = subOptions.flatMap(flattenEvents);
  }

  return [[name, onChange], ...flattenedSubs];
};

export const eventsList = Object.fromEntries(
  [...aaOptionsData, ...getOptionsData()].flatMap(flattenEvents),
);
