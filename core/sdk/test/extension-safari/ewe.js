/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as EWE from "../../dist/ewe-api.js";
import {checkDefaultSubscriptions, subscriptions} from "./subscriptions.js";
import {notifyPopup} from "./utils.js";

// Timing info - tracked at module load time
const extensionStartTime = Date.now();
let eweStartDuration = null;
let eweSetupDuration = null;

/**
 * Get startup timing information.
 * @returns {object} Timing info with extensionStartTime, eweStartDuration,
 *   eweSetupDuration, and runningDuration (all numbers).
 */
export function getStartupInfo() {
  return {
    extensionStartTime,
    eweStartDuration,
    eweSetupDuration,
    runningDuration: Date.now() - extensionStartTime
  };
}

let startupInfo = {};

startupInfo.bundledSubscriptionsPath = "subscriptions";
startupInfo.bundledSubscriptions = subscriptions;

/**
 * Entry point
 */
export function start() {
  const startTime = Date.now();
  EWE.start(startupInfo).then(async firstRun => {
    eweStartDuration = Date.now() - startTime;
    console.warn(`EWE.start() completed in ${eweStartDuration}ms`);
    notifyPopup("timingUpdate", {section: "startup"});
    if (firstRun.warnings.length > 0) {
      console.warn("EWE startup warnings: ", firstRun.warnings);
    }

    await checkDefaultSubscriptions();

    // Signal startup complete — updateEnabledRulesets calls will now
    // go through to the native Safari API instead of being dropped.
    EWE.signalStartupComplete();
    eweSetupDuration = Date.now() - startTime;
    console.warn(`EWE setup completed in ${eweSetupDuration}ms`);
    notifyPopup("timingUpdate", {section: "startup"});
  }).catch(e => {
    console.error("Failed to start EWE:", e);
  });

  // 1-click allowlisting
  let oneClickAllowlistingPublicKeys = [
    "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAorAkyGHnzZkVE0TGcU7Sl6/LlH9j3udDNvHv/fSzplLMdqkw0HZNV9zaBFQ0Rw73AJ7MQ8JQm2hex9DEss3xsrlpHEi/nC7C1authg1rt5Xo4K0P5Bo+j6y41UtgQoL9xKJ6RlYGBq4uBHaq/xRyp/7zUxOiViTdnVZRhSkmyBCIQ+5l8/mTk5yyMLfH7QM0KFKdJbnnTU8HEGzHaFi33vAwWPpJjCohYUzYxgXOgSZYV6xNPycQj4U/D4k+7UT+d4zzrj7fSz08/ijfHLB8G6dr1nx7+Pydt3ijhKEX2mKaAWgKtyM2wTgFXys4rnAbdr340FpQaVebNF0bwGsqluBNdvZ6fPgN9dLlpVDQKXlOKdfOyc64Yw82/jHKdYC7NO1bg13hqo7JWM10Gklt2FY5ekfDBZagPbYCH780C8w0aMceBs3NBTI6SAPI8xhyu7LwL7vw/vMwz8kfIsKOCPFqf0qPlvJCaryIAA7Ca6SHfBqaTzyivEEqn6tWphCpYSODfPRO4Udg+l/o/PCJuly41b4QF2x8H+LvJnr7HFknmFYwisbIofC/2ucO2sfJDP4EOHKeDV9mexHSJIfjyFYV0f0ALj1eKl9Viz37qLefzXFhTG4wzoK5F/QM1ZhIWjN+0DBn6GTQxuWc4eAuASoh07JG4M+i2rWcUTYvgOECAwEAAQ==",
    "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAz0zHgcXEoGyk4iZHUCfrhU3j7JiHi1EhAtMONxFfmeN4bp6zOWQaMz8cU4S+2jOFD/3oKJGTYNqYH9hBXMG1GzA7nzjNBsONTE64TMxQBt8ksT0bTwqTZ4nqTRWJsjo3XPzB+qkC7a1vXmujcfRsQMY7xbBnhZ6VVGMGtpUIPXNjtjGk3JOD1rKUU8Efq2lZmQlBf63s6u6EDnX6WcdgwlLpQwewO8BrXDBurdH83ZaVrx3zOQVQyJTj0+CAkammJ04Aq1golgddz4qRzr5vmB0FQkibr3oh79HfaqByKHsqgBFeAcdSbSg/pzqeNjnH0+a6GNx31V8UoDC3cRa/Uqet+t55QTSwWI4Iu11CZrKb3HX78swDkHW9/pyG2KZeUViFLe3EqInzH7jTZPTuQR4zGXMZji/WtqWxONjt37PKReJSTnMJSh2GyVUk3tZGb1fNtgthiu711uPh8/qjiuWPiaECRnCAc6sRgblxVRD4tIYgLmbbUsTPwlBFw6iZ/2HjqowA4/S5og1M3JAp4KBr7QYRz30Ji3TUjg5rWJdzO/WNx46W1Ro08PkfidvjdQ2PJvQkCtNCgnRbyAgPLJ1hMDycsKYduKO8Y5AszVgD/RBipYg9HVkuCnYChCspu8cq6gaR1sx3IcqZZs9kZUIqAT1bxMdYkKCm0igciAkCAwEAAQ=="
  ];
  EWE.allowlisting.setAuthorizedKeys(oneClickAllowlistingPublicKeys);
}
