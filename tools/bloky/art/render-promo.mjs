// Renders promo.html into PNG files with headless Chrome.
// node render-promo.mjs <chrome.exe> <repo root>
// Writes docs/img/banner.png (README, 2x), docs/img/social-preview.png (GitHub, 1280x640)
// and the Chrome Web Store images into _build/store/.
import { spawn } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [chrome, root] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const page = pathToFileURL(path.join(here, "promo.html")).href;
const store = path.join(root, "_build", "store");
mkdirSync(store, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const jobs = [
  ["banner", 1280, 640, 2, path.join(root, "docs", "img", "banner.png")],
  [
    "banner",
    1280,
    640,
    1,
    path.join(root, "docs", "img", "social-preview.png"),
  ],
  ["shot1", 1280, 800, 1, path.join(store, "screenshot-1.png")],
  ["shot2", 1280, 800, 1, path.join(store, "screenshot-2.png")],
  ["shot3", 1280, 800, 1, path.join(store, "screenshot-3.png")],
  ["shot4", 1280, 800, 1, path.join(store, "screenshot-4.png")],
  ["promo", 440, 280, 1, path.join(store, "promo-440x280.png")],
  ["marquee", 1400, 560, 1, path.join(store, "marquee-1400x560.png")],
];

const profile = mkdtempSync(path.join(tmpdir(), "bloky-promo-"));
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--allow-file-access-from-files",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let ws;
try {
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const [port] = readFileSync(
        path.join(profile, "DevToolsActivePort"),
        "utf8",
      ).split("\n");
      const list = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
      ).json();
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let seq = 0;
  const waits = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) {
      waits.get(m.id)(m);
      waits.delete(m.id);
    }
  });
  const call = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq;
      waits.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  for (const [kind, width, height, scale, out] of jobs) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await call("Page.navigate", { url: `${page}?kind=${kind}` });
    await sleep(800);
    await call("Runtime.evaluate", {
      expression: "document.fonts.ready.then(() => true)",
      awaitPromise: true,
    });
    await sleep(300);
    const shot = await call("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    console.log(`saved ${out} (${width}x${height} @${scale}x)`);
  }
} finally {
  ws?.close();
  proc.kill();
  await sleep(800);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
