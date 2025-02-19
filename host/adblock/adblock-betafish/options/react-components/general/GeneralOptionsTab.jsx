import { useEffect, useState } from "react";
import { translate } from "../shared/utils";
import {
  globalInfo as info,
  globalMABPayment as MABPayment,
  globalPrefs as Prefs,
  globalPrefsNotifier as prefsNotifier,
  globalSettingsNotifier as settingsNotifier,
} from "../shared/globals";
import { OptionsList } from "../shared/OptionsList";
import { getOptionsData, eventsList } from "./data";
import { AcceptableAdsList } from "./AcceptableAdsList";

const useSyncListeners = (setCheckedItems) => {
  useEffect(() => {
    const updateSettingOrPref = (name, newValue) => {
      setCheckedItems((prevCheckedItems) => ({
        ...prevCheckedItems,
        [name]: newValue,
      }));
    };

    settingsNotifier.on("settings.changed", updateSettingOrPref);
    prefsNotifier.on("prefs.changed", updateSettingOrPref);

    return () => {
      settingsNotifier.off("settings.changed", updateSettingOrPref);
      prefsNotifier.off("prefs.changed", updateSettingOrPref);
    };
  }, []);
};

const getCheckedFn = (data) => (name) => {
  const dataOptOutKey = "data_collection_opt_out";
  const dataCollectionSubKeys = ["data_collection_v2", "send_ad_wall_messages", "onpageMessages"];

  if (data[dataOptOutKey] && dataCollectionSubKeys.includes(name)) {
    return false;
  }

  return data[name];
};

export function GeneralOptionsTab({ subs, settings, prefs }) {
  // Change from array to object to match format of settings
  const prefsIntoObject = Object.fromEntries(prefs.map((el) => [el, Prefs[el]]));
  const unifiedSettingsData = { ...settings, ...prefsIntoObject };
  const optionsData = getOptionsData(info.application);

  const [checkedItems, setCheckedItems] = useState(unifiedSettingsData);
  const isChecked = getCheckedFn(checkedItems);

  const updateItem = (name, evt) => {
    MABPayment.displaySyncCTAs(true);
    eventsList[name]({ name, evt }, setCheckedItems);
  };

  useSyncListeners(setCheckedItems);

  return (
    <div data-testid="general_options_tab">
      <h1>{translate("generaloptions2")}</h1>
      <AcceptableAdsList subs={subs} />
      <OptionsList
        className="option-page-content"
        items={optionsData}
        isChecked={isChecked}
        onItemChange={updateItem}
      />
    </div>
  );
}
