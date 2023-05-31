import path from "path";

import {spawn} from "child_process";
import {HTTP_PORT as TEST_PAGES_HTTP_PORT} from "../test/test-pages-server.js";

let testServer;

export function runTestServer() {
  if (testServer)
    return;

  console.log("Test server starting...");
  testServer = spawn("node", [path.join(process.cwd(), "test", "start-server.js")]);

  return new Promise((resolve, reject) => {
    let log = [];
    let testPagesServerStarted = false;

    function removeListeners() {
      testServer.stderr.off("data", onData);
      testServer.stdout.off("data", onData);
      testServer.off("close", onClose);
    }

    function onData(data) {
      log.push(data);
      if (data.includes(`listening at http://localhost:${TEST_PAGES_HTTP_PORT}`))
        testPagesServerStarted = true;

      if (testPagesServerStarted) {
        console.log("✅ Test server started");
        removeListeners();
        resolve();
      }
    }

    function onClose(code) {
      if (code != 0) {
        console.log(log.join("\n"));
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
      if (!testServer)
        return;

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
