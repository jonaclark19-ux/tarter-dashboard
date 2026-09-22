import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH_GLOBAL + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4181, r));
const base = "http://127.0.0.1:4181";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const publish = (result, changedAt) => fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result, sourceLabel: "FAB 9.21.2026", changedAt }) });
await publish(fixture, new Date().toISOString());

const browser = await chromium.launch();
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

async function measure(page) {
  return page.evaluate(() => {
    const cards = Array.from(document.getElementById("dept-grid").children).map((c) => c.getBoundingClientRect());
    const kpis = Array.from(document.getElementById("top-kpis").children).map((c) => c.getBoundingClientRect());
    const body = document.body.getBoundingClientRect();
    const label = Array.from(document.querySelectorAll("span")).find((s) => /TV MODE/.test(s.textContent));
    const h1 = document.querySelector("#dept-grid h2, #dept-grid h3, #dept-grid [class*='text-2xl'], #dept-grid [class*='text-xl']");
    return {
      vw: innerWidth, vh: innerHeight, scale: document.body.dataset.tvScale,
      cards: cards.map((r) => ({ l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) })),
      kpiTops: kpis.map((r) => Math.round(r.top)),
      bodyRight: Math.round(body.right), bodyBottom: Math.round(body.bottom),
      label: label ? label.textContent : null,
      titleFont: h1 ? getComputedStyle(h1).fontSize : null,
      warnings: document.getElementById("warnings-list") ? document.getElementById("warnings-list").textContent : ""
    };
  });
}

const screens = [
  { name: "hisense-960x540@2x", viewport: { width: 960, height: 540 }, dpr: 2 },
  { name: "720p", viewport: { width: 1280, height: 720 }, dpr: 1 },
  { name: "1366x768", viewport: { width: 1366, height: 768 }, dpr: 1 },
  { name: "1080p", viewport: { width: 1920, height: 1080 }, dpr: 1 },
  { name: "4k", viewport: { width: 3840, height: 2160 }, dpr: 1 }
];
for (const s of screens) {
  const ctx = await browser.newContext({ viewport: s.viewport, screen: s.viewport, deviceScaleFactor: s.dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?src=/api/feed-snapshot&tv=1");
  await page.waitForFunction(() => /FAB/.test(document.getElementById("dept-grid").textContent) && document.body.dataset.tvScale, null, { timeout: 15000 });
  await page.waitForTimeout(3200); // let the 400 ms / 2.5 s refits run
  const m = await measure(page);
  await page.screenshot({ path: `shots/${s.name}.png` });
  const tops = new Set(m.cards.map((c) => c.t));
  check(m.cards.length === 4, `${s.name}: expected 4 cards, got ${m.cards.length}`);
  check(tops.size === 1, `${s.name}: cards not in one row: ${JSON.stringify(m.cards)}`);
  check(new Set(m.kpiTops).size === 1, `${s.name}: KPI tiles not in one row: ${m.kpiTops}`);
  check(m.cards.every((c) => c.b <= m.vh + 1 && c.r <= m.vw + 1 && c.l >= -1), `${s.name}: a card leaves the screen: ${JSON.stringify(m.cards)} vs ${m.vw}x${m.vh}`);
  check(m.bodyBottom <= m.vh + 2, `${s.name}: page bottom ${m.bodyBottom} > screen ${m.vh}`);
  check(m.bodyRight >= m.vw - 4, `${s.name}: page does not fill width (${m.bodyRight} of ${m.vw})`);
  check(m.bodyBottom >= m.vh - 4, `${s.name}: page does not fill height (${m.bodyBottom} of ${m.vh})`);
  check(!!m.label && /DATA \d/.test(m.label) && !/OFFLINE|ERROR/.test(m.label), `${s.name}: label "${m.label}"`);
  check(errors.length === 0, `${s.name}: page errors ${errors}`);
  console.log(s.name, "scale", m.scale, "titleFont", m.titleFont, "label:", m.label);
  await ctx.close();
}

// Live change + stale source on the Hisense-like screen
{
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, screen: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(base + "/?src=/api/feed-snapshot&tv=1");
  await page.waitForFunction(() => /886/.test(document.getElementById("dept-grid").textContent), null, { timeout: 15000 });
  const changed = JSON.parse(JSON.stringify(fixture));
  changed.departments[0].stats[0].value = 999;
  await publish(changed, new Date().toISOString());
  const t0 = Date.now();
  await page.waitForFunction(() => /999/.test(document.getElementById("dept-grid").textContent), null, { timeout: 25000 }).catch(() => {});
  const got = await page.evaluate(() => /999/.test(document.getElementById("dept-grid").textContent));
  check(got, "viewer did not pick up the changed number");
  console.log("change reached the TV in", Date.now() - t0, "ms");
  // source goes quiet: heartbeat 10 minutes old
  db.row.updated_at = new Date(Date.now() - 10 * 60e3).toISOString();
  await page.waitForFunction(() => /SOURCE PC OFFLINE/.test(document.getElementById("warnings-list").textContent), null, { timeout: 25000 }).catch(() => {});
  await page.waitForFunction(() => Array.from(document.querySelectorAll("span")).some((s) => /SOURCE OFFLINE/.test(s.textContent)), null, { timeout: 5000 }).catch(() => {});
  let m = await measure(page);
  check(/SOURCE PC OFFLINE/.test(m.warnings), "stale source warning missing: " + m.warnings);
  check(/SOURCE OFFLINE/.test(m.label || ""), "stale label missing: " + m.label);
  const badge = await page.evaluate(() => { const b = document.getElementById("source-offline-badge"); const r = b.getBoundingClientRect(); return { hidden: b.classList.contains("hidden"), text: b.textContent, inView: r.width > 0 && r.bottom <= innerHeight + 1 && r.top >= 0 }; });
  check(!badge.hidden && badge.inView && /SOURCE PC OFFLINE/.test(badge.text), "offline badge not visible on TV: " + JSON.stringify(badge));
  await page.screenshot({ path: "shots/hisense-stale.png" });
  // source comes back
  await publish(changed, null);
  await page.waitForFunction(() => !/SOURCE PC OFFLINE/.test(document.getElementById("warnings-list").textContent), null, { timeout: 25000 }).catch(() => {});
  m = await measure(page);
  check(!/SOURCE PC OFFLINE/.test(m.warnings), "stale warning did not clear");
  check(await page.evaluate(() => document.getElementById("source-offline-badge").classList.contains("hidden")), "offline badge did not clear");
  await ctx.close();
}

// Normal (non-TV) admin view: must still scroll and have no errors
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/");
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ overflow: getComputedStyle(document.documentElement).overflow, transform: document.body.style.transform, scrollH: document.documentElement.scrollHeight, h: innerHeight, status: document.getElementById("sync-detail").textContent }));
  check(!info.transform && info.overflow !== "hidden", "admin view got TV scaling: " + JSON.stringify(info));
  check(errors.length === 0, "admin view errors: " + errors);
  await page.screenshot({ path: "shots/admin.png", fullPage: false });
  console.log("admin view", info);
  await ctx.close();
}

await browser.close();
server.close();
if (failures.length) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("ALL UI CHECKS PASSED");
