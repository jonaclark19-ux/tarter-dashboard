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
    kpiH: Math.round(document.getElementById("top-kpis").getBoundingClientRect().height / Number(document.body.dataset.tvScale)),
    loading: document.getElementById("loading-bar").textContent.replace(/\s+/g, " "),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    namesFit: Array.from(document.querySelectorAll(".dept-name")).every((n) => n.scrollWidth <= n.clientWidth + 1)
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
check(/sample data/i.test(v.loading) && /TRAILERS/.test(v.loading) && /\/ 16/.test(v.loading) && /88%/.test(v.loading) && /TOTAL SHORTS/.test(v.loading) && /61PCS|61 PCS/.test(v.loading.replace(/\s+/g, "")) && /TOP 6 SHORT PRODUCTS/.test(v.loading), "preview fills the loading strip with labelled sample data");
check(!/ON PACE|HIGH RISK|AT RISK|RECOVERY|BUILDING/.test(v.kpis[1]) && /Active personnel/i.test(v.kpis[2]) && /Shift left/i.test(v.kpis[3]), "KPI tiles: compact, titled, no status badge on PROJECTED");
check(v.kpiH <= 110, "KPI row is low (" + v.kpiH + " px)");
check(v.scale >= 0.88, "worst case still fits at a large scale: " + v.scale);
check(!v.overflowX, "no horizontal overflow");
check(v.namesFit, "department names are not cut by the badge");
await tv.screenshot({ path: "shots/v2-alerts.png" });

// the normal link is v2 now, without sample loading data; ?classic=1 keeps the old layout
const off = await ctx.newPage();
await off.goto(base + "/?src=/api/feed-snapshot&tv=1");
await off.waitForTimeout(2500);
const o1 = await off.evaluate(() => ({ safety: !!document.querySelector(".safety-tile"), loading: getComputedStyle(document.getElementById("loading-bar")).display }));
check(o1.safety && o1.loading === "none", "official link: new layout, loading strip hidden when there is no loading data");
const old = await ctx.newPage();
await old.goto(base + "/?src=/api/feed-snapshot&tv=1&classic=1");
await old.waitForTimeout(2500);
const o = await old.evaluate(() => ({ safety: !!document.querySelector(".safety-tile"), loading: getComputedStyle(document.getElementById("loading-bar")).display, cur: /Current Attainment/i.test(document.getElementById("top-kpis").textContent) }));
check(!o.safety && o.loading === "none" && o.cur, "?classic=1 keeps the previous layout");

// --- Load Sign Off workbook (synthetic, same layout as the real monthly file)
const ld = await src.evaluate(() => {
  const t = window.__t;
  const wb = XLSX.utils.book_new();
  const mk = (rows, summary) => {
    const ws = XLSX.utils.aoa_to_sheet([[]]);
    const put = (a, v) => { ws[a] = typeof v === "number" ? { t: "n", v } : { t: "s", v }; };
    rows.forEach(([r, pieces, short, pct, comment]) => { put("C" + r, "T"); put("G" + r, pieces); if (short) put("H" + r, short); put("I" + r, pct); if (comment) put("J" + r, comment); });
    put("B35", "Total Tarter"); put("G36", "Total Loaded"); put("H36", "Total Short"); put("D39", "Total Loads");
    put("G38", summary.pieces); put("H38", summary.shorts); put("D41", summary.loads);
    ws["!ref"] = "A1:R45";
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, mk([[12, 84, 0, "100%", "Redist. RFM"], [16, 176, 0, "100%", "1PGB5-128  RFM-32"], [18, 69, 7, "90%", "SO1347500 EWBL66-2,GUT22-1. SO1347502 GUT22-2. SO1347903 RRB10-2"]], { pieces: 329, shorts: 7, loads: 3 }), "9-28-26");
  XLSX.utils.book_append_sheet(wb, mk([[7, 343, 24, "93%", "6egr6cl-6,wgsc10cl-4, 6egr10cl-10,6egr8cl-4"]], { pieces: 343, shorts: 24, loads: 1 }), "9-29-26");
  XLSX.utils.book_append_sheet(wb, mk([], { pieces: 0, shorts: 0, loads: 0 }), "9-31-26");
  const days = t.parseLoadSignOff(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
  return { days: days.map((d) => d.iso), week: t.loadingFor([{ days }], "2026-09-30") };
});
// --- paint "currently painting": the top-most color that still has pieces to paint
const paintColors = await src.evaluate(async () => {
  await window.__t.ensureXlsx();
  const sheetFor = (rows) => {
    const aoa = [[null, null, null, null, null, "EMPLOYEES", 9, null, 90, null, 44]];
    for (const r of rows) aoa.push(Array.from({ length: 18 }, (_, i) => (r[i] === undefined ? null : r[i])));
    return XLSX.utils.aoa_to_sheet(aoa);
  };
  // columns: A name, B scheduled, E totals marker, F quantity, Q produced
  const r = (a, b, f, q) => { const x = []; x[0] = a; if (b !== null) x[1] = b; if (f !== null) x[5] = f; if (q !== null) x[16] = q; return x; };
  const tot = (b, q) => { const x = r("TOTAL", b, null, q); x[4] = "TOTAL"; return x; };
  const midShift = sheetFor([r("GREY", null, null, null), r("PROD1", 100, 100, 40), r("BLACK", null, null, null), r("PROD2", 200, 200, null), tot(300, 40)]);
  const greyDone = sheetFor([r("GREY", null, null, null), r("PROD1", 100, 100, 100), r("BLACK", null, null, null), r("PROD2", 200, 200, 10), tot(300, 110)]);
  const allDone = sheetFor([r("GREY", null, null, null), r("PROD1", 100, 100, 100), r("BLACK", null, null, null), r("PROD2", 200, 200, 200), tot(300, 300)]);
  const name = (sh) => { const d = window.__t.buildPaintFromSheet(sh, null, "2026-09-30", []); return d && d.currentColor ? d.currentColor.name : null; };
  return [name(midShift), name(greyDone), name(allDone)];
});
check(paintColors.join(",") === "GREY,BLACK,BLACK", "currently painting follows the top-most unfinished color: " + paintColors.join(","));
check(ld.days.join(",") === "2026-09-28,2026-09-29", "sign-off tabs read by date, impossible 9-31 skipped: " + ld.days.join(","));
check(ld.week.trailersWeek === 4 && ld.week.piecesWeek === 672 && ld.week.shortsWeek === 31, "week totals from the tab summaries");
const top = Object.fromEntries(ld.week.shorts);
check(top.GUT22 === 3 && top.EWBL66 === 2 && top["6EGR10CL"] === 10 && !top.RFM && !top["1PGB5"], "short products only from loads with shorts: " + ld.week.shorts.map((x) => x.join("x")).join(" "));

// --- a department with 0 people present gets a NOT RUNNING cover and leaves the KPIs
const fxDown = JSON.parse(JSON.stringify(fx));
const tanksDown = fxDown.departments.find((d) => d.id === "tanks");
tanksDown.headline.active = 0; tanksDown.headline.down = true;
const fabBlank = fxDown.departments.find((d) => d.id === "fab");
fabBlank.headline.active = 0; // blank cell (no down flag): no cover
await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: fxDown, changedAt: new Date().toISOString() }) });
const tvDown = await ctx.newPage();
tvDown.on("pageerror", (e) => errors.push("tvDown: " + e.message));
await tvDown.goto(base + "/?src=/api/feed-snapshot&tv=1");
await tvDown.waitForFunction(() => document.querySelector("[data-dept-down]"), null, { timeout: 15000 }).catch(() => {});
const down = await tvDown.evaluate(() => ({
  covers: Array.from(document.querySelectorAll("[data-dept-down]")).map((e) => e.dataset.deptDown),
  text: (document.querySelector("[data-dept-down]") || {}).textContent || "",
  personnel: Array.from(document.getElementById("top-kpis").children).map((c) => c.textContent.replace(/\s+/g, " ")).find((t) => /Active personnel/i.test(t)) || ""
}));
const expectedNoTanks = fxDown.departments.filter((d) => d.id !== "tanks").reduce((a, d) => a + d.headline.total, 0);
check(down.covers.join(",") === "tanks" && /NOT RUNNING/i.test(down.text) && /0 personnel present/i.test(down.text), "0 present typed -> NOT RUNNING cover on that card only: " + down.covers.join(","));
check(down.personnel.includes("/" + expectedNoTanks), "down department left out of the personnel KPI: " + down.personnel);
await tvDown.screenshot({ path: new URL("./shots/dept-down.png", import.meta.url).pathname }).catch(() => {});
check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
