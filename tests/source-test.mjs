import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH_GLOBAL + "/");
const { chromium } = require("playwright");
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4182, r));
const base = "http://127.0.0.1:4182";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(base + "/?__test=1");
await page.waitForFunction(() => window.__t);
const run = (fn, arg) => page.evaluate(fn, arg);

// 1. first publish
await run(async (fx) => { __t.sync.mode = "folder"; __t.state.result = fx; await __t.publishSnapshot(fx, "FAB 9.21"); }, fixture);
check(db.writes === 1, "first publish did not write: " + db.writes);
const firstChanged = db.row && db.row.data._changedAt;
check(/TVs updated/.test(await run(() => __t.sync.publishStatus)), "publishStatus not set");
// 2. unchanged, within heartbeat window -> no write
await run(async () => { await __t.publishSnapshot(__t.state.result, "FAB 9.21"); });
check(db.writes === 1, "unchanged data re-published inside heartbeat window");
// 3. a single number changes -> immediate publish, new changedAt  (this was the old bug)
await run(async () => { const r = JSON.parse(JSON.stringify(__t.state.result)); r.departments[0].stats[0].value = 1234; __t.state.result = r; await __t.publishSnapshot(r, "FAB 9.21"); });
check(db.writes === 2, "changed number was not published (old bug)");
check(db.row.data.departments[0].stats[0].value === 1234, "stored value not updated");
const secondChanged = db.row.data._changedAt;
check(secondChanged !== firstChanged, "changedAt did not move on a real change");
// 4. heartbeat after 60 s, same changedAt
const beatBefore = db.row.updated_at;
await run(async () => { __t.publishState.lastSentAt = Date.now() - 61000; await __t.publishSnapshot(__t.state.result, "FAB 9.21"); });
check(db.writes === 3, "no heartbeat after 60 s");
check(db.row.data._changedAt === secondChanged, "heartbeat changed the data timestamp");
check(db.row.updated_at !== beatBefore, "heartbeat did not move updated_at");
// 5. backend refuses -> visible status
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_publishable_x";
await run(async () => { const r = JSON.parse(JSON.stringify(__t.state.result)); r.departments[1].stats[0].value = 7; __t.state.result = r; await __t.publishSnapshot(r, "x"); });
const st = await run(() => __t.sync.publishStatus);
check(/TVs NOT updated: HTTP 503/.test(st) && /publishable/.test(st), "failure not surfaced: " + st);
// ...and it retries on the next check once fixed (lastBody must not have advanced)
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
await run(async () => { await __t.publishSnapshot(__t.state.result, "x"); });
check(db.row.data.departments[1].stats[0].value === 7, "did not retry after backend recovered");
check(/TVs updated/.test(await run(() => __t.sync.publishStatus)), "status did not recover");
await browser.close(); server.close();
if (failures.length) { console.log("FAILURES:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("SOURCE PUBLISH CHECKS PASSED (writes:", db.writes + ")");
