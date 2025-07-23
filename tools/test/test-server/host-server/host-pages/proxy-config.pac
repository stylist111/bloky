function FindProxyForURL(url, host) {
  if (host === "testpages.eyeo.com") {
    return "PROXY http://localhost:3005";
  }
  return "DIRECT";
}
