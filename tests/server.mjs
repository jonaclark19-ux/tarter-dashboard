// Local stand-in for Vercel: serves ../vercel-deploy statically and runs its real
// api/*.js handlers, with Supabase's REST endpoint replaced by an in-memory row.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_KEY || "sb_secret_test";

export const db = { row: null, writes: 0, reads: 0, change_log: [], change_seen: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const tm = /\/rest\/v1\/(change_log|change_seen)\?/.exec(u);
  if (u.startsWith("https://mrqxinvuzjzpyypyeepk.supabase.co/") && tm) {
    const table = db[tm[1]];
    if ((opts.method || "GET") === "POST") {
      const row = JSON.parse(opts.body);
      const dup = tm[1] === "change_log"
        ? table.some((r) => r.changed_at === row.changed_at)
        : table.some((r) => r.changed_at === row.changed_at && r.screen === row.screen);
      if (!dup) table.push(Object.assign({ seen_at: new Date().toISOString() }, row));
      return new Response(null, { status: 201 });
    }
    const q = new URL(u).searchParams;
    let rows = table.slice();
    const gte = q.get("changed_at");
    if (gte) rows = rows.filter((r) => r.changed_at >= gte.replace(/^gte\./, ""));
    if (tm[1] === "change_log") rows.sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1));
    return new Response(JSON.stringify(rows.slice(0, +(q.get("limit") || 1000))), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (!u.startsWith("https://mrqxinvuzjzpyypyeepk.supabase.co/rest/v1/dashboard_snapshot")) return realFetch(url, opts);
  const key = opts.headers && opts.headers.apikey;
  if (key !== process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response('{"message":"bad key"}', { status: 401 });
  if ((opts.method || "GET") === "POST") {
    const body = JSON.parse(opts.body);
    db.row = { data: body.data, source_label: body.source_label, updated_at: body.updated_at };
    db.writes++;
    return new Response(null, { status: 201 });
  }
  db.reads++;
  return new Response(JSON.stringify(db.row ? [db.row] : []), { status: 200, headers: { "content-type": "application/json" } });
};

const handlers = {};
for (const name of ["publish", "feed-snapshot", "seen", "timing"]) {
  handlers[name] = (await import(pathToFileURL(path.join(root, "api", name + ".js")).href)).default;
}

function adapt(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(b); return res; };
  return res;
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const m = /^\/api\/([\w-]+)$/.exec(url.pathname);
  if (m && handlers[m[1]]) {
    let raw = "";
    for await (const c of req) raw += c;
    req.query = Object.fromEntries(url.searchParams);
    try { req.body = raw && /json/.test(req.headers["content-type"] || "") ? JSON.parse(raw) : raw; } catch { req.body = {}; }
    return handlers[m[1]](req, adapt(res));
  }
  const file = path.join(root, url.pathname === "/" ? "index.html" : url.pathname);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end("nf"); }
  res.setHeader("content-type", file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream");
  if (file.endsWith("index.html") && url.searchParams.get("__test") === "1") {
    // Test-only copy: expose the IIFE's internals so the publish logic can be driven directly.
    const html = fs.readFileSync(file, "utf8");
    const i = html.lastIndexOf("})();");
    return res.end(html.slice(0, i) + "window.__t = { publishSnapshot, publishState, sync, state };\n" + html.slice(i));
  }
  if (db.failWrites && false) {}
  fs.createReadStream(file).pipe(res);
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(4173, () => console.log("listening 4173"));
}
