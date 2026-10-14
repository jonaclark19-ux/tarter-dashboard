// WELDING: text typed in the ACTUAL column ("Gas Issues" on a "Bulk Gas" line) shows on
// the card as a note, next to the material shortages it already listed.
// PAINT: every color change in the DOWNTIME rows adds up into one total.
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server } = await import("./server.mjs");
await new Promise((r) => server.listen(4203, r));
const base = "http://127.0.0.1:4203";
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/?__test=1");
await page.waitForFunction(() => window.__t);
await page.addScriptTag({ url: base + "/vendor/xlsx.js" });

const out = await page.evaluate(() => {
  // One day-block laid out like the 10.12.2026 tab of Daily Production Weld.xlsx.
  const sheetFor = (rows) => XLSX.utils.aoa_to_sheet([
    ["UPLH Goal - 4.67", "WELDERS 16", "SCHEDULED ADHERENCE", "ACTUAL UPLH", 0.22],
    ["10/14/2026", 10, 0.18, 1.03, 467],
    ["PART #", "FORECAST", "ACTUAL", "DELTA", "STATUS"],
    ["EC10W *", 250, 25, 225, 0.1],
    ["DTPBL312", 40, 40, 0, 1],
    ...rows,
    ["DAILY", 290, 65, 225, 0.22]
  ]);
  const run = (rows) => {
    const warnings = [];
    const d = buildWeldingFromSheet(sheetFor(rows), "2026-10-14", warnings);
    return { notes: d && d.notes, actual: d && d.stats[0].value, forecast: d && d.stats[1].value };
  };
  return {
    gas: run([["Bulk Gas", "Gas Issues", "Gas Issues", 0, 0]]),
    mixed: run([["Bulk Gas", "Gas Issues", "Gas Issues", 0, 0], ["RFMSW", 80, "Material", null, null], ["SPCW", 5, 2, 3, "material"]]),
    plain: run([["SPCW", 5, 2, 3, "material"]]),
    none: run([["SPCW", 5, "-", 3, 0.4], ["WG12", 10, "N/A", 0, 0]])
  };
});
const text = (r) => (r.notes || []).map((n) => n.label + ": " + n.content).join(" / ");
check(text(out.gas) === "MATERIAL / ISSUES: Gas Issues — Bulk Gas", "gas message shows on the card: " + text(out.gas));
check(out.gas.actual === 65 && out.gas.forecast === 290, "a text row leaves ACTUAL / FORECAST alone");
check(text(out.mixed) === "MATERIAL / ISSUES: Gas Issues — Bulk Gas | Material — RFMSW | SPCW", "messages first, then the short parts: " + text(out.mixed));
check(text(out.plain) === "MATERIAL / ISSUES: SPCW", "material-only note unchanged: " + text(out.plain));
check(!out.none.notes, "dashes and N/A are not messages");
const paint = await page.evaluate(() => {
  const run = (rows) => {
    const sheet = XLSX.utils.aoa_to_sheet([["PAINT", "", "", "", "", "", "EMPLOYEES", 8, "UPLH GOAL", 84, "UPLH", 77], ["BLACK"], ["PART", 100], ["TOTAL", 100, ...Array(14).fill(""), 90], [], ...rows]);
    const d = buildPaintFromSheet(sheet, null, "2026-10-14", []);
    const dt = d.stats.find((s) => s.label === "DOWNTIME");
    return { value: dt && dt.value, log: d.notes && d.notes[0].content };
  };
  return {
    // The 10/14 sheet: the second change has its time on the row below.
    sheet: run([["DOWNTIME:"], ["COLOR CHANGE: GREEN-BROWN", "9:05AM-9:\n55am"], ["COLOR CHANGE: BROWN-RED"], ["3PM-3:15PM"]]),
    twoRows: run([["DOWNTIME:"], ["COLOR CHANGE 6:30-7:00"], ["COLOR CHANGE 1:00-1:35"]]),
    oneRow: run([["DOWNTIME:"], ["Change color 5:25am-5:55am"]]),
    noTimes: run([["DOWNTIME:"], ["Booth motor EWBL66-2 waiting 2-3 parts"]]),
    hours: [formatDowntimeMins(25), formatDowntimeMins(60), formatDowntimeMins(65), formatDowntimeMins(130)]
  };
});
check(paint.sheet.value === "1 HR 5 MINS", "50 + 15 min of color changes = 1 HR 5 MINS: " + paint.sheet.value);
check(paint.sheet.log === "COLOR CHANGE: GREEN-BROWN 9:05AM-9:55am · COLOR CHANGE: BROWN-RED 3PM-3:15PM", "a time on its own row joins the change above it: " + paint.sheet.log);
check(paint.twoRows.value === "1 HR 5 MINS", "30 + 35 min = 1 HR 5 MINS: " + paint.twoRows.value);
check(paint.oneRow.value === "30 MINS", "a single change stays in minutes: " + paint.oneRow.value);
check(paint.noTimes.value === "ACTIVE", "part counts are not read as hours: " + paint.noTimes.value);
check(paint.hours.join("|") === "25 MINS|1 HR|1 HR 5 MINS|2 HRS 10 MINS", "hour formatting: " + paint.hours.join("|"));
check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
