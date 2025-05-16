/**
 * This file is part of eyeo's Conflict Detection fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Interface for the partner extension detection
 * Note: The use of the 'any' type below is a temporary solution
 *       Once a core utility for these 'any' objects are created, it is
 *       expected that type information below be updated
 */
export interface StartInfo {
  /**
   * A reference to the logger object
   *
   */
  logger: any;

  /**
   * A reference to a Prefs object
   *
   */
  prefs: any;

  /**
   * A reference to the port object
   *
   */
  port: any;

  /**
   * A reference to a function will add the message types
   * that are needed from the content script.
   *
   */
  addTrustedMessageTypes: addTrustedMessageTypesFunction;
}

/**
 * Function to add trusted message types for certain origins
 *
 */
export type addTrustedMessageTypesFunction = (
  origin: string | null,
  types: string[],
) => void;

/**
 * The alarm name for the ping schedule.
 */
export const alarmName = "pd:ping_schedule";

/**
 * The name for the Prefs storage key of the interval duration.
 */
export const intervalKey = "pd_ping_interval";

/**
 * The name for the Prefs storage key that contains the partner extension IDs of Chromium based browsers.
 */
export const partnerExtensionIdsKey = "partnerExtensionIds";

/**
 * The name for the Prefs storage key that indicates if a partner extension was found.
 */
export const partnerExtensionFoundKey = "partnerExtensionFound";

/**
 * The name for the Prefs storage key of the last attempted Partner Detection ping.
 */
export const lastPingKey = "pd_last_ping";

/**
 * The name for the Prefs storage key that indicates if the ubo extension was found.
 */
export const uboDetectedKey = "uboDetected";

/**
 * The name for the Prefs storage key that indicates when the detection was last run.
 */
export const uboDetectionLastRunKey = "uboDetectionLastRun";

/**
 * The name for the Prefs storage key that contains the partner extension IDs of Chromium based browsers.
 */
export interface PingResponse {
  pingResponse?: boolean;
}

/**
 * Message sent to other extensions
 */
export const PingMessage = {
  type: "ping",
} as const;

/**
 *  The extension IDs of the partner extension(s) to send the ping message to.
 */
export const PartnerExtensionIds = [
  "cfhdojbkjhnklbpkdaibdccddilifddb", // ABP - CWS
  "gighmmpiobklfepjocnamgkkbiglidom", // AB - CWS
  "gmgoamodcdcjnbaobigkjelfplakmdhh", // ABP - MS Edge Store
  "ndcileolkflehcjpmjnfbnaibdcgglog", // AB - MS Edge Store
  "oidhhegpmlfpoeialbgcdocjalghfpkp", // ABP - Opera
  "{d10d0bf8-f5b5-c8b4-a8b2-2b9879e08c5d}", // ABP - FF / AMO
  "jid1-NIfFY2CA8fy1tg@jetpack", // AB - FF / AMO
] as const;

/**
 * Function that returns the number of partner extensions found during the last 'ping'
 *
 */
export type getNumberPartnerExtFunction = () => Promise<number>;

/**
 *  The extension IDs of the NON-partner extension(s) to send the ping message to.
 */
export const uboExtensionIds = [
  "cjpalhdlnbpafiamejdnhcphjbkeiagm", // ubo - CWS
  "ddkjiahejlhfcafbddmgiahcphecmpfh", // ubo light - CWS
  "odfafepnkmbhccpbejgmiehpchacaeak", // ubo - MS Edge Store
  "cimighlppcgcoapaliogpjjdehbnofhn", // ubo light - MS Edge Store
  "kccohkcpppjjkkjppopfnflnebibpida", // ubo - Opera
  "99f80bf7-2581-4e03-a191-3013e8d65551", // ubo - FF / AMO
];
