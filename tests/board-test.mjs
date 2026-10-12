// Daily Production Board: the input workbook (read by defined names), the board block the
// source PC builds for the previous workday, and board.html rendering it from the feed.
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4211, r));
const base = "http://127.0.0.1:4211";
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };
const browser = await chromium.launch();
const errors = [];

const src = await browser.newPage();
src.on("pageerror", (e) => errors.push("src: " + e.message));
await src.goto(base + "/?__test=1");
await src.waitForFunction(() => window.__t);

// --- previous workday
const prev = await src.evaluate(() => ["2026-10-12", "2026-10-13", "2026-10-10", "2026-10-11"].map((d) => window.__t.previousWorkdayISO(d)));
check(prev.join(",") === "2026-10-09,2026-10-12,2026-10-09,2026-10-09", "previous workday: Mon/Sat/Sun -> Fri, Tue -> Mon: " + prev.join(","));

// --- the real input workbook (built by Tarter-pc production-board/input-workbook/build.py)
const input = await src.evaluate(async () => {
  await window.__t.ensureXlsx();
  const buf = await (await fetch("/tests/board-input-sample.xlsx")).arrayBuffer();
  return window.__t.parseBoardInput(buf);
});
check(input.QUALITY_FAB === 0.99 && input.QUALITY_INV === "Yes", "percent and Yes/No read by name: " + input.QUALITY_FAB + " " + input.QUALITY_INV);
check(input.HEAD_LOAD === "7/8", "headcount typed as 7/8 stays text: " + input.HEAD_LOAD);
check(input.FIVE_S_WELD === "Improve" && input.OT_WELD === 2.5 && input.OT_FAB === 0, "5S and OT (0 kept): " + [input.FIVE_S_WELD, input.OT_WELD, input.OT_FAB].join(" "));
check(input.LAST_FIRSTAID === "2026-09-28" && input.UPDATED_FAB === "2026-10-07", "dates come back as days: " + input.LAST_FIRSTAID + " " + input.UPDATED_FAB);
check(input.TOPSIX_PART_1 === "ECBL12" && input.TOPSIX_QTY_1 === 3825, "top six read by name");
check(!("OT_INV" in input) && !("ATTAIN_FAB" in input), "empty and AUTO cells are not in the input");

// --- whole source flow on a fake connected folder: Wed 10/7, so the board shows Tue 10/6
const flow = await src.evaluate(async () => {
  const t = window.__t;
  window.plantNow = () => new Date(2026, 9, 7, 9, 0, 0);
  // Tanks week tab with two dated day-blocks (Tue, Wed) side by side.
  const head = ["DATE", "EMPLOYEES", "ATTAINMENT", "UPLH", "UPLH GOAL", null];
  const aoa = [head.concat(head), [new Date(2026, 9, 6), 5, 0.8, 3.5, 3.5, null, new Date(2026, 9, 7), 6, 0.4, 1.75, 3.5, null]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), "10.5.2026");
  const tanks = new File([XLSX.write(wb, { type: "array", bookType: "xlsx" })], "Tanks Daily Production.xlsx", { lastModified: Date.now() });
  const inputFile = new File([await (await fetch("/tests/board-input-sample.xlsx")).arrayBuffer()], "Daily Board Input.xlsx", { lastModified: Date.now() });
  const entry = (file) => ({ kind: "file", name: file.name, getFile: async () => file });
  t.sync.dirHandle = { values: async function* () { yield entry(tanks); yield entry(inputFile); } };
  t.sync.mode = "folder";
  await t.pullFromFolder(true);
  const r = t.state.result;
  return { today: r.selectedDate, tanksToday: r.departments.find((d) => d.id === "tanks").headline.active, board: r.board, payload: t.publishPayload(r) };
});
check(flow.today === "2026-10-07" && flow.tanksToday === 6, "TV dashboard still shows today (10/7, 6 people): " + flow.today + " " + flow.tanksToday);
check(flow.board && flow.board.reportDate === "2026-10-06", "board is for the previous workday: " + (flow.board && flow.board.reportDate));
check(flow.board.areas.TANKS.present === 5 && flow.board.areas.TANKS.efficiency === 100, "board reads 10/6 from the same workbook: " + JSON.stringify(flow.board.areas.TANKS));
check(flow.board.areas.FAB.missing, "a department with no file says so: " + flow.board.areas.FAB.missing);
check(flow.board.input && flow.board.input.QUALITY_FAB === 0.99 && /Daily Board Input/.test(flow.board.inputFile), "input workbook found in the folder and attached");
check(flow.payload.board && flow.payload.board.reportDate === "2026-10-06", "board goes out with the publish");

// --- buildBoard: loading and adherence
const built = await src.evaluate(() => {
  const books = [{ days: [{ iso: "2026-10-05", loads: 3, pieces: 600, shorts: 0, products: [["GUT22", 4]] }, { iso: "2026-10-06", loads: 5, pieces: 970, shorts: 58, products: [["EWBL66", 32], ["EWR4", 4]] }] }];
  const depts = { departments: [
    { id: "fab", attainment: 100, stats: [{ label: "ACTUAL", value: 3502 }, { label: "FORECAST", value: "3502" }, { label: "UPLH", value: "24.15" }, { label: "UPLH GOAL", value: 56.57 }], headline: { active: 4, total: 6 } },
    { id: "welding", attainment: 60, stats: [{ label: "ACTUAL", value: 132 }, { label: "FORECAST", value: 220 }, { label: "UPLH", value: 1 }, { label: "UPLH GOAL", value: 4 }], headline: { active: 14, total: 16 } },
    { id: "tanks", attainment: 0, stats: [{ label: "PRODUCTION", value: 0 }, { label: "SCHEDULED", value: 55 }], headline: { active: 0, total: 7, down: true } }
  ], missing: [{ id: "paint", reason: "Tab 10.6.2026 missing in the Excel" }] };
  return window.__t.buildBoard("2026-10-06", depts, books, { OT_FAB: 0 }, { fileName: "Daily Board Input.xlsx", savedAt: Date.parse("2026-10-07T13:00:00Z") });
});
check(built.loading.inFull === 94 && built.loading.pcsPerLoad === 194 && built.loading.loads === 5, "loading for that day: in full 94%, 194 pcs/load, 5 loads");
check(built.loading.topShorts[0][0] === "EWBL66" && built.loading.topShorts.length === 3, "top shorts = the week through that day");
check(built.areas.FAB.efficiency === 43, "efficiency = UPLH / goal (24.15 / 56.57 = 43%): " + built.areas.FAB.efficiency);
check(built.adherence === Math.round(3634 / 3722 * 100), "plant adherence leaves out a department that is down: " + built.adherence);
check(built.areas.PAINT.missing === "Tab 10.6.2026 missing in the Excel", "missing department keeps its reason");

// --- board.html from the feed
await src.evaluate(async (b) => {
  const t = window.__t;
  const r = Object.assign({}, t.state.result, { board: b, safety: { topic: "Lock out / tag out", sinceISO: "2025-07-01" } });
  t.publishState.lastBody = null; t.publishState.retryAt = 0;
  await t.publishSnapshot(r, "test");
}, flow.board);
check(db.row && db.row.data.board && db.row.data.board.reportDate === "2026-10-06", "board stored with the snapshot");

const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
tv.on("pageerror", (e) => errors.push("board: " + e.message));
await tv.goto(base + "/board.html");
await tv.waitForFunction(() => document.getElementById("wait").hidden && document.querySelectorAll("#grid td").length > 0);
const view = await tv.evaluate(() => {
  const rows = [...document.querySelectorAll("#grid tr")].map((tr) => [...tr.children].map((c) => c.textContent.replace(/[●○]/g, "").trim()));
  const heads = rows[0];
  const col = (name) => heads.findIndex((h) => h.toUpperCase().startsWith(name));
  const row = (name) => rows.find((r) => r[0].toUpperCase() === name);
  return {
    meta: document.getElementById("meta").textContent,
    topic: document.getElementById("topic").textContent,
    pills: [...document.querySelectorAll(".pill b")].map((b) => b.textContent),
    notUpdated: heads.filter((h) => /NOT UPDATED/.test(h)).length,
    fabQuality: row("QUALITY")[col("FABRICATION")],
    weldOt: row("OT")[col("WELDING")],
    tanksEff: row("EFFICIENCIES")[col("TANK PLANT")],
    tanksHead: row("HEADCOUNT")[col("TANK PLANT")],
    fabAttain: row("SCHEDULE ATTAINMENT")[col("FABRICATION")],
    maintHead: row("HEADCOUNT")[col("MAINTENANCE")],
    maintIssues: row("MAINT. ISSUES")[col("MAINTENANCE")],
    weldStale: document.querySelectorAll("#grid tr")[4].children[2].className,
    topSix: document.getElementById("bottom").textContent,
    overflow: document.documentElement.scrollHeight > innerHeight + 2 || document.documentElement.scrollWidth > innerWidth + 2
  };
});
check(/Tuesday, Oct 6, 2026/.test(view.meta), "header shows the board day: " + view.meta);
check(view.topic === "Safety: Lock out / tag out", "safety topic from the feed");
check(view.pills.length === 3 && view.pills[0] !== "--" && view.pills[1] !== "--", "recordable + first aid counters shown: " + view.pills.join(" "));
check(view.fabQuality === "99%" && view.maintHead === "2/2", "typed cells shown: quality " + view.fabQuality + ", maint headcount " + view.maintHead);
check(view.tanksHead === "5/7" && view.tanksEff === "100%", "auto cells from the department Excel: " + view.tanksHead + " " + view.tanksEff);
check(view.fabAttain === "NO DATA", "department without a file: NO DATA");
check(/FI 243/.test(view.maintIssues), "maint issues listed: " + view.maintIssues);
check(view.weldOt === "2.5" && /stale/.test(view.weldStale), "welding updated 10/5 < 10/6: shown dimmed (" + view.weldStale + ")");
check(view.notUpdated === 6, "columns not updated for the day are flagged (all but FAB and MAINT): " + view.notUpdated);
check(/ECBL12/.test(view.topSix) && /5,248 \/ 3,814/.test(view.topSix), "production needs from the input");
check(!view.overflow, "fits a 1080p TV with no scroll");
await tv.screenshot({ path: new URL("./shots/board.png", import.meta.url).pathname }).catch(() => {});

// --- preview with sample data, and a 4K screen
await tv.setViewportSize({ width: 3840, height: 2160 });
await tv.goto(base + "/board.html?preview=1");
const prevView = await tv.evaluate(() => ({ cells: document.querySelectorAll("#grid td").length, overflow: document.documentElement.scrollHeight > innerHeight + 2 }));
check(prevView.cells === 56 && !prevView.overflow, "preview renders the full grid on 4K: " + prevView.cells);

await browser.close(); server.close();
check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
if (failures.length) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("BOARD CHECKS PASSED");
