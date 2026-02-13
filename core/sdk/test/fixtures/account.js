import {TEST_ADMIN_PAGES_URL} from "@eyeo/test-utils/sdk-urls";

const PRODUCT_PREFIX = "ewe-test"; // This is a mock product prefix for testing purposes
const HEADERS = {
  X_APPLICATION_NAME: "X-Application-Name",
  X_ACCESS_TOKEN: "X-Access-Token",
  X_REFRESH_TOKEN: "X-Refresh-Token",
  X_APPLICATION_ID: "X-Application-ID",
  AUTHORIZATION: "Authorization"
};
export const FEATURES = {
  PREMIUM: `${PRODUCT_PREFIX}_premium`
};

const PORTAL_NAME = `${PRODUCT_PREFIX}-portal`;

export const PREMIUM_USER_PROFILE = {
  user: {
    email: "ewe-test@functional.com",
    displayName: "Test User",
    features: [FEATURES.PREMIUM],
    subscription: {
      isTrial: false,
      trialDaysLeft: 0,
      trialEndDate: null
    },
    preferences: {
      marketingEmail: true
    }
  }
};

export const STORED_PREMIUM_USER_PROFILE = {
  ...PREMIUM_USER_PROFILE.user,
  hasPremium: true
};

export const PREMIUM_USER_WITH_TRIAL_PROFILE = {
  user: {
    email: "ewe-test@functional.com",
    displayName: "Test User",
    features: [FEATURES.PREMIUM],
    subscription: {
      isTrial: true,
      trialDaysLeft: 15,
      trialEndDate: "2024-12-31T23:59:59Z"
    },
    preferences: {
      marketingEmail: false
    }
  }
};

export const FREE_USER_PROFILE = {
  user: {
    email: "ewe-test@functional.com",
    displayName: "Test User",
    features: ["VPN"],
    subscription: {
      isTrial: false,
      trialDaysLeft: 0,
      trialEndDate: null
    },
    preferences: {
      marketingEmail: false
    }
  }
};

export const REFRESH_TOKEN_INVALID_ERROR = {
  message: "Request cannot be processed",
  code: "BUSINESS_ERROR",
  details: {
    message: "Invalid refresh token"
  }
};

export const INTERNAL_SERVER_ERROR = {
  message: "Internal server error",
  code: "SERVER_ERROR",
  details: {
    message: "Something went wrong on the server"
  }
};

export const STORED_PREMIUM_USER_WITH_TRIAL_PROFILE = {
  ...PREMIUM_USER_WITH_TRIAL_PROFILE.user,
  hasPremium: true
};

export const STORED_FREE_USER_PROFILE = {
  ...FREE_USER_PROFILE.user,
  hasPremium: false
};

export const ACCOUNT_PATHS = {
  PROFILE: "/accounts/profile",
  REFRESH_TOKENS: "/accounts/token/refresh",
  LICENSE_LOGIN: `/accounts/migration/login-${PRODUCT_PREFIX}`,
  EXT_LOGIN: "/accounts/api/auth/ext-login"
};

export const DEFAULT_LOGIN_PATTERN = `${TEST_ADMIN_PAGES_URL}${ACCOUNT_PATHS.EXT_LOGIN}*`;

export const PROFILE_SYNC_URL = `${TEST_ADMIN_PAGES_URL}${ACCOUNT_PATHS.PROFILE}`;

export const ACCOUNT_ROUTES = [
  {
    url: ACCOUNT_PATHS.EXT_LOGIN,
    method: "POST",
    response: JSON.stringify({}),
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Application-ID",
      "Content-Type": "application/json",
      [HEADERS.X_APPLICATION_NAME]: PORTAL_NAME,
      [HEADERS.X_ACCESS_TOKEN]: "test-access-token",
      [HEADERS.X_REFRESH_TOKEN]: "test-refresh-token"
    }
  },
  {
    url: ACCOUNT_PATHS.PROFILE,
    method: "GET",
    response: JSON.stringify(FREE_USER_PROFILE)
  },
  {
    url: ACCOUNT_PATHS.REFRESH_TOKENS,
    method: "GET",
    response: JSON.stringify({
      accessToken: "access-token-updated",
      refreshToken: "refresh-token-updated"
    })
  },
  {
    url: ACCOUNT_PATHS.LICENSE_LOGIN,
    method: "POST",
    response: JSON.stringify({
      accessToken: "license-access-token",
      refreshToken: "license-refresh-token"
    })
  }
];
