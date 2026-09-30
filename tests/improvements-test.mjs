// Checks for: request deadlines, missing-department cards, plant time zone on viewers,
// the keep-alive endpoint, and that wake lock / daily reload wiring doesn't break load.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH_GLOBAL + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4196, r));
const base = "http://127.0.0.1:4196";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };
const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const browser = await chromium.launch();
const errors = [];

// Source page internals
const src = await browser.newPage();
src.on("pageerror", (e) => errors.push("source: " + e.message));
await src.goto(base + "/?__test=1");
await src.waitForFunction(() => window.__t);
const unit = await src.evaluate(async () => {
  const t = window.__t;
  const out = {};
  out.reasonTab = t.missingReason("TANKS: no tab named 2026-09-28 (the Monday of that week) in Tanks.xlsx. Most recent…", true);
  out.reasonNoFile = t.missingReason(undefined, false);
  out.reasonOther = t.missingReason("TANKS: something else", true);
  const t0 = Date.now();
  try { await t.fetchWithTimeout("/__hang", {}, 1200); out.hang = "resolved?!"; } catch (e) { out.hang = e.message; }
  out.hangMs = Date.now() - t0;
  t.setPlantTimeZone("Asia/Tokyo");
  const tokyoHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(new Date())) % 24;
  out.tzOk = t.plantNow().getHours() === tokyoHour;
  t.setPlantTimeZone("Not/AZone");
  out.tzBadKeeps = t.plantNow().getHours() === tokyoHour;
  // Placeholder ordering: FAB, WELDING, PAINT cards + TANKS missing -> TANKS last, one card each
  return out;
});
check(unit.reasonTab === "Tab 9.28.2026 missing in the Excel", "reason for a missing week tab: " + unit.reasonTab);
check(unit.reasonNoFile === "Excel file not found", "reason when the file is absent");
check(unit.reasonOther === "Check the Excel sheet", "generic reason");
check(/no response in 1 s/.test(unit.hang) && unit.hangMs < 3000, "hung request is cut off (" + unit.hang + ", " + unit.hangMs + " ms)");
check(unit.tzOk, "plantNow follows the plant time zone");
check(unit.tzBadKeeps, "an unknown zone name is ignored");

// Source publishes its zone + missing list
db.row = null;
const pub = await src.evaluate(async (fx) => {
  const t = window.__t;
  t.setPlantTimeZone("Asia/Tokyo");
  t.sync.mode = "folder";
  const r = JSON.parse(JSON.stringify(fx));
  r.departments = r.departments.filter((d) => d.id !== "tanks");
  r.missing = [{ id: "tanks", name: "TANKS", reason: "Tab 9.28.2026 missing in the Excel" }];
  await t.publishSnapshot(r, "x");
  return t.sync.publishStatus;
}, fixture);
check(/TVs updated/.test(pub), "source published: " + pub);
check(db.row && db.row.data.timeZone === "Asia/Tokyo", "feed carries the plant time zone");
check(db.row && Array.isArray(db.row.data.missing) && db.row.data.missing[0].id === "tanks", "feed carries the missing department");

// Viewer: placeholder card + plant clock regardless of the device's own zone
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: "America/New_York" });
const tv = await ctx.newPage();
tv.on("pageerror", (e) => errors.push("tv: " + e.message));
await tv.goto(base + "/?src=/api/feed-snapshot&tv=1&screen=Test");
await tv.waitForFunction(() => document.querySelector("[data-missing-dept='tanks']"), null, { timeout: 15000 }).catch(() => {});
await tv.waitForTimeout(1500); // the header clock ticks once a second
const view = await tv.evaluate(() => {
  const cards = Array.from(document.getElementById("dept-grid").children);
  const r = cards.map((c) => c.getBoundingClientRect());
  return {
    n: cards.length,
    last: cards[3] ? cards[3].textContent.replace(/\s+/g, " ").trim() : "",
    oneRow: r.length === 4 && r.every((x) => Math.abs(x.top - r[0].top) < 2),
    clock: document.getElementById("clock-time").textContent
  };
});
const tokyoClock = new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Tokyo", hour12: true, hour: "2-digit", minute: "2-digit" });
check(view.n === 4 && /TANKS/.test(view.last) && /NO DATA/.test(view.last) && /9\.28\.2026/.test(view.last), "TV shows a TANKS 'NO DATA' card: " + view.last);
check(view.oneRow, "four cards stay in one row");
check(view.clock.slice(0, 5) === tokyoClock.slice(0, 5), "TV clock uses the plant zone (" + view.clock + " vs Tokyo " + tokyoClock + "), not the device's New York zone");
await tv.screenshot({ path: "shots/missing-card.png" });

// (6) TVs never download the Excel reader; the source loads it on demand
const tvRequests = [];
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const tv2 = await ctx2.newPage();
tv2.on("request", (r) => tvRequests.push(r.url()));
tv2.on("pageerror", (e) => errors.push("tv2: " + e.message));

// (1) per-department freshness: pick a zone where it is mid-shift right now
const zones = ["Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "Atlantic/Azores", "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"];
const hourIn = (z) => Number(new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "numeric", hourCycle: "h23" }).format(new Date())) % 24;
const zone = zones.find((z) => hourIn(z) >= 8 && hourIn(z) <= 13);
const zoneDate = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fresh = JSON.parse(JSON.stringify(fixture));
fresh.selectedDate = zoneDate;
fresh.timeZone = zone;
fresh.sources = [
  { id: "fab", label: "FAB", fileName: "f.xlsx", sheetName: "x", savedAt: new Date(Date.now() - 130 * 6e4).toISOString() },
  { id: "welding", label: "WELDING", fileName: "w.xlsx", sheetName: "x", savedAt: new Date(Date.now() - 5 * 6e4).toISOString() }
];
await post("/api/publish", { result: fresh, changedAt: new Date().toISOString() });
await tv2.goto(base + "/?src=/api/feed-snapshot&tv=1");
await tv2.waitForFunction(() => /EXCEL SAVED/i.test(document.getElementById("dept-grid").textContent), null, { timeout: 15000 }).catch(() => {});
const cardsText = await tv2.evaluate(() => Array.from(document.getElementById("dept-grid").children).map((c) => c.textContent.replace(/\s+/g, " ")));
check(/No Excel update for 2H 10M/i.test(cardsText[0] || ""), "FAB card flags 2h10m without an Excel save (" + zone + ")");
check(/Excel saved/i.test(cardsText[1] || "") && !/No Excel update/i.test(cardsText[1] || ""), "WELDING card shows its save time");
check(!tvRequests.some((u) => /vendor\/xlsx\.js/.test(u)), "TV never downloads the Excel reader");
const badgeToday = await tv2.evaluate(() => getComputedStyle(document.getElementById("data-day-badge")).display);
check(badgeToday === "none", "no 'showing another day' badge when the data is today's");

// (3) data for another day -> header badge
const old = JSON.parse(JSON.stringify(fresh));
old.selectedDate = "2026-09-25";
await post("/api/publish", { result: old, changedAt: new Date().toISOString() });
await tv2.waitForFunction(() => getComputedStyle(document.getElementById("data-day-badge")).display !== "none", null, { timeout: 50000 }).catch(() => {});
const badge = await tv2.evaluate(() => document.getElementById("data-day-badge").textContent);
check(/Showing Fri, Sep 25/i.test(badge), "header says which day is shown: " + badge);
await tv2.screenshot({ path: "shots/freshness.png" });

const xl = await src.evaluate(async () => { await window.__t.ensureXlsx(); await window.__t.ensureXlsx(); return typeof XLSX !== "undefined" && typeof XLSX.read === "function" && document.querySelectorAll("script[src$='vendor/xlsx.js']").length; });
check(xl === 1, "source loads the Excel reader once on demand");

// Real workbook through the upload path on a fresh page (reader not loaded yet)
const b64 = await src.evaluate(() => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["DAILY WELDING"], ["Date:", "9/29/2026"], ["Pieces welded", 12]]), "9.29.2026");
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" });
});
const up = await browser.newPage();
const upReq = [];
up.on("request", (r) => upReq.push(r.url()));
up.on("pageerror", (e) => errors.push("upload: " + e.message));
up.on("console", (m) => { if (/parse/i.test(m.text())) console.log("   [upload console]", m.text().slice(0, 200)); });
await up.goto(base + "/");
await up.setInputFiles("#file-input", { name: "Daily Production Weld.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(b64, "base64") });
await up.waitForTimeout(3000);
const upText = await up.evaluate(() => document.body.textContent);
check(upReq.some((u) => /vendor\/xlsx\.js/.test(u)), "uploading a workbook loads the Excel reader");
check(await up.evaluate(() => typeof XLSX !== "undefined" && typeof XLSX.read === "function"), "workbook parsed without a loader error");

// Keep-alive endpoint
const ka = await fetch(base + "/api/keepalive");
const kaBody = await ka.json();
check(ka.status === 200 && kaBody.ok === true, "keepalive answers ok");
const cfg = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url)));
check(Array.isArray(cfg.crons) && cfg.crons.some((c) => c.path === "/api/keepalive"), "daily cron configured");

check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
