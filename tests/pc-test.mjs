// /computer (&pc=1): the TV board on an office PC fits the browser window, even when the
// maximized window is shorter than the screen (toolbar + taskbar). TV mode is untouched.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4187, r));
const base = "http://127.0.0.1:4187";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: fixture, changedAt: new Date().toISOString() }) });

const browser = await chromium.launch();
const failures = [];
const check = (cond, msg) => { console.log((cond ? "ok   " : "FAIL ") + msg); if (!cond) failures.push(msg); };
async function view(path, w, h, sw, sh) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: { width: sw, height: sh } });
  // A real maximized browser: the outer window is as wide as the screen.
  await ctx.addInitScript(([sw, sh]) => { Object.defineProperty(window, "outerWidth", { get: () => sw }); Object.defineProperty(window, "outerHeight", { get: () => sh - 40 }); }, [sw, sh]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + path);
  await p.waitForFunction(() => /FAB/.test(document.getElementById("dept-grid").textContent) && document.body.dataset.tvScale, null, { timeout: 15000 });
  await p.waitForTimeout(3000);
  const m = await p.evaluate(() => {
    const cards = Array.from(document.getElementById("dept-grid").children).map((c) => c.getBoundingClientRect());
    return { vw: innerWidth, vh: innerHeight, bottom: Math.max(...cards.map((r) => r.bottom)), right: Math.max(...cards.map((r) => r.right)), rows: new Set(cards.map((r) => Math.round(r.top))).size, n: cards.length };
  });
  m.errors = errors;
  await ctx.close();
  return m;
}
const seenBefore = db.change_seen.length;
for (const [w, h, sw, sh] of [[1519, 730, 1536, 864], [1903, 940, 1920, 1080], [1349, 625, 1366, 768], [1263, 600, 1280, 720]]) {
  const m = await view("/?src=/api/feed-snapshot&schedule=off&tv=1&pc=1", w, h, sw, sh);
  check(m.errors.length === 0 && m.n === 4 && m.rows === 1, `${w}x${h}: 4 cards in one row, no errors ${m.errors.join("|")}`);
  check(m.bottom <= m.vh + 1 && m.right <= m.vw + 1, `${w}x${h}: fits the window (bottom ${Math.round(m.bottom)} of ${m.vh}, right ${Math.round(m.right)} of ${m.vw})`);
}
check(db.change_seen.length === seenBefore, "office PCs stay out of the timing table");
// The TV link keeps sizing itself to the screen (unchanged behavior).
const tv = await view("/?src=/api/feed-snapshot&schedule=off&tv=1", 1903, 940, 1920, 1080);
check(tv.bottom > tv.vh, "TV link still sizes to the full screen: bottom " + Math.round(tv.bottom));
const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url)));
check(vercel.redirects.some((r) => r.source === "/computer" && /tv=1&pc=1/.test(r.destination)), "/computer link in vercel.json");

await browser.close();
server.close();
if (failures.length) { console.log("\nFAILED " + failures.length); process.exit(1); }
console.log("\nALL PASS");
