async function start() {
  const port = chrome.runtime.connect({name: "experiments-ui-test"});
  port.onMessage.addListener(async flagId => {
    const flagValue = await EWE.experiments.getFlag(flagId);
    const div = document.createElement("div");
    div.id = "test-flag-ui";
    div.innerText = "This should be displayed if the feature flag is set";

    if (flagValue === "test-ui-flag") {
      document.body.appendChild(div);
    }

    port.postMessage(flagValue);
  });
}

start();
