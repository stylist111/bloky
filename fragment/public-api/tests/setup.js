import { vi } from "vitest";

// Mock the @eyeo/webext-ad-filtering-solution module
vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    add: vi.fn(),
    getAllowingFilters: vi.fn(),
    getMetadata: vi.fn(),
  },
  experiments: {
    getFlags: vi.fn(),
  },
  subscriptions: {
    hasAcceptableAdsEnabled: vi.fn(),
  },
}));
