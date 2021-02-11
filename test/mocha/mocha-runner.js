/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

let emit = () => {};
let done = false;
let log = [];
let runner = mocha.run();

runner.on("end", () => { done = true; emit(); });

mocha.Mocha.reporters.Base.useColors = true;
mocha.Mocha.reporters.Base.consoleLog = (...arg) => { log.push(arg); emit(); };
new mocha.Mocha.reporters.Spec(runner);

self.poll = async function()
{
  if (!done && log.length == 0)
    await new Promise(resolve => { emit = resolve; });

  let unreadLog = log;
  log = [];

  return {done, total: runner.total, failures: runner.failures, log: unreadLog};
};
