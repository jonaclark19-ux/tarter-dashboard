/* ============================================================
   TARTER YARD MAP — API (Netlify Function v2 + Netlify Blobs)
   ------------------------------------------------------------
   Routes (all under /api):
     POST   /api/login          {name, code}      -> sets session cookie
     POST   /api/logout                            -> clears cookie
     GET    /api/me                                -> {role, name}
     GET    /api/state                             -> {rev, data}
     PUT    /api/state          {rev, data}        -> {rev}   (editor only, 409 on conflict)
     GET    /api/alerts                            -> {rev, items}
     POST   /api/alerts         {alert}            -> {rev, alert}
     PATCH  /api/alerts         {id, status}       -> {rev, alert}
     GET    /api/sync?srev=&arev=                  -> only what changed

   Required environment variables (Netlify → Site settings → Environment):
     EDITOR_CODE      access code that grants full edit rights
     VIEWER_CODE      access code that grants report-only rights
     SESSION_SECRET   any long random string used to sign session cookies
   ============================================================ */

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "tarter-yard";
const STATE_KEY = "state.json";
const ALERTS_KEY = "alerts.json";
const COOKIE = "tym_session";
const SESSION_DAYS = 30;

/* ---------------------------------------------------------- session */

function secret() {
  return process.env.SESSION_SECRET || "";
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function sign(payloadStr) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadStr).digest());
}

function makeToken(role, name) {
  const payload = b64url(JSON.stringify({
    role,
    name: String(name || "").slice(0, 60),
    exp: Date.now() + SESSION_DAYS * 864e5,
  }));
  return payload + "." + sign(payload);
}

function readToken(token) {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  // constant-time compare (lengths must match first, timingSafeEqual throws otherwise)
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(unb64url(payload));
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.role !== "editor" && data.role !== "viewer") return null;
    return data;
  } catch (e) {
    return null;
  }
}

function sessionOf(req) {
  const raw = req.headers.get("cookie") || "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!hit) return null;
  return readToken(decodeURIComponent(hit.slice(COOKIE.length + 1)));
}

function cookieHeader(token, maxAgeSeconds) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

/** Compare two secrets without leaking length/content through timing. */
function codeMatches(input, expected) {
  if (!expected) return false;
  const a = crypto.createHash("sha256").update(String(input)).digest();
  const b = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------------------------------------------------------- helpers */

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      extraHeaders
    ),
  });
}

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readBlob(key, fallback) {
  try {
    const raw = await store().get(key, { type: "json" });
    return raw == null ? fallback : raw;
  } catch (e) {
    return fallback;
  }
}

async function writeBlob(key, value) {
  await store().setJSON(key, value);
}

const emptyState = () => ({ rev: 0, updated: null, updatedBy: null, data: null });
const emptyAlerts = () => ({ rev: 0, items: [] });

/**
 * Read-modify-write with a few retries. Netlify Blobs is eventually a
 * last-writer-wins store, so we re-read and re-check the rev each attempt to
 * shrink the window where two devices clobber each other.
 */
async function mutate(key, fallbackFactory, mutator, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const current = await readBlob(key, fallbackFactory());
    const result = mutator(current);
    if (result && result.abort) return result;
    const next = result.value;
    try {
      await writeBlob(key, next);
      const verify = await readBlob(key, fallbackFactory());
      if (verify && verify.rev === next.rev) return { value: next };
      lastErr = new Error("write raced");
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return { value: null };
}

function newId() {
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const ALERT_TYPES = new Set(["empty", "damaged", "found", "unknown", "low"]);

/** Keep only the fields we understand, and cap string lengths. */
function sanitizeAlert(input, session) {
  const s = (v, max) => (v == null ? "" : String(v).slice(0, max));
  // null/""/undefined must stay null — +null is 0, which would silently
  // turn a missing coordinate into a pin at the map origin.
  const n = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(+v) ? null : Math.round(+v));
  const type = ALERT_TYPES.has(input && input.type) ? input.type : "empty";
  return {
    id: newId(),
    type,
    sku: s(input && input.sku, 64).toUpperCase(),
    rawCode: s(input && input.rawCode, 64),
    note: s(input && input.note, 400),
    foundAt: input && input.foundAt
      ? { x: n(input.foundAt.x), y: n(input.foundAt.y) }
      : null,
    homeAt: input && input.homeAt
      ? { x: n(input.homeAt.x), y: n(input.homeAt.y) }
      : null,
    homeGroup: s(input && input.homeGroup, 40),
    by: s(session.name || "—", 60),
    role: session.role,
    createdAt: new Date().toISOString(),
    status: "open",
    resolvedAt: null,
    resolvedBy: null,
  };
}

/* ---------------------------------------------------------- handler */

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = req.method.toUpperCase();

  if (!secret()) {
    return json({ error: "not_configured", message: "SESSION_SECRET is not set on this site." }, 503);
  }

  /* ---- login ---- */
  if (path === "login" && method === "POST") {
    let body = {};
    try { body = await req.json(); } catch (e) {}
    const name = String(body.name || "").trim().slice(0, 60);
    const code = String(body.code || "");
    if (!name) return json({ error: "name_required" }, 400);

    let role = null;
    if (codeMatches(code, process.env.EDITOR_CODE)) role = "editor";
    else if (codeMatches(code, process.env.VIEWER_CODE)) role = "viewer";
    if (!role) return json({ error: "bad_code" }, 401);

    const token = makeToken(role, name);
    return json({ role, name }, 200, { "set-cookie": cookieHeader(token, SESSION_DAYS * 86400) });
  }

  if (path === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": cookieHeader("", 0) });
  }

  /* ---- everything below needs a session ---- */
  const session = sessionOf(req);

  if (path === "me") {
    if (!session) return json({ error: "unauthorized" }, 401);
    return json({ role: session.role, name: session.name });
  }

  if (!session) return json({ error: "unauthorized" }, 401);
  const isEditor = session.role === "editor";

  /* ---- map state ---- */
  if (path === "state") {
    if (method === "GET") {
      const st = await readBlob(STATE_KEY, emptyState());
      return json(st);
    }
    if (method === "PUT") {
      if (!isEditor) return json({ error: "forbidden" }, 403);
      let body = {};
      try { body = await req.json(); } catch (e) {}
      if (!body.data || !Array.isArray(body.data.tiles)) {
        return json({ error: "bad_payload" }, 400);
      }
      const clientRev = Number(body.rev) || 0;

      const out = await mutate(STATE_KEY, emptyState, (cur) => {
        // rev 0 from the client means "seed it" — only allowed when empty.
        if (cur.rev !== clientRev) {
          return { abort: true, conflict: true, current: cur };
        }
        return {
          value: {
            rev: cur.rev + 1,
            updated: new Date().toISOString(),
            updatedBy: session.name,
            data: body.data,
          },
        };
      });

      if (out.abort && out.conflict) {
        return json({ error: "conflict", rev: out.current.rev, data: out.current.data }, 409);
      }
      return json({ rev: out.value.rev, updated: out.value.updated, updatedBy: out.value.updatedBy });
    }
    return json({ error: "method_not_allowed" }, 405);
  }

  /* ---- alerts ---- */
  if (path === "alerts") {
    if (method === "GET") {
      const al = await readBlob(ALERTS_KEY, emptyAlerts());
      return json(al);
    }

    if (method === "POST") {
      // Viewers AND editors may file reports — that is the whole point of viewers.
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const alert = sanitizeAlert(body.alert || body, session);
      const out = await mutate(ALERTS_KEY, emptyAlerts, (cur) => ({
        value: {
          rev: (cur.rev || 0) + 1,
          items: [alert, ...(cur.items || [])].slice(0, 800),
        },
      }));
      return json({ rev: out.value.rev, alert });
    }

    if (method === "PATCH") {
      // Resolving/deleting a report is an editor action.
      if (!isEditor) return json({ error: "forbidden" }, 403);
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const id = String(body.id || "");
      const status = body.status === "resolved" ? "resolved" : "open";
      const remove = body.remove === true;

      const out = await mutate(ALERTS_KEY, emptyAlerts, (cur) => {
        const items = (cur.items || []).slice();
        const idx = items.findIndex((a) => a.id === id);
        if (idx < 0) return { abort: true, notFound: true };
        if (remove) {
          items.splice(idx, 1);
        } else {
          items[idx] = Object.assign({}, items[idx], {
            status,
            resolvedAt: status === "resolved" ? new Date().toISOString() : null,
            resolvedBy: status === "resolved" ? session.name : null,
          });
        }
        return { value: { rev: (cur.rev || 0) + 1, items } };
      });

      if (out.abort) return json({ error: "not_found" }, 404);
      return json({ rev: out.value.rev, items: out.value.items });
    }

    return json({ error: "method_not_allowed" }, 405);
  }

  /* ---- combined polling endpoint ---- */
  if (path === "sync" && method === "GET") {
    const srev = Number(url.searchParams.get("srev"));
    const arev = Number(url.searchParams.get("arev"));
    const [st, al] = await Promise.all([
      readBlob(STATE_KEY, emptyState()),
      readBlob(ALERTS_KEY, emptyAlerts()),
    ]);
    const out = { srev: st.rev || 0, arev: al.rev || 0, role: session.role, name: session.name };
    if (!Number.isFinite(srev) || srev !== (st.rev || 0)) out.state = st;
    if (!Number.isFinite(arev) || arev !== (al.rev || 0)) out.alerts = al;
    return json(out);
  }

  return json({ error: "not_found", path }, 404);
};

export const config = { path: "/api/*" };
