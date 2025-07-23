import {runSDKTestServer, killSDKTestServer} from "@eyeo/test-utils/test-server-manager";

import {run as runBuild} from "./build.js";
import {run as runTests} from "../test/runners/functional.js";

async function run() {
  try {
    await runSDKTestServer();
    await runBuild();
    await runTests();
  }
  catch (e) {
    console.error(e);
  }
  finally {
    await killSDKTestServer();
  }
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
