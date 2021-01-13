import path from "path";
import url from "url";

import express from "express";
import onHeaders from "on-headers";

const PORT = 3000;

let app = express();
let root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "pages");

app.use((req, res, next) =>
{
  let userAgent = req.get("User-Agent");
  if (userAgent && userAgent.includes("Gecko/") && req.path == "/csp.html")
  {
    onHeaders(res, () =>
    {
      res.removeHeader("Etag");
      res.removeHeader("Last-Modified");
    });
  }

  return next();
});

app.use(express.static(root));

app.listen(PORT, "localhost", () =>
{
  // eslint-disable-next-line no-console
  console.log(`Test pages server listening at http://localhost:${PORT}`);
});
