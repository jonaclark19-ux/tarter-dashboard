// WELDING: text typed in the ACTUAL column ("Gas Issues" on a "Bulk Gas" line) shows on
// the card as a note, next to the material shortages it already listed.
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server } = await import("./server.mjs");
await new Promise((r) => server.listen(4201, r));
const base = "http://127.0.0.1:4201";
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
check(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
