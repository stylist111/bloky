mocha.setup("bdd");

let timeout = new URLSearchParams(document.location.search).get("timeout");
if (timeout)
  mocha.timeout(parseInt(timeout, 10));
