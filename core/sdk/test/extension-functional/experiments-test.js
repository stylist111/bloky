async function start() {
  const port = chrome.runtime.connect({name: "experiments-ui-test"});
  port.onMessage.addListener(async({method, args}) => {
    let response = null;

    try {
      response = await EWE.experiments[method](...args);
    }
    catch (error) {
      console.error("Error in experiments test:", error);
    }

    port.postMessage(response);
  });
}

start();
