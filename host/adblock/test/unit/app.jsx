import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, getAllByRole, render, screen, waitFor } from "@testing-library/react";
import * as mockGlobals from "./mocks/globals";

import { App } from "../../adblock-betafish/options/react-components/app";

let app;
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

const renderApp = (propsToSet = {}) => {
  const props = {
    ...defaultProps,
    ...propsToSet,
  };
  const baseApp = <App {...props} />;
  render(baseApp);
  app = screen.getByTestId("options_app");
};

describe("optionsList", () => {
  describe("basic behavior", () => {
    beforeEach(() => {
      renderApp();
    });

    it("renders", () => {
      expect(optionsList).toBeVisible();
    });

    it("renders the general tab list", () => {
      expect(screen.getByTestId("general_options_tab")).toBeVisible();
    });
  });
});
