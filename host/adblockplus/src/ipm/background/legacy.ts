import { type Behavior } from "@eyeo-fragments/in-product-messaging/background";

import { LicenseState } from "./legacy.types";

/**
 * Placeholder for compatibility with legacy fragment
 *
 * @deprecated no longer exists in future IPM fragment
 */
export const defaultLicenseState = LicenseState.inactive;

/**
 * Placeholder for compatibility with legacy fragment
 *
 * @deprecated no longer exists in future IPM fragment
 */
export async function checkLanguage(ipmId: string): Promise<void> {}

/**
 * Placeholder for compatibility with legacy fragment
 *
 * @deprecated no longer exists in future IPM fragment
 */
export async function doesLicenseStateMatch(
  behavior: Behavior
): Promise<boolean> {
  return true;
}

/**
 * Placeholder for compatibility with legacy fragment
 *
 * @deprecated no longer exists in future IPM fragment
 */
export function isValidLicenseStateList(): boolean {
  return true;
}
