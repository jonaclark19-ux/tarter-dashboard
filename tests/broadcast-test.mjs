// Screen messages: /api/broadcast + the pop-up on the screens + the sending panel.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire((process.env.NODE_PATH_GLOBAL || "/opt/node22/lib/node_modules") + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4184, r));
const base = "http://127.0.0.1:4184";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
let failed = 0;
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) failed++; };
const j = async (r) => ({ status: r.status, body: await r.json().catch(() => null), cache: r.headers.get("cache-control") });
const send = (b, key) => fetch(base + "/api/broadcast", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, key ? { "x-publish-key": key } : {}), body: JSON.stringify(b) }).then(j);
const feed = () => fetch(base + "/api/feed-snapshot").then(j);
// A tiny real PNG (1x1), as the panel would send after shrinking a photo.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

await fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: fixture, sourceLabel: "FAB", changedAt: new Date().toISOString() }) });

// ---- API ----
let r = await feed();
check(r.status === 200 && r.body.broadcast === undefined, "no message: the feed carries none");
check((await send({})).status === 400, "empty message refused");
check((await send({ title: "x", image: "data:text/html;base64,PHNjcmlwdD4=" })).status === 400, "non-image data refused");
check((await send({ title: "x", image: "data:image/png;base64," + "A".repeat(470 * 1024) })).status === 413, "oversized photo refused");
check((await send({ title: "x", target: "screen:" })).status === 400, "screen target without a name refused");
check((await fetch(base + "/api/broadcast", { method: "DELETE" })).status === 405, "other methods refused");
r = await send({ kind: "nope", title: "  Wear your PPE  ", text: "Glasses\u0007 on", seconds: 9999, target: "everyone" });
check(r.status === 200 && r.body.message.kind === "info" && r.body.message.seconds === 300 && r.body.message.target === "all", "kind / seconds / target cleaned: " + JSON.stringify(r.body && r.body.message));
check(r.body.message.title === "Wear your PPE" && r.body.message.text === "Glasses on", "text trimmed, control characters dropped");
check(db.rows[2] && db.rows[1] && db.rows[1].data.departments, "stored as row 2, the snapshot row untouched");
r = await send({ kind: "quality", title: "Quality alert", text: "See photo", image: PNG, seconds: 20, target: "tv" });
const photoId = r.body.message.id;
r = await feed();
check(r.body.broadcast && r.body.broadcast.id === photoId && r.body.broadcast.hasImage === true && r.body.broadcast.image === undefined, "feed carries the message without the photo");
check(r.body.departments.length === 4, "feed still carries the numbers");
r = await fetch(base + "/api/broadcast?id=" + photoId).then(j);
check(r.status === 200 && r.body.image === PNG && /s-maxage=600/.test(r.cache), "photo served once per id, cached at the edge");
check((await fetch(base + "/api/broadcast?id=old")).status === 404, "photo of another id: 404");
// expired: gone from the feed
db.rows[2].data = Object.assign({}, db.rows[2].data, { until: new Date(Date.now() - 1000).toISOString() });
check((await feed()).body.broadcast === undefined, "expired message leaves the feed");
r = await send({ clear: true });
check(r.status === 200 && (await feed()).body.broadcast.cleared === true, "stop: the feed says cleared");
process.env.PUBLISH_KEY = "k1";
check((await send({ title: "x" })).status === 401, "publish key required when set");
check((await send({ title: "x" }, "k1")).status === 200, "right key accepted");
delete process.env.PUBLISH_KEY;
await send({ clear: true });

// ---- Screens ----
const browser = await chromium.launch();
async function screen(path, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + path);
  await page.waitForFunction(() => /FAB/.test(document.getElementById("dept-grid").textContent), null, { timeout: 15000 });
  return { ctx, page, errors };
}
const popupText = (page) => page.evaluate(() => { const o = document.querySelector(".bc-overlay"); return o ? o.textContent : null; });
const waitPopup = (page, re, ms) => page.waitForFunction((src) => { const o = document.querySelector(".bc-overlay"); return o && new RegExp(src).test(o.textContent); }, re.source, { timeout: ms || 30000 }).then(() => true).catch(() => false);

const tv = await screen("/?src=/api/feed-snapshot&tv=1&schedule=off&screen=Soldadura", { width: 960, height: 540 });
const pc = await screen("/?src=/api/feed-snapshot&tv=1&pc=1&schedule=off");
const tv2 = await screen("/?src=/api/feed-snapshot&tv=1&schedule=off&screen=Pintura");
// The stop message already in the feed must not pop anything up.
await tv.page.waitForTimeout(1500);
check((await popupText(tv.page)) === null, "a cleared message shows nothing");

await send({ kind: "safety", title: "Wear your PPE", text: "Glasses <b>on</b>", seconds: 6, target: "all" });
check(await waitPopup(tv.page, /Wear your PPE/), "TV shows the message");
check(await waitPopup(pc.page, /Wear your PPE/), "office computer shows the message");
const look = await tv.page.evaluate(() => {
  const o = document.querySelector(".bc-overlay"), c = o.querySelector(".bc-card").getBoundingClientRect();
  return { html: o.querySelector(".bc-text").innerHTML, inView: c.top >= 0 && c.left >= 0 && c.bottom <= innerHeight + 1 && c.right <= innerWidth + 1, w: c.width, kind: o.querySelector(".bc-kind").textContent };
});
check(look.html === "Glasses &lt;b&gt;on&lt;/b&gt;", "message text is never HTML: " + look.html);
check(look.inView && look.w > 400, "pop-up fits the small TV screen: " + JSON.stringify(look));
check(/safety/i.test(look.kind), "kind label shown: " + look.kind);
await tv.page.screenshot({ path: "shots/broadcast-tv.png" });
const closed = await tv.page.waitForFunction(() => !document.querySelector(".bc-overlay"), null, { timeout: 12000 }).then(() => true).catch(() => false);
check(closed, "pop-up closes by itself after its seconds");
await tv.page.reload();
await tv.page.waitForFunction(() => /FAB/.test(document.getElementById("dept-grid").textContent), null, { timeout: 15000 });
await tv.page.waitForTimeout(2500);
check((await popupText(tv.page)) === null, "a reloaded TV does not show the same message again");

// Only one screen, with a photo.
await send({ kind: "quality", title: "Quality alert", text: "Check the welds", image: PNG, seconds: 60, target: "screen:soldadura" });
check(await waitPopup(tv.page, /Quality alert/), "named screen gets its message (name not case-sensitive)");
const img = await tv.page.evaluate(() => { const i = document.querySelector(".bc-overlay img"); return i ? i.src.slice(0, 22) : null; });
check(img === "data:image/png;base64,", "photo shown: " + img);
await tv2.page.waitForTimeout(18000);
check((await popupText(tv2.page)) === null, "other screens skip a message for one screen");
check((await popupText(pc.page)) === null || !/Quality alert/.test(await popupText(pc.page)), "office computer skips it too");
await send({ clear: true });
const stopped = await tv.page.waitForFunction(() => !document.querySelector(".bc-overlay"), null, { timeout: 30000 }).then(() => true).catch(() => false);
check(stopped, "Stop closes the message on the screen");
for (const s of [tv, pc, tv2]) { check(s.errors.length === 0, "no page errors: " + s.errors); await s.ctx.close(); }

// ---- Sending panel on the main dashboard ----
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/?schedule=off");
  await page.click("#broadcast-open-btn");
  await page.waitForSelector(".bc-panel");
  const presets = await page.$$eval(".bc-preset", (b) => b.map((x) => x.textContent));
  check(presets.length >= 6 && presets.includes("PPE reminder"), "quick messages listed: " + presets.join(", "));
  await page.click(".bc-preset >> text=Great job");
  check(await page.inputValue('[data-bc="title"]') === "Great job, team!" && await page.inputValue('[data-bc="kind"]') === "good", "a quick message fills the form");
  await page.click('[data-bc="preview"]');
  check(/Great job, team!/.test(await popupText(page) || ""), "Preview shows it here");
  await page.screenshot({ path: "shots/broadcast-preview.png" });
  await page.keyboard.press("Escape");
  check((await popupText(page)) === null, "Esc closes the preview");
  await page.screenshot({ path: "shots/broadcast-panel.png" });
  // photo: a real PNG file goes through the shrink step
  fs.writeFileSync("shots/test-photo.png", Buffer.from(PNG.split(",")[1], "base64"));
  await page.setInputFiles('[data-bc="file"]', "shots/test-photo.png");
  await page.waitForFunction(() => !document.querySelector('[data-bc="thumb"]').hidden, null, { timeout: 5000 });
  await page.selectOption('[data-bc="target"]', "screen");
  await page.click('[data-bc="send"]');
  check(/screen name/i.test(await page.textContent('[data-bc="status"]')), "one screen without a name: asks for it");
  await page.fill('[data-bc="screen"]', "Soldadura");
  process.env.PUBLISH_KEY = "k2";
  await page.click('[data-bc="send"]');
  await page.waitForFunction(() => /key/i.test(document.querySelector('[data-bc="status"]').textContent), null, { timeout: 5000 });
  check(await page.isVisible('[data-bc="key"]'), "wrong key: the key box appears");
  await page.fill('[data-bc="key"]', "k2");
  await page.click('[data-bc="send"]');
  await page.waitForFunction(() => /^Sent/.test(document.querySelector('[data-bc="status"]').textContent), null, { timeout: 5000 }).catch(() => {});
  check(/^Sent/.test(await page.textContent('[data-bc="status"]')), "sent: " + await page.textContent('[data-bc="status"]'));
  const stored = db.rows[2].data;
  check(stored.title === "Great job, team!" && stored.kind === "good" && stored.target === "screen:Soldadura" && /^data:image\/jpeg;base64,/.test(stored.image), "server got the form, photo as JPEG");
  await page.click('[data-bc="stop"]');
  await page.waitForFunction(() => /^Stopped/.test(document.querySelector('[data-bc="status"]').textContent), null, { timeout: 5000 }).catch(() => {});
  check(db.rows[2].data.cleared === true, "Stop button clears it");
  delete process.env.PUBLISH_KEY;
  check(errors.length === 0, "panel: no page errors " + errors);
  await ctx.close();
}

await browser.close();
server.close();
if (failed) { console.log(failed + " BROADCAST CHECK(S) FAILED"); process.exit(1); }
console.log("ALL BROADCAST CHECKS PASSED");
