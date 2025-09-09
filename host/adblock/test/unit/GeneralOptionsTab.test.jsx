import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  getAllByRole,
  queryByTestId,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { GeneralOptionsTab } from "../../adblock-betafish/options/react-components/general/GeneralOptionsTab";

import { eventsList } from "../../adblock-betafish/options/react-components/general/data";
import {
  toggleAdvancedOptions,
  toggleDataCollection,
  toggleDataCollectionOptOut,
  togglePrefs,
  toggleSettings,
  toggleShowContextMenus,
  toggleTwitchAllowlist,
  toggleYoutubeChannelWhitelist,
} from "../../adblock-betafish/options/react-components/general/events";

import {
  globalMABPayment as MABPayment,
  globalSettingsNotifier as settingsNotifier,
  globalPrefsNotifier as prefsNotifier,
} from "../../adblock-betafish/options/react-components/shared/globals";

vi.mock("../../adblock-betafish/options/react-components/general/events", { spy: true });

let optionsList;
let unmountOptionsList;
const defaultProps = {
  subs: { acceptable_ads: { subscribed: true } },
  settings: {},
  prefs: [
    "show_statsinicon",
    "shouldShowBlockElementMenu",
    "show_devtools_panel",
    "send_ad_wall_messages",
    "data_collection_opt_out",
  ],
};

const renderOptionsList = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };
  const baseList = <GeneralOptionsTab {...props} />;
  const { unmount } = render(baseList);
  optionsList = screen.getByTestId("general_options_tab");
  unmountOptionsList = unmount;
};

describe("optionsList", () => {
  describe("basic behavior", () => {
    beforeEach(() => {
      renderOptionsList();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it("renders", () => {
      expect(optionsList).toBeVisible();
    });

    it("renders the correct page title", () => {
      expect(screen.getByText(/General Options/)).toBeVisible();
    });
  });

  describe("sync event listeners", () => {
    beforeEach(() => {
      renderOptionsList();
    });

    it("adds and removes event listeners for settings", () => {
      expect(settingsNotifier.on).toHaveBeenCalledWith("settings.changed", expect.anything());
      unmountOptionsList();
      expect(settingsNotifier.off).toHaveBeenCalledWith("settings.changed", expect.anything());
    });

    it("adds event listeners for prefs", () => {
      expect(prefsNotifier.on).toHaveBeenCalledWith("prefs.changed", expect.anything());
      unmountOptionsList();
      expect(prefsNotifier.off).toHaveBeenCalledWith("prefs.changed", expect.anything());
    });
  });

  describe("on click actions", () => {
    beforeEach(() => {
      const maximumSelectedSettings = {
        prefs: defaultProps.prefs,
        subs: {
          acceptable_ads_privacy: { subscribed: true },
        },
        settings: {
          debug_logging: true,
          youtube_channel_whitelist: true,
          youtube_manage_subscribed: true,
          show_advanced_options: true,
          display_menu_stats: true,
          onpageMessages: true,
          twitch_channel_allowlist: true,
          data_collection_v2: true,
        },
      };
      renderOptionsList(maximumSelectedSettings);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it.each(Object.entries(eventsList))(
      "%s calls associated function when toggled",
      async (name, fn) => {
        const item = screen.getByTestId(`options_${name}`);
        const checkbox = getAllByRole(item, "checkbox")[0];
        expect(screen.getByTestId(`options_${name}`)).toBeVisible();
        expect(fn).not.toHaveBeenCalled();
        fireEvent.click(checkbox);
        await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
        fireEvent.click(checkbox);
        await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
      },
    );
  });

  describe("data collection options", () => {
    const getDataCollectionSub = () => screen.queryByTestId("options_data_collection_v2");
    const getAdWallSub = () => screen.queryByTestId("options_send_ad_wall_messages");
    const getOnpageMessagesSub = () => screen.queryByTestId("options_onpageMessages");

    it("sub-options are hidden when opt-opt is true", async () => {
      global.Prefs.data_collection_opt_out = true;
      renderOptionsList();
      expect(optionsList).not.toContainElement(getDataCollectionSub());
      expect(optionsList).not.toContainElement(getAdWallSub());
      expect(optionsList).not.toContainElement(getOnpageMessagesSub());
    });

    it("sub-options are in default state when opt-opt is false", () => {
      global.Prefs.data_collection_opt_out = false;
      renderOptionsList();

      expect(optionsList).toContainElement(getDataCollectionSub());
      const dataCheckbox = getAllByRole(getDataCollectionSub(), "checkbox")[0];
      expect(dataCheckbox).to.have.property("checked", false);

      expect(optionsList).toContainElement(getAdWallSub());
      const adWallCheckbox = getAllByRole(getAdWallSub(), "checkbox")[0];
      expect(adWallCheckbox).to.have.property("checked", true);

      expect(optionsList).toContainElement(getOnpageMessagesSub());
      const onPageMessagesCheckbox = getAllByRole(getAdWallSub(), "checkbox")[0];
      expect(onPageMessagesCheckbox).to.have.property("checked", true);
    });

    it("opt-out is true and unclickable on Firefox", () => {
      global.info.application = "firefox";
      renderOptionsList();
      // xPath selectors can be problematic, but in this case, the structure is important and
      // we should know if it changes
      expect(
        optionsList.querySelector('[data-testid="options_data_collection_opt_out"]  > div'),
      ).toHaveClass("cursor-not-allowed");
      expect(
        optionsList.querySelector('[data-testid="options_data_collection_opt_out"]  > div > div'),
      ).toHaveClass("pointer-events-none");
    });

    it("opt-out is clickable on non-Firefox", () => {
      global.info.application = "not-firefox";
      renderOptionsList();
      // xPath selectors can be problematic, but in this case, the structure is important and
      // we should know if it changes
      expect(
        optionsList.querySelector('[data-testid="options_data_collection_opt_out"]  > div'),
      ).not.toHaveClass("cursor-not-allowed");
      expect(
        optionsList.querySelector('[data-testid="options_data_collection_opt_out"]  > div > div'),
      ).not.toHaveClass("pointer-events-none");
    });
  });
});
