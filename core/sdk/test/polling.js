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

export function wait(condition, timeout = 0, message, pollTimeout = 100) {
  if (typeof condition !== "function") {
    throw TypeError("Wait condition must be a function");
  }

  function evaluateCondition() {
    return new Promise((resolve, reject) => {
      try {
        resolve(condition(this));
      }
      catch (ex) {
        reject(ex);
      }
    });
  }

  let result = new Promise((resolve, reject) => {
    let startTime = performance.now();
    let pollCondition = async() => {
      evaluateCondition().then(value => {
        let elapsed = performance.now() - startTime;
        if (value) {
          resolve(value);
        }
        else if (timeout && elapsed >= timeout) {
          try {
            let timeoutMessage = message ?
              `${typeof message === "function" ? message() : message}\n` : "";
            reject(
              new Error(`${timeoutMessage}Wait timed out after ${elapsed}ms`)
            );
          }
          catch (ex) {
            reject(
              new Error(`${ex.message}\nWait timed out after ${elapsed}ms`)
            );
          }
        }
        else {
          setTimeout(pollCondition, pollTimeout);
        }
      }, reject);
    };
    pollCondition();
  });

  return result;
}

export function limitPromiseDuration(promise, message, timeout) {
  let startTime = performance.now();
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      setTimeout(() => {
        let elapsed = performance.now() - startTime;
        reject(new Error(`${message}\nWait timed out after ${elapsed}ms`));
      }, timeout);
    })
  ]);
}
