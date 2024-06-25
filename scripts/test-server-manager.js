import path from "path";

import {spawn} from "child_process";
import {TEST_PAGES_URL} from "../test/test-server-urls.js";

let testServer;

export function runTestServer(verbose) {
  if (testServer) {
    return;
  }

  console.log("Test server starting...");
  let args = [path.join(process.cwd(), "test", "start-server.js")];
  if (verbose) {
    args.push("--verbose");
  }
  testServer = spawn("node", args);

  return new Promise((resolve, reject) => {
    let log = [];
    let testPagesServerStarted = false;
    let skipProcessingOutput = false;

    function removeListeners() {
      testServer.stderr.off("data", onData);
      testServer.stdout.off("data", onData);
      testServer.off("close", onClose);
    }

    function onData(data) {
      if (verbose) {
        for (const line of data.toString().split("\n")) {
          if (line.length > 0) {
            console.log("Server (debug):", line);
          }
        }
      }
      if (skipProcessingOutput) {
        // in verbose mode we're still listening the process output,
        // but skip processing it
        return;
      }
      log.push(data);
      if (data.includes(`listening at ${TEST_PAGES_URL}`)) {
        testPagesServerStarted = true;
      }

      if (testPagesServerStarted) {
        console.log("✅ Test server started");
        if (verbose) {
          // keep listening the std output from child process just
          // to be able to forward it to console, but skip processing
          skipProcessingOutput = true;
        }
        else {
          removeListeners();
        }
        resolve();
      }
    }

    function onClose(code) {
      if (code && code != 0) {
        if (!verbose) {
          console.log(log.join("\n"));
        }
        removeListeners();
        reject(new Error("Failed to start test server"));
      }
    }

    testServer.stderr.on("data", onData);
    testServer.stdout.on("data", onData);
    testServer.on("close", onClose);
  });
}

export async function killTestServer() {
  await new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      reject(new Error("Could not stop test server"));
    }, 5000);

    function onClose() {
      if (!testServer) {
        return;
      }

      testServer.off("close", onClose);
      console.log("✅ Test server has been stopped");
      resolve();
      clearTimeout(timeout);
    }
    testServer.on("close", onClose);
    testServer.kill("SIGKILL");
  });

  testServer = null;
}
