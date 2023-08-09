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

import expect from "expect";

expect.extend({
  anyNullable(received, type) {
    return {
      pass: received == null || typeof received == type
    };
  },
  oneOf(received, expected) {
    return {
      pass: expected.includes(received)
    };
  },
  toBeArrayContainingExactly(received, mandatoryExpected,
                             optionalExpected = []) {
    let createResult = (pass, outcomeDescriptionLines) => {
      return {
        pass,
        message: () => {
          let lines = [];
          lines.push(this.utils.matcherHint("toBeArrayContainingExactly"));

          if (outcomeDescriptionLines) {
            lines.push(...outcomeDescriptionLines);
            lines.push("\n");
          }

          lines.push("Expected: " +
                     this.utils.printExpected(mandatoryExpected));
          if (!Array.isArray(optionalExpected) || optionalExpected.length > 0) {
            lines.push("Expected (optional): " +
                       this.utils.printExpected(optionalExpected));
          }
          lines.push("Received: " + this.utils.printReceived(received));

          return lines.join("\n");
        }
      };
    };

    if (!Array.isArray(received)) {
      return createResult(false, ["Received was not an array."]);
    }

    if (!Array.isArray(mandatoryExpected)) {
      return createResult(false, ["Expected was not an array."]);
    }

    if (!Array.isArray(optionalExpected)) {
      return createResult(false, ["Expected (optional) was not an array."]);
    }

    let unmatchedReceived = [];
    let unmatchedMandatory = mandatoryExpected.slice(0);
    let unmatchedOptional = optionalExpected.slice(0);

    for (let receivedEvent of received) {
      let matched = false;
      for (let i = 0; i < unmatchedMandatory.length && !matched; i++) {
        let expectedEvent = unmatchedMandatory[i];
        if (this.equals(receivedEvent, expectedEvent)) {
          matched = true;
          unmatchedMandatory.splice(i, 1);
          break;
        }
      }

      for (let i = 0; i < unmatchedOptional.length && !matched; i++) {
        let expectedEvent = unmatchedOptional[i];
        if (this.equals(receivedEvent, expectedEvent)) {
          matched = true;
          unmatchedOptional.splice(i, 1);
          break;
        }
      }

      if (!matched) {
        unmatchedReceived.push(receivedEvent);
      }
    }

    let pass = unmatchedReceived.length == 0 &&
        unmatchedMandatory.length == 0;
    let outcomeDescriptionLines = [];
    if (unmatchedReceived.length > 0) {
      outcomeDescriptionLines.push("Received but not expected: " +
        this.utils.printReceived(unmatchedReceived));
    }
    if (unmatchedMandatory.length > 0) {
      outcomeDescriptionLines.push("Expected but not received: " +
        this.utils.printExpected(unmatchedMandatory));
    }

    return createResult(pass, outcomeDescriptionLines);
  }
});
