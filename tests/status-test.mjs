// Card status, pace and TV screens: one status per department from the time-adjusted
// pace (green 80+, amber 60-79, red below), no false alerts in the first hour or on a
// weekend, no demo data on a TV without a feed, and feed values never run as HTML.
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4207, r));
const base = "http://127.0.0.1:4207";
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };
const TZ = "America/Denver";
const at = (iso) => new Date(iso + "-06:00");

const dept = (id, name, active, total, prod, sch, uplh, goal) => ({
  id, name, attainment: Math.round(prod / sch * 100), attainmentLabel: "DAILY ATTAINMENT",
  headline: { icon: "x", active, total, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: false },
  stats: [{ label: "ACTUAL", value: prod, tone: "default" }, { label: "FORECAST", value: sch, tone: "default" }, { label: "UPLH", value: uplh, tone: "default" }, { label: "UPLH GOAL", value: goal, tone: "default" }]
});
function feed(day, savedIso, depts) {
  return { selectedDate: day, timeZone: TZ, warnings: [], missing: [], departments: depts,
    sources: depts.map((d) => ({ id: d.id, label: d.name, savedAt: at(savedIso).toISOString(), fileName: "x", sheetName: "x" })) };
}
const browser = await chromium.launch();
async function view(nowIso, result, url = "/?src=/api/feed-snapshot&tv=1") {
  if (result) {
    const r = await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result, changedAt: new Date().toISOString() }) });
    if (!r.ok) throw new Error("publish " + r.status);
  } else db.row = null;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: TZ });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: at(nowIso) });
  await page.goto(base + url);
  await page.waitForTimeout(1800);
  const out = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll("#dept-grid > div")).map((c) => c.innerText.replace(/\s+/g, " ")),
    top: document.getElementById("top-kpis").innerText.replace(/\s+/g, " "),
    grid: document.getElementById("dept-grid").innerText.replace(/\s+/g, " "),
    footerShown: getComputedStyle(document.querySelector("footer")).display !== "none",
    pwned: !!window.__pwned
  }));
  out.errors = errors;
  await ctx.close();
  return out;
}

// On pace at 10:00 (48% of the shift): 2.1 UPLH vs 4.38 goal = 100% -> no alert badge.
const onPace = [dept("tanks", "TANKS", 7, 7, 60, 135, 2.1, 4.38)];
let v = await view("2026-10-06T10:00:00", feed("2026-10-06", "2026-10-06T10:00:00", onPace));
check(v.errors.length === 0, "no page errors: " + v.errors.join(" | "));
check(/10[01]% TO UPLH GOAL \u2713 10:00 AM/.test(v.cards[0]), "pace at the save time: " + v.cards[0]);
check(!/BEHIND|CRITICAL|MISSING/.test(v.cards[0]), "on-pace crew has no alert");
check(!v.footerShown, "TV has no footer bar");

// Same numbers saved at 8:00, viewed at 11:00: still the 8:00 pace, not a collapsing one.
v = await view("2026-10-06T11:00:00", feed("2026-10-06", "2026-10-06T08:00:00", [dept("tanks", "TANKS", 7, 7, 40, 135, 1.25, 4.38)]));
check(/ 8:00 AM/.test(v.cards[0]), "stale save keeps its own time: " + v.cards[0]);

// Thresholds: 70% -> amber BEHIND PACE, 50% -> red CRITICAL.
v = await view("2026-10-06T10:00:00", feed("2026-10-06", "2026-10-06T10:00:00", [dept("fab", "FAB", 4, 4, 1, 2, 1.46, 4.38), dept("tanks", "TANKS", 7, 7, 1, 2, 1.04, 4.38)]));
check(/BEHIND PACE/.test(v.cards[0]), "70% pace is amber BEHIND PACE: " + v.cards[0]);
check(/CRITICAL PACE/.test(v.cards[1]), "50% pace is red CRITICAL: " + v.cards[1]);
check(/Lowest: TANKS/.test(v.top), "plant tile names the lowest department: " + v.top);

// The pace runs from 5:00: at 5:40 (6% of the shift) 0.25 UPLH vs 4.38 = 90% -> green.
v = await view("2026-10-06T05:40:00", feed("2026-10-06", "2026-10-06T05:40:00", [dept("tanks", "TANKS", 7, 7, 3, 135, 0.25, 4.38)]));
check(/9\d% TO UPLH GOAL \u2713 5:40 AM/.test(v.cards[0]) && !/BEHIND|CRITICAL/.test(v.cards[0]), "pace in color from 5 AM: " + v.cards[0]);
v = await view("2026-10-06T04:40:00", feed("2026-10-06", "2026-10-06T04:40:00", [dept("tanks", "TANKS", 7, 7, 0, 135, 0, 4.38)]));
check(/-- TO UPLH GOAL From 5 AM/.test(v.cards[0]), "before 5 AM there is no pace yet: " + v.cards[0]);

// Weekend: plain WEEKEND screen, no shortage alarms.
v = await view("2026-10-10T08:30:00", feed("2026-10-09", "2026-10-09T15:00:00", [dept("tanks", "TANKS", 2, 7, 3, 135, 0.1, 4.38)]));
check(/WEEKEND/.test(v.grid) && !/MISSING/.test(v.grid), "weekend screen: " + v.grid);

// Hostile feed values are numbers or escaped text, never markup.
const evil = dept("tanks", "TANKS", 7, 7, 60, 135, 2.1, 4.38);
evil.headline.icon = "<img src=x onerror=window.__pwned=1>";
evil.headline.active = "<img src=x onerror=window.__pwned=1>";
evil.attainment = "<img src=x onerror=window.__pwned=1>";
v = await view("2026-10-06T10:00:00", feed("2026-10-06", "2026-10-06T10:00:00", [evil]));
check(!v.pwned, "feed values can't inject script");

// No feed at all: WAITING FOR DATA, never the demo numbers.
v = await view("2026-10-06T10:00:00", null);
check(/WAITING FOR DATA/.test(v.grid) && !/3502/.test(v.grid), "TV without a feed waits instead of showing demo data: " + v.grid);

await browser.close();
server.close();
if (failures.length) { console.log("\nFAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("\nall status checks passed");
