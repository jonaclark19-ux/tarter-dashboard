import assert from "node:assert/strict";
import fs from "node:fs";
const { server, db } = await import("./server.mjs");
await new Promise((r) => server.listen(4180, r));
const base = "http://127.0.0.1:4180";
const fixture = JSON.parse(fs.readFileSync(new URL("./fixture.json", import.meta.url)));
const j = async (r) => ({ status: r.status, body: await r.json(), cache: r.headers.get("cache-control") });
const post = (b) => fetch(base + "/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(j);
const get = () => fetch(base + "/api/feed-snapshot").then(j);

// empty store
let r = await get(); assert.equal(r.status, 404); assert.equal(r.body.error, "no_snapshot"); assert.match(r.cache, /no-store/);
// bad payloads
assert.equal((await post({})).status, 400);
assert.equal((await post({ result: { departments: [] } })).status, 400);
assert.equal((await fetch(base + "/api/publish")).status, 405);
// first publish
const t1 = "2026-09-22T20:00:00.000Z";
r = await post({ result: fixture, sourceLabel: "src", changedAt: t1, filesSavedAt: "2026-09-22T19:59:00.000Z" });
assert.equal(r.status, 200);
r = await get();
assert.equal(r.status, 200);
assert.equal(r.body.updatedAt, t1, "updatedAt = changedAt");
assert.equal(r.body.departments.length, 4);
assert.ok(r.body.heartbeatAt && r.body.serverTime);
assert.equal(r.body._changedAt, undefined, "internal fields hidden");
assert.match(r.cache, /s-maxage=5/);
const beat1 = r.body.heartbeatAt;
// heartbeat: same changedAt, heartbeat moves, updatedAt does not
await new Promise((res) => setTimeout(res, 20));
await post({ result: fixture, sourceLabel: "src", changedAt: t1 });
r = await get();
assert.equal(r.body.updatedAt, t1);
assert.notEqual(r.body.heartbeatAt, beat1);
// garbage changedAt falls back to now
await post({ result: fixture, changedAt: "nope" });
r = await get(); assert.ok(Number.isFinite(Date.parse(r.body.updatedAt)));
// wrong key message
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_publishable_abc";
r = await get(); assert.equal(r.status, 503); assert.match(r.body.message, /publishable/);
r = await post({ result: fixture }); assert.equal(r.status, 503); assert.match(r.body.message, /publishable/);
process.env.SUPABASE_SERVICE_ROLE_KEY = "";
r = await get(); assert.equal(r.body.error, "not_configured");
console.log("API tests passed; writes:", db.writes, "reads:", db.reads);
server.close();
