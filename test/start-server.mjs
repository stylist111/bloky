import path from "path";
import url from "url";
import express from "express";

const PORT = 3000;

let app = express();
let root = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "pages");

app.use(express.static(root));
app.listen(PORT, "localhost", () =>
{
  // eslint-disable-next-line no-console
  console.log(`Test pages server listening at http://localhost:${PORT}`);
});
