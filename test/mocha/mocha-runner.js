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

self.done = new Promise(resolve =>
{
  let passed = 0;
  let failed = 0;
  let log = [];
  let runner = mocha.run();

  runner.on("pass", () => passed++);
  runner.on("fail", () => failed++);
  runner.on("end", () => resolve({passed, failed, log}));

  mocha.Mocha.reporters.Base.useColors = true;
  mocha.Mocha.reporters.Base.consoleLog = (...args) => { log.push(args); };
  new mocha.Mocha.reporters.Spec(runner);
});
