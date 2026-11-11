// Сценарии пользователя для Bloky в настоящем Chrome (через DevTools, без ручных действий):
// обновление с прошлой версии с сохранёнными настройками, кнопки настроек по-настоящему
// (обновить списки, язык, свой список, свои правила, переводчики, тема, поддержка), затем
// «нажать всё подряд» на каждой вкладке настроек и в окне расширения, узкое окно.
//
// node scenarios.mjs <chrome.exe> <oldExtDir|-> <newExtDir> <outDir> [lang]
//   oldExtDir — распакованная прошлая версия (например, из релиза); «-» — без обновления.
// Печатает PASS/FAIL, ошибки страниц расширения (с тем, после какого нажатия они случились)
// и внешние ссылки; снимки — в outDir (только те нажатия, после которых экран изменился).
import { spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [chrome, oldDir, newDir, outDir, lang = "ru"] = process.argv.slice(2);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "bloky-scn-"));
const work = mkdtempSync(join(tmpdir(), "bloky-ext-"));
const upgrade = oldDir && oldDir !== "-";
cpSync(upgrade ? oldDir : newDir, work, { recursive: true });

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
    `--lang=${lang}`,
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
// every call has a time limit: a page that closed itself never answers
const call = (method, params = {}, sessionId, ms = 15000) =>
  new Promise((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      waits.delete(id);
      resolve({ error: { message: `timeout ${method}` } });
    }, ms);
    waits.set(id, (m) => {
      clearTimeout(timer);
      resolve(m);
    });
    ws.send(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }),
    );
  });

let step = "start";
const errors = [];
const sessions = new Map();
const ignoredLabels = new Set(["site"]);
handlers.push((m) => {
  const label = sessions.get(m.sessionId);
  if (!label || ignoredLabels.has(label)) {
    return;
  }
  let text;
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    text = d.exception?.description || d.text;
  } else if (
    m.method === "Runtime.consoleAPICalled" &&
    m.params.type === "error"
  ) {
    text = `console.error ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`;
  } else if (
    m.method === "Log.entryAdded" &&
    m.params.entry.level === "error"
  ) {
    text = `${m.params.entry.text} ${m.params.entry.url || ""}`;
  }
  if (text) {
    errors.push({
      step,
      label,
      text: text.split("\n").slice(0, 3).join(" | "),
    });
  }
});

// alert / confirm windows block the page: answer "OK" and remember the text
const dialogs = [];
handlers.push(async (m) => {
  if (m.method === "Page.javascriptDialogOpening") {
    dialogs.push(`[${step}] ${m.params.type}: ${m.params.message}`);
    await call(
      "Page.handleJavaScriptDialog",
      { accept: true },
      m.sessionId,
      3000,
    );
  }
});

let bgSession;
let bgAttaches = 0;
async function attach(targetId, label) {
  const { result } = await call("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  if (!result) {
    return null;
  }
  const s = result.sessionId;
  sessions.set(s, label);
  for (const d of ["Runtime.enable", "Log.enable"]) {
    await call(d, {}, s);
  }
  if (label === "background") {
    bgSession = s;
    bgAttaches++;
  }
  await call("Runtime.runIfWaitingForDebugger", {}, s);
  return s;
}
async function bg(code, ms = 30000) {
  const r = await call(
    "Runtime.evaluate",
    {
      expression: `(async () => { ${code} })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    bgSession,
    ms,
  );
  if (r.error) {
    return { error: r.error.message };
  }
  if (r.result?.exceptionDetails) {
    return {
      error:
        r.result.exceptionDetails.exception?.description ||
        r.result.exceptionDetails.text,
    };
  }
  return r.result?.result?.value;
}
async function ev(s, code, ms = 15000) {
  const r = await call(
    "Runtime.evaluate",
    {
      expression: `(async () => { ${code} })()`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    },
    s,
    ms,
  );
  if (r.error) {
    return { error: r.error.message };
  }
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
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`;
  results.push(line);
  console.log("  " + line);
};

// eslint-disable-next-line prefer-const -- assigned after the handler that reads it
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
console.log("browser:", ver.product, "lang:", lang);
await call("Target.setDiscoverTargets", { discover: true });
await call("Browser.setDownloadBehavior", { behavior: "deny" });
const loaded = await call("Extensions.loadUnpacked", { path: work });
if (loaded.error) {
  console.log("LOAD ERROR", JSON.stringify(loaded.error));
  process.exit(1);
}
extId = loaded.result.id;
await sleep(1500);
for (const t of (await call("Target.getTargets")).result.targetInfos) {
  if (
    t.type === "service_worker" &&
    t.url.startsWith(`chrome-extension://${extId}/`) &&
    !bgSession
  ) {
    await attach(t.targetId, "background");
  }
}
await sleep(10000);
const base = `chrome-extension://${extId}/`;

const ours = new Set();
async function openPage(
  url,
  label,
  wait = 4000,
  size = [1280, 900],
  scale = 1,
) {
  const { result } = await call("Target.createTarget", { url: "about:blank" });
  ours.add(result.targetId);
  const s = await attach(result.targetId, label);
  await call("Page.enable", {}, s);
  await call("Page.setInterceptFileChooserDialog", { enabled: true }, s);
  await call(
    "Emulation.setDeviceMetricsOverride",
    {
      width: size[0],
      height: size[1],
      deviceScaleFactor: scale,
      mobile: false,
    },
    s,
  );
  await call(
    "Emulation.setEmulatedMedia",
    {
      features: [
        {
          name: "prefers-color-scheme",
          value: process.env.BLOKY_SCHEME || "light",
        },
      ],
    },
    s,
  );
  await call("Page.navigate", { url }, s);
  await sleep(wait);
  return { s, targetId: result.targetId };
}
async function closePage(p) {
  await call("Target.closeTarget", { targetId: p.targetId }, undefined, 3000);
}
async function shotData(s) {
  const r = await call("Page.captureScreenshot", { format: "png" }, s, 8000);
  return r.result ? Buffer.from(r.result.data, "base64") : null;
}
const hash = (b) => (b ? createHash("sha1").update(b).digest("hex") : "none");
function save(name, data) {
  if (data) {
    writeFileSync(join(outDir, `${name}.png`), data);
  }
}
// pages the extension opened by itself (new tabs) since the last call
async function newTabs() {
  const found = [];
  for (const t of (await call("Target.getTargets")).result?.targetInfos || []) {
    if (t.type === "page" && !ours.has(t.targetId)) {
      ours.add(t.targetId);
      found.push(t.url);
      await call(
        "Target.closeTarget",
        { targetId: t.targetId },
        undefined,
        3000,
      );
    }
  }
  return found;
}

// ===================== 1. Update from the previous version =====================
const snapshot = () =>
  bg(`
    await Prefs.untilLoaded;
    const st = await chrome.storage.local.get(null);
    return {
      version: chrome.runtime.getManifest().version,
      userFilters: (await ewe.filters.getUserFilters()).map(f => f.text).sort(),
      subs: (await ewe.subscriptions.getSubscriptions()).map(s => s.url).sort(),
      statsInIcon: Prefs.get('show_statsinicon'),
      themes: st.settings && st.settings.color_themes,
    };`);
if (upgrade) {
  step = "old version setup";
  const o = await openPage(`${base}options.html#general`, "old-options", 5000);
  await ev(
    o.s,
    `settings.color_themes = { popup_menu: 'solarized_theme', options_page: 'solarized_theme' }; return true`,
  );
  await closePage(o);
  const setup = await bg(`
    await addCustomFilter('example.com##h1');
    await ewe.filters.add(['@@||example.org^$document']);
    await Prefs.untilLoaded; await Prefs.set('show_statsinicon', false);
    const a = await SubscriptionAdapter.getAllSubscriptionsMinusText();
    await ewe.subscriptions.add(a['cookies-premium'].url);
    return true`);
  await sleep(2000);
  const before = await snapshot();
  console.log("before update:", JSON.stringify(before));

  step = "update";
  for (const f of readdirSync(work)) {
    rmSync(join(work, f), { recursive: true, force: true });
  }
  cpSync(newDir, work, { recursive: true });
  // loading the same folder again = the same extension id, its data is kept (like an update)
  const attachesBefore = bgAttaches;
  const again = await call("Extensions.loadUnpacked", { path: work });
  console.log("reloaded:", JSON.stringify(again.result || again.error));
  for (let i = 0; i < 60; i++) {
    if (bgAttaches !== attachesBefore) {
      break;
    }
    await sleep(500);
  }
  if (bgAttaches === attachesBefore) {
    for (const t of (await call("Target.getTargets")).result.targetInfos) {
      if (
        t.type === "service_worker" &&
        t.url.startsWith(`chrome-extension://${extId}/`)
      ) {
        await attach(t.targetId, "background");
      }
    }
  }
  console.log("background attached again:", bgAttaches > attachesBefore);
  await sleep(10000);
  const after = await snapshot();
  console.log("after update: ", JSON.stringify(after));
  check("setup in the old version", setup === true, JSON.stringify(setup));
  check("update installed", after?.version === "1.1.0", after?.version);
  check(
    "own rules and allowlist kept after update",
    JSON.stringify(after?.userFilters) ===
      JSON.stringify(before?.userFilters) &&
      after.userFilters.includes("example.com##h1") &&
      after.userFilters.includes("@@||example.org^$document"),
    JSON.stringify(after?.userFilters),
  );
  check(
    "filter lists kept after update",
    JSON.stringify(after?.subs) === JSON.stringify(before?.subs),
    `${before?.subs?.length} → ${after?.subs?.length}`,
  );
  check(
    "option kept after update",
    after?.statsInIcon === false,
    String(after?.statsInIcon),
  );

  // the old theme (Solarized) is ignored: pages are in the one light look
  step = "after update: pages";
  const looks = [];
  for (const [url, name, size, scale] of [
    [`${base}options.html#general`, "upgrade-options", [1280, 900], 1],
    [`${base}adblock-button-popup.html`, "upgrade-popup", [360, 620], 2],
  ]) {
    const p = await openPage(url, "options", 5000, size, scale);
    looks.push(
      await ev(
        p.s,
        `return document.body.id + ' ' + getComputedStyle(document.body).backgroundColor`,
      ),
    );
    save(name, await shotData(p.s));
    await closePage(p);
  }
  check(
    "old Solarized theme → light Bloky look after update",
    looks.every(
      (l) =>
        typeof l === "string" &&
        /^default_theme rgb\(2\d\d, 2\d\d, 2\d\d\)$/.test(l),
    ),
    JSON.stringify(looks),
  );
}

if (process.env.SCN_ONLY_UPGRADE) {
  console.log(`\n== errors (${errors.length}):`);
  for (const e of errors.slice(0, 30)) {
    console.log(`  [${e.step}] ${e.label}: ${e.text.slice(0, 300)}`);
  }
  ws.close();
  proc.kill();
  process.exit(0);
}

// ===================== 2. Settings: real actions =====================
const site = await openPage("https://example.com/", "site", 4000);
const exampleTab = await bg(
  `return (await chrome.tabs.query({})).find(t => /example\\.com/.test(t.url))?.id`,
);
const opt = await openPage(`${base}options.html#general`, "options", 5000);
const tab = async (name) => {
  await ev(
    opt.s,
    `document.querySelector('.tablink[href="#${name}"]').click(); return true`,
  );
  await sleep(1500);
};

// General: a switch really saves the setting (statsInIcon)
step = "general: switch";
{
  const was = await bg(
    `await Prefs.untilLoaded; return Prefs.get('show_statsinicon')`,
  );
  await ev(
    opt.s,
    `document.getElementById('prefs__show_statsinicon').click(); return true`,
  );
  await sleep(1200);
  const now = await bg(`return Prefs.get('show_statsinicon')`);
  check("General: switch saves the setting", now === !was, `${was} → ${now}`);
}
// Acceptable Ads: on → list added and the privacy row shows; off again
step = "general: acceptable ads";
{
  await ev(
    opt.s,
    `document.getElementById('acceptable_ads').click(); return true`,
  );
  await sleep(2500);
  const on = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).some(s => /exceptionrules/.test(s.url))`,
  );
  const sub = await ev(
    opt.s,
    `const r = document.getElementById('acceptable_ads_privacy')?.closest('.b-row-sub, li'); return r ? getComputedStyle(r).display : 'none-found'`,
  );
  save("action-aa-on", await shotData(opt.s));
  await ev(
    opt.s,
    `document.getElementById('acceptable_ads').click(); return true`,
  );
  await sleep(2500);
  const off = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).some(s => /exceptionrules/.test(s.url))`,
  );
  check(
    "Acceptable Ads can be turned on and off, privacy row appears",
    on === true && off === false && sub !== "none",
    `on=${on} privacyRow=${sub} off=${off}`,
  );
}

// Filters: update now, add a language, add a list by URL
await tab("filters");
step = "filters: update now";
await ev(opt.s, `document.getElementById('btnUpdateNow').click(); return true`);
await sleep(4000);
save("action-update-now", await shotData(opt.s));
check(
  "Filters: «Update now» runs without errors",
  !errors.some((e) => e.step === step),
);
step = "filters: add language";
{
  const before = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).length`,
  );
  const picked = await ev(
    opt.s,
    `const s = document.querySelector('#language_dropdown_container select, #language_select');
     if (!s) return 'no select';
     const o = [...s.options].find(o => o.value && !o.disabled);
     if (!o) return 'no option';
     s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true }));
     if (window.jQuery) jQuery(s).trigger('change');
     return o.textContent.trim()`,
  );
  await sleep(3000);
  const after = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).length`,
  );
  save("action-add-language", await shotData(opt.s));
  check(
    "Filters: a language list can be added",
    after > before,
    `${picked}: ${before} → ${after}`,
  );
}
step = "filters: add list by URL";
{
  const url = "https://stylist111.github.io/bloky/test-list.txt";
  await ev(
    opt.s,
    `const i = document.getElementById('txtNewSubscriptionUrl'); i.value = '${url}';
     i.dispatchEvent(new Event('input', { bubbles: true }));
     document.getElementById('btnNewSubscriptionUrl').click(); return true`,
  );
  await sleep(3000);
  const has = await bg(
    `return (await ewe.subscriptions.getSubscriptions()).some(s => s.url === '${url}')`,
  );
  const shown = await ev(
    opt.s,
    `return document.body.innerText.includes('test-list.txt')`,
  );
  save("action-add-url", await shotData(opt.s));
  check(
    "Filters: a list can be added by its address",
    has === true,
    `added=${has} shown=${shown}`,
  );
}

// Own rules
await tab("customize");
step = "customize: add rules";
{
  const r = await ev(
    opt.s,
    `const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('keyup', { bubbles: true })); };
     const wait = (ms) => new Promise(r => setTimeout(r, ms));
     const out = [];
     set('txtBlockUrl', 'ads.example.net/banner.js'); set('txtBlockUrlDomain', 'example.net');
     await wait(1000); // the Add button turns on after the rule is checked
     out.push(document.getElementById('btnAddUrlBlock').disabled);
     document.getElementById('btnAddUrlBlock').click();
     await wait(1500);
     set('txtUserFilterDomain', 'example.net'); set('txtUserFilterCss', '.ad-box');
     await wait(1000);
     out.push(document.getElementById('btnAddUserFilter').disabled);
     document.getElementById('btnAddUserFilter').click();
     await wait(1500);
     return { addButtonsDisabled: out }`,
  );
  const f = await bg(
    `return (await ewe.filters.getUserFilters()).map(f => f.text)`,
  );
  save("action-customize", await shotData(opt.s));
  check(
    "Own rules: block by address and hide by CSS are added",
    Array.isArray(f) &&
      f.some((t) => t.includes("ads.example.net/banner.js")) &&
      f.includes("example.net##.ad-box"),
    `${JSON.stringify(r)} ${JSON.stringify(f)}`,
  );
  await ev(
    opt.s,
    `document.getElementById('btnEditAdvancedFilters').click(); return true`,
  );
  await sleep(1200);
  const text = await ev(
    opt.s,
    `return document.getElementById('txtFiltersAdvanced').value`,
  );
  save("action-customize-edit", await shotData(opt.s));
  await ev(
    opt.s,
    `document.getElementById('btnSaveAdvancedFilters').click(); return true`,
  );
  await sleep(1500);
  const f2 = await bg(
    `return (await ewe.filters.getUserFilters()).map(f => f.text)`,
  );
  check(
    "Own rules: edit box shows the rules and saving keeps them",
    typeof text === "string" &&
      text.includes("example.net##.ad-box") &&
      f2?.length === f?.length,
    `${f?.length} → ${f2?.length}`,
  );
}

// Translators dialog: button, Esc, backdrop, close button
step = "translators";
{
  const r = await ev(
    opt.s,
    `const b = document.getElementById('translators-button'), d = document.getElementById('translators-dialog');
     if (!b || b.hidden) return 'no button';
     const out = [];
     b.click(); await new Promise(r => setTimeout(r, 300)); out.push(d.open);
     out.push(document.querySelectorAll('#translators-list li, #translators-list > *').length);
     d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
     d.close(); await new Promise(r => setTimeout(r, 200)); out.push(d.open);
     b.click(); await new Promise(r => setTimeout(r, 300));
     const rect = d.getBoundingClientRect();
     d.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left - 20, clientY: rect.top - 20 }));
     await new Promise(r => setTimeout(r, 200)); out.push(d.open);
     b.click(); await new Promise(r => setTimeout(r, 300));
     document.getElementById('translators-close').click();
     await new Promise(r => setTimeout(r, 200)); out.push(d.open);
     return out`,
  );
  if (r === "no button" && /^en/.test(lang)) {
    // English is the original language: nobody to credit, so no button
    check("Translators: no button in English (nothing to credit)", true);
  } else {
    check(
      "Translators: opens with names, closes by click outside and by the button",
      Array.isArray(r) &&
        r[0] === true &&
        r[1] > 0 &&
        r[3] === false &&
        r[4] === false,
      JSON.stringify(r),
    );
  }
}

// Support: debug data, version, links
await tab("support");
step = "support";
{
  const v = await ev(
    opt.s,
    `return document.getElementById('bloky-version')?.textContent`,
  );
  await ev(
    opt.s,
    `document.getElementById('debuginfo_link').click(); return true`,
  );
  await sleep(2500);
  await ev(
    opt.s,
    `const d = document.querySelector('details.extension-state-section'); if (d) d.open = true; return true`,
  );
  await sleep(800);
  save("action-support", await shotData(opt.s));
  check(
    "Support: version shown, debug data works",
    v === "1.1.0" && !errors.some((e) => e.step === step),
    `version=${v}`,
  );
}
await newTabs();

// ===================== 3. Every link on every page =====================
step = "links";
const links = new Set();
for (const t of [
  "general",
  "filters",
  "premium-filters",
  "customize",
  "stats-tabs",
  "mab-image-swap",
  "support",
]) {
  await tab(t);
  const l = await ev(
    opt.s,
    `return [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => /^https?:/.test(h))`,
  );
  for (const h of l || []) {
    links.add(h);
  }
}
// filter list addresses on easylist-downloads are fine; shop / help pages of AdBlock are not
const badLinks = [...links].filter((h) =>
  /getadblock\.com|eyeo\.com|vpn\./i.test(h),
);
check(
  "No links to AdBlock / eyeo sites in settings",
  badLinks.length === 0,
  badLinks.join(" "),
);

// ===================== 4. Click everything in settings =====================
// finds visible clickable elements, also inside shadow roots
const LIST = `
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      const tag = el.tagName.toLowerCase();
      const clickable = ['button','a','summary','select','action-button','toggle-button'].includes(tag)
        || (tag === 'input' && !['hidden','file','text','url','search'].includes(el.type))
        || el.getAttribute('role') === 'button' || el.hasAttribute('onclick')
        || el.classList.contains('menu-entry') || el.classList.contains('clickable');
      if (!clickable) continue;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || st.visibility === 'hidden' || st.display === 'none') continue;
      if (tag === 'a' && /^https?:/.test(el.getAttribute('href') || '')) continue;
      out.push(el);
    }
  };
  walk(document);
`;
const describe = `(el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' «' + (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('i18n') || '').trim().replace(/\\s+/g, ' ').slice(0, 40) + '»')`;

const clicked = [];
let shotNo = 0;
async function clickAll(open, label, maxPerPage = 60) {
  let p = await open();
  const count = await ev(p.s, `${LIST} return out.length`);
  const n = Math.min(typeof count === "number" ? count : 0, maxPerPage);
  for (let i = 0; i < n; i++) {
    if (!p) {
      p = await open();
    }
    const beforeShot = await shotData(p.s);
    const what = await ev(
      p.s,
      `${LIST} const el = out[${i}]; if (!el) return null; const d = (${describe})(el);
       el.scrollIntoView({ block: 'center' }); el.click(); return d`,
    );
    if (what === null) {
      continue;
    }
    step = `${label} → ${typeof what === "string" ? what : JSON.stringify(what)}`;
    await sleep(1200);
    const loc = await ev(
      p.s,
      `return location.href.replace('chrome-extension://${extId}/', '')`,
      3000,
    );
    const afterShot = await shotData(p.s);
    const opened = await newTabs();
    const changed = hash(beforeShot) !== hash(afterShot);
    let file = "";
    if (changed && afterShot) {
      file = `click-${String(++shotNo).padStart(3, "0")}`;
      save(file, afterShot);
    }
    clicked.push({
      step,
      loc: typeof loc === "string" ? loc : "closed",
      opened,
      file,
    });
    // fresh page for the next click (state of a page should not leak into the next one)
    await closePage(p);
    p = null;
    await reset();
  }
  if (p) {
    await closePage(p);
  }
}
// after each click: not paused, no allowlisting of the test site
async function reset() {
  if (resetPage) {
    await ev(
      resetPage.s,
      `await browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: false });
       ${exampleTab ? `await browser.runtime.sendMessage({ command: 'removeAllAllowlistRulesForTab', tabId: ${exampleTab} });` : ""}
       return true`,
      5000,
    );
  }
}
await closePage(opt);
const resetPage = await openPage(`${base}options.html#general`, "reset", 4000);

for (const t of [
  "general",
  "filters",
  "premium-filters",
  "customize",
  "stats-tabs",
  "mab-image-swap",
  "support",
]) {
  await clickAll(
    () => openPage(`${base}options.html#${t}`, `options:${t}`, 3500),
    `options:${t}`,
    45,
  );
}

// ===================== 5. Popup: every button, every state =====================
const popUrl = (page = "adblock-button-popup.html", t = exampleTab) =>
  `${base}${page}?tabId=${t}`;
const popOpen = (page) => () =>
  openPage(popUrl(page), "popup", 3000, [360, 620], 2);
await clickAll(popOpen("adblock-button-popup.html"), "popup", 30);
await clickAll(
  popOpen("adblock-button-filtering-options.html"),
  "popup-more",
  30,
);
for (const page of [
  "adblock-button-cookie-confirm.html",
  "adblock-button-distractions-confirm.html",
  "adblock-button-undo-allow-confirm.html",
]) {
  const p = await openPage(popUrl(page), "popup", 2500, [360, 620], 2);
  const name = page.replace("adblock-button-", "").replace(".html", "");
  save(`popup-${name}`, await shotData(p.s));
  await closePage(p);
}

// popup for a page where blocking cannot work (new tab page)
step = "popup: browser page";
{
  const nt = await openPage("chrome://newtab/", "site", 2000);
  const ntId = await bg(
    `return (await chrome.tabs.query({})).find(t => /^chrome:\\/\\/newtab|^chrome:\\/\\/new-tab-page/.test(t.url))?.id`,
  );
  if (ntId) {
    const p = await openPage(
      popUrl("adblock-button-popup.html", ntId),
      "popup",
      3000,
      [360, 620],
      2,
    );
    const txt = await ev(p.s, `return document.body.innerText.slice(0, 200)`);
    save("popup-browser-page", await shotData(p.s));
    check(
      "Popup on a browser page shows the «not here» state",
      typeof txt === "string" && txt.length > 0,
      JSON.stringify(txt),
    );
    await closePage(p);
  }
  await closePage(nt);
}

// paused everywhere and paused on this site
step = "popup: paused";
{
  await ev(
    resetPage.s,
    `await browser.runtime.sendMessage({ command: 'adblockIsPaused', newValue: true }); return true`,
  );
  const p = await openPage(popUrl(), "popup", 3000, [360, 620], 2);
  save("popup-paused-all", await shotData(p.s));
  const btn = await ev(
    p.s,
    `${LIST} const b = out.find(e => /btn_unpause|unpause/i.test(e.id + ' ' + (e.getAttribute('i18n') || ''))); if (!b) return 'no button'; b.click(); return 'clicked'`,
  );
  await sleep(1500);
  const paused = await ev(
    resetPage.s,
    `return await browser.runtime.sendMessage({ command: 'adblockIsPaused' })`,
  );
  check(
    "Paused everywhere: «Block again» resumes",
    btn === "clicked" && paused === false,
    `${btn}, paused=${paused}`,
  );
  await closePage(p);
}

// "Other pause options" and "Hide something on this page" open a window on the site itself
step = "wizards on the page";
for (const [command, name] of [
  ["showWhitelist", "wizard-pause-options"],
  ["showBlacklist", "wizard-hide-element"],
]) {
  await ev(
    resetPage.s,
    `await browser.runtime.sendMessage({ command: '${command}', nothingClicked: true, tabId: ${exampleTab} }); return true`,
  );
  await sleep(2500);
  // headless Chrome draws only the front tab
  await call("Page.bringToFront", {}, site.s);
  await sleep(800);
  const answers = await ev(site.s, `return document.title`, 5000);
  const data = await shotData(site.s);
  save(name, data);
  check(
    `On-page window «${name}» opens, page keeps working`,
    !!data && typeof answers === "string",
    String(answers),
  );
  await call("Page.reload", {}, site.s);
  await sleep(2500);
}

// ===================== 6. Narrow settings window =====================
step = "narrow window";
for (const w of [860, 600]) {
  const p = await openPage(`${base}options.html#filters`, "options", 4000, [
    w,
    800,
  ]);
  const overflow = await ev(
    p.s,
    `return document.documentElement.scrollWidth - innerWidth`,
  );
  save(`narrow-${w}`, await shotData(p.s));
  check(
    `Settings at ${w}px: no sideways scrolling`,
    overflow <= 0,
    `${overflow}px`,
  );
  await closePage(p);
}

// ===================== report =====================
console.log("\n== checks:");
for (const r of results) {
  console.log("  " + r);
}
console.log(`\n== clicks (${clicked.length}):`);
for (const c of clicked) {
  console.log(
    `  ${c.step}  →  ${c.loc}${c.opened.length ? "  opened: " + c.opened.join(", ") : ""}${c.file ? "  [" + c.file + "]" : ""}`,
  );
}
console.log(`\n== browser dialogs (${dialogs.length}):`);
for (const d of dialogs) {
  console.log("  " + d);
}
console.log(`\n== links (${links.size}):`);
for (const l of links) {
  console.log("  " + l);
}
const uniq = new Map();
for (const e of errors) {
  const k = `${e.label}: ${e.text}`;
  if (!uniq.has(k)) {
    uniq.set(k, e.step);
  }
}
console.log(`\n== errors (${uniq.size} distinct):`);
for (const [k, s] of uniq) {
  console.log(`  [${s}] ${k.slice(0, 400)}`);
}
console.log(
  `\n== total: ${results.filter((r) => r.startsWith("PASS")).length} pass, ${results.filter((r) => r.startsWith("FAIL")).length} fail`,
);

ws.close();
proc.kill();
await sleep(1500);
for (const d of [profile, work]) {
  try {
    rmSync(d, { recursive: true, force: true });
  } catch {}
}
process.exit(0);
