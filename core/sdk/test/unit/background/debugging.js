// Configure the environment as test environment.
// Warning: must be the first line in the tests!
import env from "./environment.js";
import {mock} from "./mock/mock.js";
import expect from "expect";
import sinon from "sinon/pkg/sinon.js";

describe("Debugging", function() {
  const message = "Hello world";
  let api;

  beforeEach(async function() {
    env.configure();
    api = await mock("debugging.js");
  });

  describe("logging mechanism", function() {
    it("starts and stops triggering the listener", function() {
      let listenerArgs = null;
      let listener = (...args) => {
        listenerArgs = args;
      };

      api.default.onLogEvent.addListener(listener);
      api.info(message);
      expect(listenerArgs).not.toBeNull();
      let size = listenerArgs.length;

      api.default.onLogEvent.removeListener(listener);
      api.info(message);
      expect(listenerArgs.length).toEqual(size);
    });

    it("maps to log items events properties", function() {
      let listenerArgs = null;
      let listener = (...args) => {
        listenerArgs = args;
      };

      api.default.onLogEvent.addListener(listener);

      const map = new Map([
        ["log", api.LOG_LEVEL_INFO],
        ["info", api.LOG_LEVEL_INFO],
        ["debug", api.LOG_LEVEL_DEBUG],
        ["warn", api.LOG_LEVEL_WARNING],
        ["error", api.LOG_LEVEL_ERROR]
      ]);

      for (const [method, level] of map.entries()) {
        listenerArgs = null;
        api[method](message);
        expect(listenerArgs).toEqual([expect.objectContaining({
          message,
          level,
          timeStamp: expect.any(Date)
        })]);
      }
    });

    it("calls the callback if having listeners", function() {
      let calls = 0;
      let callback = () => {
        calls += 1;
        return message;
      };

      let listenerArgs = null;
      let listener = (...args) => {
        listenerArgs = args;
      };
      api.default.onLogEvent.addListener(listener);

      api.info(callback);
      expect(listenerArgs).toEqual([expect.objectContaining({
        message,
        level: api.LOG_LEVEL_INFO,
        timeStamp: expect.any(Date)
      })]);

      calls = 0;
      api.log(callback);
      api.info(callback);
      api.debug(callback);
      api.warn(callback);
      api.error(callback);

      expect(calls).toEqual(5);
    });

    it("does not call the callback if having no listeners", function() {
      let calls = 0;
      let callback = () => {
        calls += 1;
      };

      // no listener registered

      api.log(callback);
      api.info(callback);
      api.debug(callback);
      api.warn(callback);
      api.error(callback);

      expect(calls).toEqual(0);
    });
  });

  describe("console logger", function() {
    const sandbox = sinon.createSandbox();
    let consoleLogger;
    const colorEndToken = "[0m";

    beforeEach(async function() {
      for (let method of ["debug", "info", "warn", "error"]) {
        sandbox.spy(console, method);
      }
      consoleLogger = api.default.CONSOLE_LOGGER;
      api.default.onLogEvent.addListener(consoleLogger.getListener());
    });

    afterEach(function() {
      sandbox.restore();
      api.default.onLogEvent.removeListener(consoleLogger.getListener());
    });

    it("outputs to the console", function() {
      api.info(message);

      // eslint-disable-next-line no-console
      let consoleArgs = console.info.getCall(0).args;
      expect(consoleArgs[0].includes(message)).toEqual(true);
    });

    it("prints the stacktrace for trace()", function() {
      let someArg = 10;

      function someTracedFunction() {
        api.trace({someArg});
      }
      someTracedFunction();

      // eslint-disable-next-line no-console
      let consoleArgs = console.debug.getCall(0).args;
      let actualOutput = consoleArgs[0];
      expect(actualOutput.includes("someTracedFunction")).toEqual(true);
      expect(actualOutput.includes("debugging.js:")).toEqual(true);
    });

    it("prints the timestamp", function() {
      api.info(message);

      // eslint-disable-next-line no-console
      let consoleArgs = console.info.getCall(0).args;
      expect(/\d{2}:\d{2}:\d{2}.\d{3}.?/.test(consoleArgs[0])).toEqual(true);
    });

    it("colorizes to the default color if color is not passed", function() {
      api.warn(message);

      // eslint-disable-next-line no-console
      let warnConsoleArgs = console.warn.getCall(0).args;
      expect(warnConsoleArgs[0].includes("[33m")).toEqual(true);
      expect(warnConsoleArgs[0].includes(colorEndToken)).toEqual(true);

      api.error(message);

      let errConsoleArgs = console.error.getCall(0).args;
      expect(errConsoleArgs[0].includes("[31m")).toEqual(true);
      expect(errConsoleArgs[0].includes(colorEndToken)).toEqual(true);
    });

    it("colorizes to the specific color if passed", function() {
      api.warn(message, api.LOG_COLOR_MAGENTA);

      let warnConsoleArgs = console.warn.getCall(0).args;
      expect(warnConsoleArgs[0].includes("[35m")).toEqual(true);
      expect(warnConsoleArgs[0].includes(colorEndToken)).toEqual(true);

      api.error(message, api.LOG_COLOR_BLUE);

      let errConsoleArgs = console.error.getCall(0).args;
      expect(errConsoleArgs[0].includes("[34m")).toEqual(true);
      expect(errConsoleArgs[0].includes(colorEndToken)).toEqual(true);
    });

    it("stops listening when unsubscribed", function() {
      api.warn(message, api.LOG_COLOR_MAGENTA);
      expect(console.warn.callCount).toEqual(1);

      api.warn(message, api.LOG_COLOR_MAGENTA);
      expect(console.warn.callCount).toEqual(2);

      api.default.onLogEvent.removeListener(consoleLogger.getListener());

      api.warn(message, api.LOG_COLOR_MAGENTA);
      expect(console.warn.callCount).toEqual(2); // not incremented
    });

    it("is configurable", function() {
      api.default.onLogEvent.removeListener(consoleLogger.getListener());

      // don't print timestamp
      let noTimestampLogger = new api.default.ConsoleLogger(false)
        .getListener();

      try {
        api.default.onLogEvent.addListener(noTimestampLogger);
        api.warn(message, api.LOG_COLOR_MAGENTA);

        let warnConsoleArgs = console.warn.getCall(0).args;
        expect(warnConsoleArgs[0].includes(":")).toEqual(false);
        expect(warnConsoleArgs[0].includes("[35m")).toEqual(true);
      }
      finally {
        api.default.onLogEvent.removeListener(noTimestampLogger);
      }

      // don't colorize
      let noColorizeLogger = new api.default.ConsoleLogger(true, false)
        .getListener();

      try {
        api.default.onLogEvent.addListener(noColorizeLogger);
        api.warn(message, api.LOG_COLOR_MAGENTA);

        let warnConsoleArgs = console.warn.getCall(1).args;
        expect(warnConsoleArgs[0].includes(":")).toEqual(true);
        expect(warnConsoleArgs[0].includes("[35m")).toEqual(false);
      }
      finally {
        api.default.onLogEvent.removeListener(noColorizeLogger);
      }
    });
  });

  describe("OnRequest logger", function() {
    beforeEach(async function() {
      this.events = [];
      let self = this;
      this.logger = new api.default.OnRequestLogger(event => {
        self.events.push(event);
      });
      api.default.onLogEvent.addListener(this.logger.getListener());
    });

    afterEach(function() {
      api.default.onLogEvent.removeListener(this.logger.getListener());
    });

    it("calls the wrapped listener on print()", function() {
      api.info("message");
      expect(this.events.length).toEqual(0);
      this.logger.print();
      expect(this.events.length).toEqual(1);
    });

    it("clear the history on clear()", function() {
      api.info("message1");
      expect(this.events.length).toEqual(0);
      this.logger.print();
      expect(this.events.length).toEqual(1);
      this.logger.clear();
      this.events = [];
      api.info("message2");
      this.logger.print();
      expect(this.events.length).toEqual(1);
    });
  });
});
