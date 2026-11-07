// Bloky filter-update mirror.
//
// Every filter list bundled into Bloky has a header line like
//   ! DiffUrl: https://easylist-downloads.adblockplus.org/v3/diff/<list>/<release>.json
// At build time Bloky points that line to GitHub Pages (see tools/rules/src/node/build.js).
// This script downloads the current diff files from eyeo and lays them out under
// <out>/v3/diff/<list>/<release>.json, ready to be published as GitHub Pages.
//
// usage: node tools/bloky/mirror-filters.mjs <filterlists dir> <out dir>
//   <filterlists dir> = node_modules/@eyeo/filterlists/filterlists
// Old releases listed in tools/bloky/filter-releases.txt are mirrored too, so
// people who haven't updated Bloky yet keep getting fresh filters.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recommended } from "../rules/config/adblock.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const [listsDir, outDir] = process.argv.slice(2);
if (!listsDir || !outDir) {
  console.error("usage: mirror-filters.mjs <filterlists dir> <out dir>");
  process.exit(2);
}

const SOURCE = "https://easylist-downloads.adblockplus.org/v3/diff/";
const headerRe =
  /^! DiffUrl: https:\/\/easylist-downloads\.adblockplus\.org\/v3\/diff\/([^/\s]+)\/([0-9a-f]+)\.json/m;

const lists = new Set();
const releases = new Set();
for (const id of recommended) {
  let text;
  try {
    text = await fs.readFile(path.join(listsDir, id), "utf8");
  } catch {
    console.warn(`skip ${id}: not in the filterlists package`);
    continue;
  }
  const m = headerRe.exec(text.slice(0, 2000));
  if (!m) {
    console.warn(`skip ${id}: no DiffUrl header`);
    continue;
  }
  lists.add(m[1]);
  releases.add(m[2]);
}

const extra = await fs
  .readFile(path.join(here, "filter-releases.txt"), "utf8")
  .catch(() => "");
for (const line of extra.split(/\r?\n/)) {
  const sha = line.replace(/#.*/, "").trim();
  if (/^[0-9a-f]{40}$/.test(sha)) {
    releases.add(sha);
  }
}

let ok = 0;
let missing = 0;
let failed = 0;
const jobs = [];
for (const release of releases) {
  for (const list of lists) {
    jobs.push({ list, release });
  }
}

async function fetchOne({ list, release }) {
  const url = `${SOURCE}${encodeURIComponent(list).replace(/%2B/g, "+")}/${release}.json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "bloky-filter-mirror" },
      });
      if (res.status === 404) {
        missing++;
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = await res.text();
      JSON.parse(body); // never publish a broken file
      const file = path.join(outDir, "v3", "diff", list, `${release}.json`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      ok++;
      return;
    } catch (e) {
      if (attempt === 3) {
        failed++;
        console.warn(`failed ${url}: ${e.message}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }
}

// a few downloads at a time, to be gentle with the source server
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      await fetchOne(queue.shift());
    }
  }),
);

await fs.writeFile(
  path.join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Bloky filter updates</title>
<p>Filter list updates for <a href="https://github.com/stylist111/bloky">Bloky</a>.</p>
<p>Mirrored from eyeo's filter server. The lists keep their own licenses and authors
(EasyList, RuAdList, Fanboy's lists and others) — see the header of each list.</p>
<p>Updated: ${new Date().toISOString()}</p>\n`,
);

console.log(
  `lists: ${lists.size}, releases: ${releases.size}, saved: ${ok}, not found: ${missing}, failed: ${failed}`,
);
if (ok === 0) {
  process.exit(1);
}
