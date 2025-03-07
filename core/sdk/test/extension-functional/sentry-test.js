function getSentryErrorMessage(errorType) {
  return `This is an expected error for Sentry (${errorType})`;
}

function handleMessage(errorType) {
  setTimeout(() => {
    const error = new Error(getSentryErrorMessage(errorType));
    if (errorType === "error") {
      throw error;
    }

    if (errorType === "rejection") {
      Promise.reject(error);
    }
  }, 0);
}

function start() {
  EWE.sentry.start();

  const port = chrome.runtime.connect({name: "sentry-test"});
  port.onMessage.addListener(handleMessage);
}

start();
