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
