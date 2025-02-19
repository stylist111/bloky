import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AcceptableAdsList } from "../../adblock-betafish/options/react-components/general/AcceptableAdsList";

import {
  toggleAcceptableAds,
  toggleAcceptableAdsPrivacy,
} from "../../adblock-betafish/options/react-components/general/events";

import {
  globalMABPayment as MABPayment,
  globalSubscriptionsProxy as SubscriptionsProxy,
} from "../../adblock-betafish/options/react-components/shared/globals";

vi.mock("../../adblock-betafish/options/react-components/general/events", { spy: true });

let aaListComponent;
let unmountaaListComponent;

const defaultProps = {
  subs: {
    acceptable_ads: undefined,
    acceptable_ads_privacy: undefined,
  },
};

const renderAcceptableAdsList = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };
  const baseList = <AcceptableAdsList {...props} />;
  const { unmount } = render(baseList);
  unmountaaListComponent = unmount;
  aaListComponent = screen.getByTestId("aa_options_section");
};

const getAaDisabledMessage = () => {
  return screen.queryByTestId("acceptable_ads_disable");
};

const getDntMessage = () => {
  return screen.queryByTestId("acceptable_ads_dnt");
};

const getAaOption = () => {
  return screen.queryByLabelText(/non-intrusive advertising/);
};

const getPrivacySuboption = () => {
  return screen.queryByLabelText(/Only allow ads without third-party tracking/);
};

describe("AcceptableAdsList", () => {
  describe("basic behavior", () => {
    beforeEach(() => {
      renderAcceptableAdsList();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("renders", () => {
      expect(aaListComponent).toBeVisible();
    });

    it("does not render aa message when false on load", () => {
      expect(aaListComponent).not.toContainElement(getAaDisabledMessage());
    });

    it("calls toggleAcceptableAds on aa change", async () => {
      expect(toggleAcceptableAds).not.toHaveBeenCalled();
      fireEvent.click(getAaOption());
      await waitFor(() => expect(toggleAcceptableAds).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(MABPayment.displaySyncCTAs).toHaveBeenCalledTimes(1));
      fireEvent.click(getAaOption());
      await waitFor(() => expect(toggleAcceptableAds).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(MABPayment.displaySyncCTAs).toHaveBeenCalledTimes(2));
    });

    it("calls toggleAcceptableAdsPrivacy on privacy change", async () => {
      expect(toggleAcceptableAdsPrivacy).not.toHaveBeenCalled();
      fireEvent.click(getAaOption());
      fireEvent.click(getPrivacySuboption());
      await waitFor(() => expect(toggleAcceptableAdsPrivacy).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(MABPayment.displaySyncCTAs).toHaveBeenCalledTimes(2));
      fireEvent.click(getPrivacySuboption());
      await waitFor(() => expect(toggleAcceptableAdsPrivacy).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(MABPayment.displaySyncCTAs).toHaveBeenCalledTimes(3));
    });
  });

  describe("display and activation logic", () => {
    it("does not display privacy suboption when aa unchecked", () => {
      renderAcceptableAdsList();
      expect(aaListComponent).not.toContainElement(getPrivacySuboption());
    });

    it("displays privacy suboption when aa checked", () => {
      renderAcceptableAdsList({ subs: { acceptable_ads: { subscribed: true } } });
      expect(getAaOption()).to.have.property("checked", true);
      expect(getPrivacySuboption()).toBeVisible();
      expect(getPrivacySuboption()).to.have.property("checked", false);
    });

    it("shows both aa and aa privacy option as true when aa sub is populated", () => {
      renderAcceptableAdsList({ subs: { acceptable_ads_privacy: { subscribed: true } } });
      expect(getAaOption()).toBeVisible();
      expect(getAaOption()).to.have.property("checked", true);
      expect(getPrivacySuboption()).toBeVisible();
      expect(getPrivacySuboption()).to.have.property("checked", true);
    });

    it("hides privacy option when parent option is deactivated", () => {
      renderAcceptableAdsList({ subs: { acceptable_ads_privacy: { subscribed: true } } });
      fireEvent.click(getAaOption());
      expect(aaListComponent).not.toContainElement(getPrivacySuboption());
    });
  });

  describe("message display logic", () => {
    it("displays aa message when switched from true to false", () => {
      renderAcceptableAdsList();
      expect(aaListComponent).not.toContainElement(getAaDisabledMessage());
      fireEvent.click(getAaOption());
      expect(getAaOption()).to.have.property("checked", true);
      expect(aaListComponent).not.toContainElement(getAaDisabledMessage());
      fireEvent.click(getAaOption());
      expect(getAaOption()).to.have.property("checked", false);
      expect(getAaDisabledMessage()).toBeVisible();
      fireEvent.click(getAaOption());
      expect(getAaOption()).to.have.property("checked", true);
      expect(aaListComponent).not.toContainElement(getAaDisabledMessage());
    });

    it("displays DNT activation message when privacy activated and DNT not activated", () => {
      global.navigator.doNotTrack = "0";
      global.navigator.globalPrivacyControl = undefined;
      renderAcceptableAdsList({ subs: { acceptable_ads_privacy: { subscribed: true } } });
      expect(getPrivacySuboption()).to.have.property("checked", true);
      expect(aaListComponent).toContainElement(getDntMessage());
    });

    it("displays DNT activation message when privacy activated and globalPrivacyControl not activated", () => {
      global.navigator.doNotTrack = undefined;
      global.navigator.globalPrivacyControl = false;
      renderAcceptableAdsList({ subs: { acceptable_ads_privacy: { subscribed: true } } });
      expect(getPrivacySuboption()).to.have.property("checked", true);
      expect(aaListComponent).toContainElement(getDntMessage());
    });

    it("does not display DNT activation message when privacy activated and DNT already activated", () => {
      global.navigator.doNotTrack = "1";
      renderAcceptableAdsList({ subs: { acceptable_ads_privacy: { subscribed: true } } });
      expect(getPrivacySuboption()).to.have.property("checked", true);
      expect(aaListComponent).not.toContainElement(getDntMessage());
    });
  });

  describe("event listeners", () => {
    beforeEach(() => {
      unmountaaListComponent();
      vi.resetAllMocks();
      renderAcceptableAdsList({ subs: { acceptable_ads: { subscribed: true } } });
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("adds and removes subscriptions onAdded event listeners", () => {
      expect(SubscriptionsProxy.onAdded.addListener).toHaveBeenCalledWith(expect.anything());
      unmountaaListComponent();
      expect(SubscriptionsProxy.onAdded.removeListener).toHaveBeenCalledWith(expect.anything());
    });

    it("adds and removes subscriptions onRemoved event listeners", () => {
      expect(SubscriptionsProxy.onRemoved.addListener).toHaveBeenCalledWith(expect.anything());
      unmountaaListComponent();
      expect(SubscriptionsProxy.onRemoved.removeListener).toHaveBeenCalledWith(expect.anything());
    });
  });
});
