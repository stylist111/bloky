const serverLogger = new EWE.telemetry.ServerLogger("ewe_ui_api_test");

function handleMessage({type, data}) {
  switch (type) {
    case "debug":
      serverLogger.debug("test_message_received", data);
  }
}

function start() {
  const port = chrome.runtime.connect({name: "telemetry-test"});
  port.onMessage.addListener(handleMessage);
}

start();
