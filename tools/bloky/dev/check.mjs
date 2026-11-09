// Проверка собранного Bloky в настоящем Chrome (через DevTools, без ручных действий).
// node check.mjs <chrome.exe> <extensionDir> <outDir> [siteUrl]
// Печатает: ошибки фоновой части, все сетевые запросы расширения, сколько запросов
// заблокировано на сайте; сохраняет скриншоты окна и вкладок настроек в outDir.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// mirrorDir (необязательно): папка из tools/bloky/mirror-filters.mjs. Запросы расширения к
// stylist111.github.io подменяются файлами оттуда — так проверяем обновления фильтров
// до того, как GitHub Pages опубликован.
const [
  chrome,
  extDir,
  outDir,
  mirrorDir = "",
  site = "https://www.gazeta.ru/",
] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "bloky-check-"));

// Порт 0: Chrome сам берёт свободный порт и пишет его в DevToolsActivePort внутри
// своего профиля. Так мы никогда не подключимся к чужому браузеру или приложению.
const proc = spawn(
  chrome,
  [
    "--remote-debugging-port=0",
    "--enable-unsafe-extension-debugging",
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,900",
    "--lang=ru",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    const [port, path] = readFileSync(
      join(profile, "DevToolsActivePort"),
      "utf8",
    )
      .trim()
      .split("\n");
    wsUrl = `ws://127.0.0.1:${port}${path}`;
  } catch {
    await sleep(200);
  }
}
if (!wsUrl) {
  console.log("Chrome did not start");
  proc.kill();
  process.exit(1);
}
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));
let seq = 0;
const waits = new Map();
const handlers = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waits.has(m.id)) {
    waits.get(m.id)(m);
    waits.delete(m.id);
    return;
  }
  for (const h of handlers) {
    h(m);
  }
});
const call = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = ++seq;
    waits.set(id, resolve);
    ws.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });

const extRequests = [];
const errors = [];
const blocked = [];
const sessions = new Map(); // sessionId -> label
handlers.push((m) => {
  const label = sessions.get(m.sessionId);
  if (!label) {
    return;
  }
  if (m.method === "Network.requestWillBeSent" && label !== "site") {
    extRequests.push(
      `${label}: ${m.params.request.method} ${m.params.request.url}`,
    );
  }
  if (
    m.method === "Network.loadingFailed" &&
    label === "site" &&
    /BLOCKED_BY_CLIENT/.test(m.params.errorText)
  ) {
    blocked.push(m.params.requestId);
  }
  if (m.method === "Runtime.exceptionThrown") {
    errors.push(
      `${label}: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`,
    );
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push(
      `${label}: console.error ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`,
    );
  }
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
    errors.push(`${label}: ${m.params.entry.text} ${m.params.entry.url || ""}`);
  }
});

async function attach(targetId, label) {
  const { result } = await call("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const s = result.sessionId;
  sessions.set(s, label);
  for (const d of ["Runtime.enable", "Network.enable", "Log.enable"]) {
    await call(d, {}, s);
  }
  if (label === "background") {
    bgSession = s;
    if (mirrorDir) {
      await call(
        "Fetch.enable",
        { patterns: [{ urlPattern: "*stylist111.github.io*" }] },
        s,
      );
    }
  }
  await call("Runtime.runIfWaitingForDebugger", {}, s);
  return s;
}
let bgSession;
const mirrorHits = [];
handlers.push(async (m) => {
  if (m.method !== "Fetch.requestPaused") {
    return;
  }
  const u = new URL(m.params.request.url);
  const rel = u.pathname.replace(/^\/bloky\//, "");
  let body;
  try {
    body = readFileSync(
      join(mirrorDir, ...rel.split("/").map(decodeURIComponent)),
    );
  } catch {}
  mirrorHits.push(`${body ? 200 : 404} ${u.pathname}`);
  if (body) {
    await call(
      "Fetch.fulfillRequest",
      {
        requestId: m.params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: "*" },
        ],
        body: body.toString("base64"),
      },
      m.sessionId,
    );
  } else {
    await call(
      "Fetch.fulfillRequest",
      { requestId: m.params.requestId, responseCode: 404, body: "" },
      m.sessionId,
    );
  }
});
async function bg(code) {
  const r = await call(
    "Runtime.evaluate",
    {
      expression: `(async () => { ${code} })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    bgSession,
  );
  if (r.result?.exceptionDetails) {
    return {
      error:
        r.result.exceptionDetails.exception?.description ||
        r.result.exceptionDetails.text,
    };
  }
  return r.result?.result?.value;
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`,
  );
};

// eslint-disable-next-line prefer-const -- assigned after the event handler that reads it is registered
let extId;
handlers.push(async (m) => {
  if (m.method === "Target.targetCreated") {
    const t = m.params.targetInfo;
    if (
      t.type === "service_worker" &&
      extId &&
      t.url.startsWith(`chrome-extension://${extId}/`)
    ) {
      await attach(t.targetId, "background");
    }
  }
});
const ver = (await call("Browser.getVersion")).result;
console.log("browser:", ver.product);
if (!/^(Headless)?Chrome\//.test(ver.product)) {
  console.log("Not our Chrome, stop");
  process.exit(1);
}
await call("Target.setDiscoverTargets", { discover: true });
const loaded = await call("Extensions.loadUnpacked", { path: extDir });
if (loaded.error) {
  console.log("LOAD ERROR", JSON.stringify(loaded.error));
  process.exit(1);
}
extId = loaded.result.id;
console.log("extension id:", extId);
await sleep(1500);
for (const t of (await call("Target.getTargets")).result.targetInfos) {
  if (
    t.type === "service_worker" &&
    t.url.startsWith(`chrome-extension://${extId}/`) &&
    ![...sessions.values()].includes("background")
  ) {
    await attach(t.targetId, "background");
  }
}
await sleep(8000); // даём движку подняться и подтянуть первые обновления

// ---- состояние после установки ----
const subs = await bg(
  `return (await ewe.subscriptions.getSubscriptions()).map(s => ({url: s.url, title: s.title, enabled: s.enabled, status: s.downloadStatus, diff: s.diffURL || ''}))`,
);
check(
  "engine started, subscriptions list",
  Array.isArray(subs) && subs.length > 0,
  Array.isArray(subs)
    ? `${subs.length}: ${subs.map((s) => s.title).join(" | ")}`
    : JSON.stringify(subs),
);
if (Array.isArray(subs)) {
  check(
    "Acceptable Ads NOT enabled by default",
    !subs.some((s) => /exceptionrules/.test(s.url)),
  );
  check(
    "Russian list enabled (ru UI)",
    subs.some((s) => /ruadlist/.test(s.url)),
  );
  check(
    "diff updates point to GitHub Pages",
    subs.every(
      (s) =>
        !s.diff ||
        s.diff.startsWith("https://stylist111.github.io/bloky/v3/diff/"),
    ),
    subs
      .map((s) => s.diff)
      .filter(Boolean)
      .slice(0, 2)
      .join(" , "),
  );
}
check(
  "all former Premium features unlocked",
  (await bg(`return await License.isActiveLicense()`)) === true,
);
check(
  "no upsell in popup data",
  (await bg(
    `return JSON.stringify([await License.shouldShowMyAdBlockEnrollment(), await License.shouldShowPremiumDcCTA(), License.shouldShowPremiumCTA()])`,
  )) === "[false,false,false]",
);
check(
  "data collection off by default",
  (await bg(
    `await Prefs.untilLoaded; return Prefs.get('data_collection_opt_out')`,
  )) === true,
);

// ---- обновление списков через зеркало ----
if (mirrorDir) {
  await bg(
    `for (const s of await ewe.subscriptions.getSubscriptions()) await ewe.subscriptions.sync(s.url); return true`,
  );
  await sleep(8000);
  const after = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).map(s => ({t: s.title, st: s.downloadStatus}))`,
  );
  const bad = (after || []).filter((s) => s.st && s.st !== "synchronize_ok");
  check(
    "filter updates downloaded from the mirror",
    mirrorHits.some((h) => h.startsWith("200")) && bad.length === 0,
    `mirror hits: ${mirrorHits.length} (${mirrorHits.filter((h) => h.startsWith("404")).length} x 404); not ok: ${bad.map((s) => s.t + "=" + s.st).join(", ")}`,
  );
}

// ---- бывшие платные списки включаются ----
const premiumUrls = await bg(
  `const a = await SubscriptionAdapter.getAllSubscriptionsMinusText(); return [a['distraction-control']?.url, a['cookies-premium']?.url]`,
);
if (Array.isArray(premiumUrls) && premiumUrls.every(Boolean)) {
  const added = await bg(
    `for (const u of ${JSON.stringify(premiumUrls)}) await ewe.subscriptions.add(u); await new Promise(r => setTimeout(r, 1500)); const s = await ewe.subscriptions.getSubscriptions(); return ${JSON.stringify(premiumUrls)}.map(u => !!s.find(x => x.url === u && x.enabled))`,
  );
  check(
    "Distraction control + cookie lists can be enabled",
    JSON.stringify(added) === "[true,true]",
    JSON.stringify(added),
  );
  const rulesets = await bg(
    `return (await chrome.declarativeNetRequest.getEnabledRulesets()).length`,
  );
  check(
    "DNR rulesets enabled",
    typeof rulesets === "number" && rulesets > 0,
    `${rulesets} rulesets`,
  );
} else {
  check(
    "Distraction control + cookie lists found",
    false,
    JSON.stringify(premiumUrls),
  );
}

async function openPage(url, label, wait = 4000) {
  const { result } = await call("Target.createTarget", { url: "about:blank" });
  const s = await attach(result.targetId, label);
  await call("Page.enable", {}, s);
  await call(
    "Emulation.setDeviceMetricsOverride",
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    s,
  );
  await call("Page.navigate", { url }, s);
  await sleep(wait);
  return s;
}
async function shot(s, name) {
  const r = await call("Page.captureScreenshot", { format: "png" }, s);
  if (r.result) {
    writeFileSync(
      join(outDir, `${name}.png`),
      Buffer.from(r.result.data, "base64"),
    );
  }
}

const base = `chrome-extension://${extId}/`;
const pop = await openPage(`${base}adblock-button-popup.html`, "popup");
await call(
  "Emulation.setDeviceMetricsOverride",
  { width: 380, height: 620, deviceScaleFactor: 2, mobile: false },
  pop,
);
await sleep(800);
await shot(pop, "popup");

const opt = await openPage(`${base}options.html#general`, "options", 5000);
for (const tab of [
  "general",
  "filters",
  "premium-filters",
  "mab-themes",
  "mab-image-swap",
  "customize",
  "support",
  "stats-tabs",
]) {
  await call(
    "Runtime.evaluate",
    {
      expression: `document.querySelector('.tablink[href="#${tab}"]')?.click()`,
    },
    opt,
  );
  await sleep(1500);
  await shot(opt, `options-${tab}`);
}

await openPage(site, "site", 12000);
await sleep(3000); // ловим поздние запросы фоновой части
const blockedOnSite = blocked.length;
check(`ads blocked on ${site}`, blockedOnSite > 0, `${blockedOnSite} requests`);

// ---- окно расширения для открытого сайта ----
const siteTab = await bg(
  `return (await chrome.tabs.query({})).find(t => /gazeta\\.ru/.test(t.url))?.id`,
);
if (siteTab) {
  const pop2 = await openPage(
    `${base}adblock-button-popup.html?tabId=${siteTab}`,
    "popup",
    3000,
  );
  await call(
    "Emulation.setDeviceMetricsOverride",
    { width: 380, height: 620, deviceScaleFactor: 2, mobile: false },
    pop2,
  );
  await sleep(1000);
  await shot(pop2, "popup-site");
  const more = await openPage(
    `${base}adblock-button-filtering-options.html?tabId=${siteTab}`,
    "popup",
    3000,
  );
  await call(
    "Emulation.setDeviceMetricsOverride",
    { width: 380, height: 420, deviceScaleFactor: 2, mobile: false },
    more,
  );
  await sleep(1500);
  await shot(more, "popup-more");
}

// ---- свой фильтр: скрыть элемент на example.com ----
const cf = await bg(`return await addCustomFilter('example.com##p')`);
const ex = await openPage("https://example.com/", "example", 4000);
const h1 = await call(
  "Runtime.evaluate",
  {
    expression: `getComputedStyle(document.querySelector('p')).display`,
    returnByValue: true,
  },
  ex,
);
check(
  "custom filter hides an element",
  h1.result?.result?.value === "none",
  `addCustomFilter → ${JSON.stringify(cf)}, p display = ${h1.result?.result?.value}`,
);

// ---- исключение для сайта: на нём ничего не блокируется ----
await bg(`await ewe.filters.add(['@@||gazeta.ru^$document']); return true`);
blocked.length = 0;
await openPage(site, "site", 10000);
check(
  "allowlisted site is not filtered",
  blocked.length === 0,
  `${blocked.length} blocked while allowlisted`,
);
await bg(`await ewe.filters.remove(['@@||gazeta.ru^$document']); return true`);

// ---- пауза везде (как кнопка «Приостановить» в окне) ----
const ctl = await openPage(`${base}options.html#general`, "options2", 3000);
const ev = (s, e) =>
  call(
    "Runtime.evaluate",
    {
      expression: `(async () => { ${e} })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    s,
  );
await ev(
  ctl,
  `await browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: true }); return true`,
);
blocked.length = 0;
await openPage(site, "site", 10000);
check(
  "pause stops blocking",
  blocked.length === 0,
  `${blocked.length} blocked while paused`,
);
await ev(
  ctl,
  `await browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: false }); return true`,
);
blocked.length = 0;
await openPage(site, "site", 10000);
check(
  "unpause resumes blocking",
  blocked.length > 0,
  `${blocked.length} blocked after resume`,
);

// ---- тема окна: выбрать «тёмную» в настройках ----
await call(
  "Runtime.evaluate",
  {
    expression: `document.querySelector('.tablink[href="#mab-themes"]').click()`,
  },
  ctl,
);
await sleep(1500);
const picked = await ev(
  ctl,
  `const i = [...document.querySelectorAll('input.invisible-radio-button')].find(x => { const b = x.closest('.theme-box'); return b && b.dataset.theme === 'dark_theme' && /popup/.test(b.dataset.key || ''); }); if (!i) return 'no input'; i.click(); return 'clicked'`,
);
await sleep(1500);
const pop3 = await openPage(
  `${base}adblock-button-popup.html${siteTab ? `?tabId=${siteTab}` : ""}`,
  "popup",
  3000,
);
await call(
  "Emulation.setDeviceMetricsOverride",
  { width: 380, height: 620, deviceScaleFactor: 2, mobile: false },
  pop3,
);
await sleep(800);
const themeId = (await ev(pop3, `return document.body.id`)).result?.result
  ?.value;
check(
  "popup theme can be changed",
  themeId === "dark_theme",
  `${picked.result?.result?.value}, popup body id = ${themeId}`,
);
await shot(pop3, "popup-dark");

console.log("\n== checks:");
for (const r of results) {
  console.log("  " + r);
}
console.log(`\n== blocked on ${site}: ${blockedOnSite} requests`);
const hosts = new Map();
for (const r of extRequests) {
  const u = r.split(" ")[2] || "";
  if (!/^https?:/.test(u)) {
    continue;
  }
  const h = new URL(u).host;
  hosts.set(h, (hosts.get(h) || 0) + 1);
}
console.log("\n== extension network hosts (http/https only):");
for (const [h, n] of hosts) {
  console.log(`  ${h}  x${n}`);
}
console.log("\n== extension http(s) requests:");
for (const r of extRequests.filter((r) => /https?:\/\//.test(r))) {
  console.log("  " + r.slice(0, 220));
}
console.log(`\n== errors (${errors.length}):`);
for (const e of [...new Set(errors)].slice(0, 40)) {
  console.log("  " + e.slice(0, 300));
}

ws.close();
proc.kill();
await sleep(1000);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
process.exit(0);
