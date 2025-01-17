#!/usr/bin/env node

import * as fs from "fs";
import * as wbn from "wbn";

let localServer = "http://localhost:3000";
const builder = new wbn.BundleBuilder();
builder.addExchange(
  localServer,             // URL
  200,                                 // response code
  {"Content-Type": "text/html"},       // response headers
  "<html>Hello, Web Bundle!</html>"    // response body (string or Uint8Array)
);

builder.addExchange(
  `${localServer}/dir/a.js`,
  200,
  {"Content-Type": "text/javascript"},
  "console.log(\"a.js\");"
);

builder.addExchange(
  `${localServer}/dir/b.js`,
  200,
  {"Content-Type": "text/javascript"},
  "console.log(\"b.js\");"
);

builder.addExchange(
  `${localServer}/dir/c.png`,
  200,
  {"Content-Type": "image/png"},
  fs.readFileSync("test/pages/image.png")
);

builder.setPrimaryURL(localServer);  // entry point URL

fs.writeFileSync("test/pages/webext-sample.wbn", builder.createBundle());
