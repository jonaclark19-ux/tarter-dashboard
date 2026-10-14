// A hidden or locked tab gets its timers slowed to a crawl; the worker clock
// (js/tick-worker.js) must still run an overdue check.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server } = await import("./server.mjs");
await new Promise((r) => server.listen(4189, r));
const base = "http://127.0.0.1:4189";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: fixture, changedAt: new Date().toISOString() }) });

const browser = await chromium.launch();
const failures = [];
const check = (cond, msg) => { console.log((cond ? "ok   " : "FAIL ") + msg); if (!cond) failures.push(msg); };
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/?src=/api/feed-snapshot&schedule=off&__test=1");
await page.waitForFunction(() => window.__t && window.__t.sync.lastCheckAt > 0 && !window.__t.sync.busy, null, { timeout: 15000 });
// Stand-in for a throttled background tab: the page's own timer never fires.
const before = await page.evaluate(() => {
  const s = window.__t.sync;
  clearTimeout(s.timer);
  s.nextAt = Date.now() - 2000;
  return s.lastCheckAt;
});
await page.waitForFunction((t) => window.__t.sync.lastCheckAt > t, before, { timeout: 9000 }).catch(() => {});
const after = await page.evaluate(() => window.__t.sync.lastCheckAt);
check(after > before, "worker clock ran the overdue check (" + (after - before) + " ms later)");
check(errors.length === 0, "no page errors " + errors.join(" | "));

await browser.close();
server.close();
if (failures.length) { console.log("\nFAILED " + failures.length); process.exit(1); }
console.log("\nALL PASS");
