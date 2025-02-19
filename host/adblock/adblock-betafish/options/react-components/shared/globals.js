/*
  This file re-exports global references so they can be
  explicitly imported in the React components. Eventually,
  we should make these truly scoped values, but at least this
  gives us a list of the one we use
*/

/* For ESLint: List any global identifiers used in this file below */
/* global abpPrefPropertyNames, DataCollectionV2, info, MABPayment, Prefs, prefsNotifier, send, settings, settingsNotifier, SubscriptionAdapter, SubscriptionsProxy */

export const globalAbpPrefPropertyNames = abpPrefPropertyNames;
export const globalDataCollectionV2 = DataCollectionV2;
export const globalInfo = info;
export const globalMABPayment = MABPayment;
export const globalPrefs = Prefs;
export const globalPrefsNotifier = prefsNotifier;
export const globalSend = send;
export const globalSettings = settings;
export const globalSettingsNotifier = settingsNotifier;
export const globalSubscriptionAdapter = SubscriptionAdapter;
export const globalSubscriptionsProxy = SubscriptionsProxy;
