import {run as runBuild} from "./build.js";
import {run as runTests} from "../test/runners/functional.js";
import {runTestServer, killTestServer} from "./test-server-manager.js";

async function run() {
  try {
    await runTestServer();
    await runBuild();
    await runTests();
  }
  catch (e) {
    console.error(e);
  }
  finally {
    await killTestServer();
  }
}

run().catch(err => {
  console.error(err instanceof Error ? err.stack : `Error: ${err}`);
  process.exit(1);
});
