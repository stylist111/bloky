/* eslint-disable camelcase */
/* global global */
import { vi } from "vitest";

// Starting Prefs values can be updated by tests
global.Prefs = {
  show_statsinicon: true,
  shouldShowBlockElementMenu: true,
  show_devtools_panel: true,
  send_ad_wall_messages: true,
  data_collection_opt_out: false,
};

global.info = { application: "firefox" };

export const globalAbpPrefPropertyNames = [];
export const globalDataCollectionV2 = {
  start: vi.fn(),
  end: vi.fn(),
};
export const globalInfo = global.info;
export const globalPrefs = global.Prefs;
export const globalMABPayment = {};
export const globalSend = vi.fn();
export const globalSettings = {};
export const globalPrefsNotifier = { on: vi.fn(), off: vi.fn() };
export const globalSettingsNotifier = { on: vi.fn(), off: vi.fn() };
export const globalSubscriptionsProxy = {
  add: vi.fn(),
  has: vi.fn(),
  remove: vi.fn(),
  sync: vi.fn(),
  onAdded: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  onRemoved: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};
