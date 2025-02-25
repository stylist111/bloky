export function injectBlockthroughTag() {
  const urlParams = new URLSearchParams(window.location.search);

  let detail = {
    ab: urlParams.get("bt-aapv-ab") !== "false",
    acceptable: urlParams.get("bt-aapv-acceptable") !== "false"
  };

  const dispatchEvent = function() {
    window.__bt_intrnl = {
      aaDetectionResults: detail
    };
    let event = new CustomEvent("BTAADetection", {
      detail
    });
    window.dispatchEvent(event);
  };

  let delay = urlParams.get("bt-aapv-delay");
  if (delay) {
    setTimeout(dispatchEvent, parseInt(delay, 10));
  }
  else {
    dispatchEvent();
  }
}

injectBlockthroughTag();
