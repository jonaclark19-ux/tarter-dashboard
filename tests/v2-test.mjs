// Layout v2 (?preview=1): TV Board Info parsing, safety tile, loading strip, uniform cards.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH_GLOBAL + "/");
const { chromium } = require("playwright");
const { server } = await import("./server.mjs");
await new Promise((r) => server.listen(4201, r));
const base = "http://127.0.0.1:4201";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };
const browser = await chromium.launch();
const errors = [];

// --- parse a workbook shaped like the real "TV Board Info.xlsx"
const src = await browser.newPage();
src.on("pageerror", (e) => errors.push("src: " + e.message));
await src.goto(base + "/?__test=1");
await src.waitForFunction(() => window.__t);
const parsed = await src.evaluate(async () => {
  const t = window.__t;
  await t.ensureXlsx();
  const wb = XLSX.utils.book_new();
  const topics = XLSX.utils.aoa_to_sheet([[new Date(2026, 8, 29), "Hazardous Waste - Ussed Oil"], [new Date(2026, 8, 30), "Quick Review of Hazcom"], [new Date(2025, 0, 26), "Electrical Cord Safety"]], { cellDates: true });
  XLSX.utils.book_append_sheet(wb, topics, "Toolbox Topics");
  const days = XLSX.utils.aoa_to_sheet([["Tarter Gate West"]]);
  days.F1 = { t: "n", f: "TODAY()-DATE(2025,6,31)", v: 456 };
  days["!ref"] = "A1:F1";
  XLSX.utils.book_append_sheet(wb, days, "Days Without A Recordable");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const board = t.parseBoardInfo(buf);
  return {
    board,
    today: t.safetyFor(board, "2026-09-30"),
    typoYear: t.safetyFor(board, "2026-01-26"),
    none: t.safetyFor(board, "2026-12-25")
  };
});
check(parsed.board.sinceISO === "2025-07-01", "start date read from =TODAY()-DATE(2025,6,31) (July 1, 2025): " + parsed.board.sinceISO);
check(parsed.today.topic === "Quick Review of Hazcom", "today's topic: " + parsed.today.topic);
check(parsed.typoYear.topic === "Electrical Cord Safety", "topic typed with the wrong year still found");
check(parsed.none && parsed.none.topic === null && parsed.none.sinceISO, "no topic that day: tile still shows the day count");

// --- publish a full-alert board and view it in preview
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
const fx = JSON.parse(JSON.stringify(fixture));
fx.selectedDate = today; fx.timeZone = "America/Denver";
const byId = Object.fromEntries(fx.departments.map((d) => [d.id, d]));
byId.fab.notes = [{ type: "warning", label: "DOWNTIME / ISSUES", content: "Press brake #2 down 7:10–7:45 AM — hydraulic leak | MATERIAL — 14GA sheet · 3/16 plate", customColor: "#D97706" }];
byId.paint.stats.push({ tone: "default", label: "DOWNTIME", value: "25 MINS" });
byId.paint.notes = [{ type: "warning", label: "DOWNTIME LOG", content: "Color change 6:45–7:00 AM", customColor: "#D97706" }];
byId.tanks.notes = [{ type: "warning", label: "DOWNTIME / REASON", content: "Waiting on galv parts", customColor: "#D97706" }];
fx.safety = { topic: "Quick Review of Hazcom", sinceISO: "2025-07-01", days: null };
fx.sources = fx.departments.map((d, i) => ({ id: d.id, label: d.name, savedAt: new Date(Date.now() - [130, 40, 70, 25][i] * 6e4).toISOString(), fileName: "x", sheetName: "x" }));
await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: fx, changedAt: new Date().toISOString() }) });

const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: "America/Denver" });
const tv = await ctx.newPage();
tv.on("pageerror", (e) => errors.push("tv: " + e.message));
await tv.goto(base + "/?src=/api/feed-snapshot&tv=1&preview=1");
await tv.waitForFunction(() => document.querySelector(".safety-tile"), null, { timeout: 15000 }).catch(() => {});
await tv.waitForTimeout(3000);
const v = await tv.evaluate(() => {
  const kpis = Array.from(document.getElementById("top-kpis").children).map((c) => c.textContent.replace(/\s+/g, " ").trim());
  const cards = Array.from(document.getElementById("dept-grid").children);
  const txt = cards.map((c) => c.textContent.replace(/\s+/g, " "));
  const notesTop = cards.map((c) => { const n = c.querySelector(".card-notes > div"); return n ? Math.round(n.getBoundingClientRect().top) : null; });
  return {
    kpis, txt, notesTop,
    scale: Number(document.body.dataset.tvScale),
    loading: document.getElementById("loading-bar").textContent.replace(/\s+/g, " "),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1
  };
});
const dayCount = Math.round((Date.UTC(...today.split("-").map((x, i) => i === 1 ? x - 1 : +x)) - Date.UTC(2025, 6, 1)) / 864e5);
check(/^456|^\d/.test(v.kpis[0]) && v.kpis[0].includes(String(dayCount)) && /QUICK REVIEW OF HAZCOM/i.test(v.kpis[0]), "safety tile: " + dayCount + " days + topic (" + v.kpis[0].slice(0, 60) + ")");
check(v.kpis.length === 4 && !v.kpis.some((k) => /Current Attainment/i.test(k)), "KPI row: safety + 3 tiles, no Current Attainment");
check(v.txt.every((t) => /ACTUAL/.test(t) && /SCHEDULED/.test(t)) && !v.txt.some((t) => /FORECAST|PAINTED|PRODUCTION/.test(t)), "every card shows ACTUAL / SCHEDULED");
check(!v.txt.some((t) => /MON.FRI|CURRENT DAY ONLY/.test(t)), "no MON–FRI subtitle");
check(/DOWNTIME LOG · 25 MINS/.test(v.txt[2]) && !/DOWNTIME 25 MINS ?DOWNTIME/.test(v.txt[2]), "paint downtime minutes folded into the log title");
check(!/WORKING ON/.test(v.txt[3]), "tanks: downtime replaces WORKING ON");
check(new Set(v.notesTop.filter((x) => x !== null)).size === 1, "notes start at the same height on every card: " + v.notesTop.join(","));
check(/NO UPDATE 2H 10M/i.test(v.txt[0]) && !/NO UPDATE/i.test(v.txt.slice(1).join(" ")), "stale flag only after 2 hours");
check(/SAMPLE DATA/.test(v.loading) && /TRAILERS/.test(v.loading) && /SHORT PRODUCTS/.test(v.loading), "loading strip shows (sample until its Excel exists)");
check(v.scale >= 0.88, "worst case still fits at a large scale: " + v.scale);
check(!v.overflowX, "no horizontal overflow");
await tv.screenshot({ path: "shots/v2-alerts.png" });

// normal (non-preview) link unchanged
const old = await ctx.newPage();
await old.goto(base + "/?src=/api/feed-snapshot&tv=1");
await old.waitForTimeout(2500);
const o = await old.evaluate(() => ({ safety: !!document.querySelector(".safety-tile"), loading: getComputedStyle(document.getElementById("loading-bar")).display, cur: /Current Attainment/i.test(document.getElementById("top-kpis").textContent) }));
check(!o.safety && o.loading === "none" && o.cur, "the normal TV link keeps the current layout");

check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
