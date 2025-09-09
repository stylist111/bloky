import { useEffect, useState } from "react";
import { Link } from "@eyeo/ext-ui-components";
import {
  globalMABPayment as MABPayment,
  globalSubscriptionAdapter as SubscriptionAdapter,
  globalSubscriptionsProxy as SubscriptionsProxy,
} from "../shared/globals";
import { translate } from "../shared/utils";
import { OptionsList } from "../shared/OptionsList";
import { aaOptionsData, eventsList } from "./data";

const convertSubs = (subs) => {
  return {
    // If subscribed to acceptable_ads_privacy, then acceptable_ads is not present in subs,
    // but we still need to check the box
    acceptable_ads: Boolean(
      subs.acceptable_ads?.subscribed || subs.acceptable_ads_privacy?.subscribed,
    ),
    acceptable_ads_privacy: Boolean(subs.acceptable_ads_privacy?.subscribed),
  };
};

const isAaUpdate = (items) => {
  return [items].flat().some(({ url }) => url === SubscriptionsProxy.ACCEPTABLE_ADS_URL);
};

const useSubsListeners = (setCheckedItems, setAaTrueOnce) => {
  useEffect(() => {
    const updateSubs = async (items) => {
      const subs = await SubscriptionAdapter.getSubscriptionsMinusText();
      setCheckedItems(convertSubs(subs));
    };

    const addSubs = async (items) => {
      await updateSubs();

      if (isAaUpdate(items)) {
        setAaTrueOnce(true);
      }
    };

    const removeSubs = async () => {
      await updateSubs();
    };

    SubscriptionsProxy.onAdded.addListener(addSubs);
    SubscriptionsProxy.onRemoved.addListener(removeSubs);

    return () => {
      SubscriptionsProxy.onAdded.removeListener(addSubs);
      SubscriptionsProxy.onRemoved.removeListener(removeSubs);
    };
  }, []);
};

const getCheckedFn = (data) => (name) => {
  return data[name];
};

const AcceptableAdsInfo = () => {
  return (
    <div
      className="bg-theme-premium text-theme-text-primary rounded-md px-3 py-6 my-4 transition duration-500 ease-in-out"
      data-testid="acceptable_ads_disable"
    >
      <p className="bold mb-2">{translate("acceptableadsdisable_done")}</p>
      <p className="text-sm">{translate("acceptableadsdisable_how_to_reenable")}</p>
    </div>
  );
};

const DoNotTrackInfo = () => {
  return (
    <div
      className="mb-2 text-base italic pl-16 transition duration-500 ease-in-out"
      data-testid="acceptable_ads_dnt"
    >
      <span className="inline-block mr-1">{translate("enable_do_not_track_advice")}</span>
      <Link href="https://help.getadblock.com/support/solutions/articles/6000224542-using-do-not-track-/">
        <span>{translate("learn_more")}</span>
      </Link>
    </div>
  );
};

export const AcceptableAdsList = ({ subs }) => {
  const acceptableAdsData = convertSubs(subs);

  // Because we do no want to show the AA messaging if AA initially false, but we
  // do want to let the subscriptions listeners affect the setting
  const [aaTrueOnce, setAaTrueOnce] = useState(acceptableAdsData.acceptable_ads);

  const [checkedItems, setCheckedItems] = useState(acceptableAdsData);
  const isChecked = getCheckedFn(checkedItems);

  // DNT is being deprecated for globalPrivacyControl so this checks for both
  // (see: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/DNT)
  const privacyControlEnabled = navigator.doNotTrack === "1" || navigator.globalPrivacyControl;
  const showAcceptableAdsInfo = aaTrueOnce && !checkedItems.acceptable_ads;
  const showAcceptableAdsPrivacyInfo =
    checkedItems.acceptable_ads_privacy && !privacyControlEnabled;

  const updateItem = async (name, evt) => {
    if (name === "acceptable_ads" && evt.target.checked && !aaTrueOnce) {
      setAaTrueOnce(true);
    }
    eventsList[name]({ name, evt }, setCheckedItems);
  };

  useSubsListeners(setCheckedItems, setAaTrueOnce);

  return (
    <div
      className="border-b mb-2 -mt-2.5 border-theme-accent-light"
      data-testid="aa_options_section"
    >
      {showAcceptableAdsInfo && <AcceptableAdsInfo />}
      <OptionsList
        className="option-page-content"
        items={aaOptionsData}
        isChecked={isChecked}
        onItemChange={updateItem}
      />
      {showAcceptableAdsPrivacyInfo && <DoNotTrackInfo />}
    </div>
  );
};
