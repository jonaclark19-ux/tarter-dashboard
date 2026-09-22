// The latest dashboard snapshot, relayed here by whichever PC has "Connect Folder"
// open. One row (id = 1) in a dedicated Supabase project. RLS is on with no policies,
// so only the service_role key - which lives in Vercel's server-side env vars, never
// in the browser - can read or write it.
const SUPABASE_URL = "https://mrqxinvuzjzpyypyeepk.supabase.co";

function headers() {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) {
    const err = new Error("SUPABASE_SERVICE_ROLE_KEY is not set in this Vercel project's Environment Variables.");
    err.code = "not_configured";
    throw err;
  }
  // The publishable key is the easy one to paste by mistake. It can't bypass RLS, so
  // reads come back empty and writes fail with a confusing 401 - say what's wrong instead.
  if (key.startsWith("sb_publishable_")) {
    const err = new Error("SUPABASE_SERVICE_ROLE_KEY holds the publishable key; paste the secret (sb_secret_...) key instead.");
    err.code = "wrong_key";
    throw err;
  }
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

async function supabaseError(resp, what) {
  let detail = "";
  try { detail = (await resp.text()).slice(0, 200); } catch (err) {}
  const err = new Error("Supabase " + what + " failed: HTTP " + resp.status + (detail ? " " + detail : ""));
  err.code = what + "_failed";
  return err;
}

export async function getSnapshot() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_snapshot?select=data,source_label,updated_at&id=eq.1`, {
    headers: headers()
  });
  if (!resp.ok) throw await supabaseError(resp, "read");
  const rows = await resp.json();
  return rows.length ? rows[0] : null;
}

export async function setSnapshot(data, sourceLabel) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_snapshot`, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, headers()),
    body: JSON.stringify({ id: 1, data, source_label: sourceLabel || null, updated_at: new Date().toISOString() })
  });
  if (!resp.ok) throw await supabaseError(resp, "write");
}

// Timing log (see /timing.html): one change_log row per real edit the source published,
// one change_seen row per screen that then showed it. Duplicates are ignored.
async function insertIgnore(table, conflict, row) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: Object.assign({ Prefer: "resolution=ignore-duplicates,return=minimal" }, headers()),
    body: JSON.stringify(row)
  });
  if (!resp.ok) throw await supabaseError(resp, "log");
}

export function logChange(row) {
  return insertIgnore("change_log", "changed_at", row);
}

export function logSeen(row) {
  return insertIgnore("change_seen", "changed_at,screen", row);
}

export async function getTiming(limit) {
  const h = headers();
  const logResp = await fetch(`${SUPABASE_URL}/rest/v1/change_log?select=changed_at,files_saved_at,newest_file&order=changed_at.desc&limit=${limit}`, { headers: h });
  if (!logResp.ok) throw await supabaseError(logResp, "read");
  const changes = await logResp.json();
  if (!changes.length) return { changes, seen: [] };
  const oldest = changes[changes.length - 1].changed_at;
  const seenResp = await fetch(`${SUPABASE_URL}/rest/v1/change_seen?select=changed_at,screen,seen_at&changed_at=gte.${encodeURIComponent(oldest)}&order=seen_at.asc&limit=2000`, { headers: h });
  if (!seenResp.ok) throw await supabaseError(seenResp, "read");
  return { changes, seen: await seenResp.json() };
}
