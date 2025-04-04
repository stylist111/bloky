/* eslint-disable camelcase */
import {
  globalDataCollectionV2 as DataCollectionV2,
  globalPrefs as Prefs,
  globalSend as send,
  globalSubscriptionsProxy as SubscriptionsProxy,
  globalSettings as settings,
} from "../shared/globals";

const evtObjWrapper = (checkedVal) => ({
  target: { checked: checkedVal },
});

const toggleDataCollectionOptPref = function (value, setCheckedItems) {
  DataCollectionV2.end();
  togglePrefs({ name: "send_ad_wall_messages", evt: evtObjWrapper(!value) }, setCheckedItems);
  toggleSettings({ name: "onpageMessages", evt: evtObjWrapper(!value) }, setCheckedItems);
  toggleSettings({ name: "data_collection_v2", evt: evtObjWrapper(false) }, setCheckedItems);
};

export const toggleAcceptableAds = async ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;
  if (isEnabled) {
    setCheckedItems((prevCheckedItems) => ({ ...prevCheckedItems, acceptable_ads: true }));
    await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
  } else {
    setCheckedItems((prevCheckedItems) => ({
      ...prevCheckedItems,
      acceptable_ads: false,
      acceptable_ads_privacy: false,
    }));
    if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_URL)) {
      SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
    }
    if (await SubscriptionsProxy.has(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL)) {
      SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
    }
  }
};

export const toggleAcceptableAdsPrivacy = async ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;
  if (isEnabled) {
    await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
    SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
  } else {
    await SubscriptionsProxy.add(SubscriptionsProxy.ACCEPTABLE_ADS_URL);
    SubscriptionsProxy.remove(SubscriptionsProxy.ACCEPTABLE_ADS_PRIVACY_URL);
  }
  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    acceptable_ads_privacy: isEnabled,
  }));
};

export const toggleAdvancedOptions = ({ evt }, setCheckedItems) => {
  // if off, untoggle all subs
  const isEnabled = evt.target.checked;
  const updates = {
    show_advanced_options: evt.target.checked,
  };

  if (!isEnabled) {
    // untoggle sub-setting as well
    toggleSettings({ name: "debug_logging", evt: evtObjWrapper(false) }, setCheckedItems);
    updates.debug_logging = false;
  }

  toggleSettings({ name: "show_advanced_options", evt }, setCheckedItems);
  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    ...updates,
  }));
};

export const toggleDataCollection = ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;

  if (isEnabled) {
    DataCollectionV2.start();
  } else {
    DataCollectionV2.end();
  }

  toggleSettings({ name: "data_collection_v2", evt }, setCheckedItems);
};

export const toggleDataCollectionOptOut = async ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;

  if (isEnabled) {
    await send("dataCollectionOptOut");
  }

  toggleDataCollectionOptPref(isEnabled, setCheckedItems);
  togglePrefs({ name: "data_collection_opt_out", evt }, setCheckedItems);

  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    data_collection_opt_out: evt.target.checked,
  }));
};

export const togglePrefs = ({ name, evt }, setCheckedItems) => {
  Prefs[name] = evt.target.checked;
  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    [name]: evt.target.checked,
  }));
};

export const toggleSettings = ({ name, evt }, setCheckedItems) => {
  settings[name] = evt.target.checked;
  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    [name]: evt.target.checked,
  }));
};

export const toggleShowContextMenus = ({ evt }, setCheckedItems) => {
  send("updateButtonUIAndContextMenus");
  togglePrefs({ name: "shouldShowBlockElementMenu", evt }, setCheckedItems);

  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    shouldShowBlockElementMenu: evt.target.checked,
  }));
};

export const toggleTwitchAllowlist = ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;

  if (isEnabled) {
    send("addTwitchAllowlistListeners");
  } else {
    send("removeTwitchAllowlistListeners");
  }

  toggleSettings({ name: "twitch_channel_allowlist", evt }, setCheckedItems);
};

export const toggleYoutubeChannelWhitelist = ({ evt }, setCheckedItems) => {
  const isEnabled = evt.target.checked;
  const updates = {
    youtube_channel_whitelist: isEnabled,
  };

  if (isEnabled) {
    send("addYTChannelListeners");
  } else {
    updates.youtube_manage_subscribed = false;
    send("removeYTChannelListeners");
  }

  toggleSettings({ name: "youtube_channel_whitelist", evt }, setCheckedItems);
  setCheckedItems((prevCheckedItems) => ({
    ...prevCheckedItems,
    ...updates,
  }));
};
