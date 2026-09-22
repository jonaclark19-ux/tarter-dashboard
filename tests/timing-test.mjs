import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH_GLOBAL + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4185, r));
const base = "http://127.0.0.1:4185";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? "ok   " : "FAIL ") + msg); };
const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// 1. first send after the source page opens: not a timed change
await post("/api/publish", { result: fixture, changedAt: new Date().toISOString(), changed: true, firstAfterLoad: true });
check(db.change_log.length === 0, "first-after-load publish is not logged");

const browser = await chromium.launch();
const tv = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await tv.goto(base + "/?src=/api/feed-snapshot&tv=1&screen=Lobby");
await tv.waitForFunction(() => /TV MODE/.test(document.body.textContent), null, { timeout: 15000 });
await tv.waitForTimeout(1500);
check(db.change_seen.length === 0, "TV does not ack on initial load");

// 2. the source PC via its real code path
const src = await browser.newPage();
await src.goto(base + "/?__test=1");
await src.waitForFunction(() => window.__t);
const r = await src.evaluate(async (fx) => {
  const t = window.__t;
  t.sync.mode = "folder";
  t.sync.sourceSavedAt = new Date(Date.now() - 30000);
  t.sync.sourceNewestFile = "Daily Production Weld.xlsx";
  await t.publishSnapshot(fx, "x");                 // first after load
  const first = t.publishState.sentOnce;
  const fx2 = JSON.parse(JSON.stringify(fx)); fx2.selectedDate = "2099-01-01";
  await t.publishSnapshot(fx2, "x");                // real change
  await t.publishSnapshot(fx2, "x");                // no change, inside heartbeat window: skipped
  return { first, status: t.sync.publishStatus };
}, fixture);
check(r.first === true, "sentOnce set after the first publish");
check(db.change_log.length === 1, "exactly one change logged (got " + db.change_log.length + ")");
check(db.change_log[0] && db.change_log[0].newest_file === "Daily Production Weld.xlsx", "newest file recorded");
check(/after the Excel was saved/.test(r.status) && /\b(29|30|31) s\b/.test(r.status), "source status shows the lag: " + r.status);

// 3. the TV picks it up on its next poll and acks once
await tv.waitForFunction(() => /2099/.test(document.body.textContent) || true, null, { timeout: 1000 });
const deadline = Date.now() + 25000;
while (!db.change_seen.length && Date.now() < deadline) await new Promise((res) => setTimeout(res, 500));
check(db.change_seen.length === 1 && db.change_seen[0].screen === "Lobby", "TV acked with its screen name");
check(db.change_seen[0] && db.change_seen[0].changed_at === db.change_log[0].changed_at, "ack matches the logged change");

// 4. bad acks rejected
check((await post("/api/seen", { changedAt: "2001-01-01T00:00:00Z", screen: "x" })).status === 400, "old stamp rejected");
check((await post("/api/seen", { changedAt: new Date().toISOString() })).status === 400, "missing screen rejected");

// 5. timing API + page
const t = await (await fetch(base + "/api/timing")).json();
console.log(JSON.stringify(t, null, 1).slice(0, 900));
check(t.changes.length === 1 && Math.abs(t.changes[0].excelToDashboard - 30) <= 1.5, "excel->dashboard ≈ 30 s");
check(t.changes[0].screens.length === 1 && t.changes[0].screens[0].seconds >= 0, "screen delay present");
check(t.medians.total !== null, "total median present");
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.goto(base + "/timing.html");
await page.waitForFunction(() => document.querySelectorAll("#rows tr").length === 1);
check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "timing page no horizontal page scroll on phone");
await page.screenshot({ path: "shots/timing-phone.png", fullPage: true });
await page.setViewportSize({ width: 1200, height: 700 });
await page.screenshot({ path: "shots/timing-desktop.png" });

await browser.close(); server.close();
console.log(failures.length ? "\nFAILURES: " + failures.length : "\nALL PASS");
process.exit(failures.length ? 1 : 0);
