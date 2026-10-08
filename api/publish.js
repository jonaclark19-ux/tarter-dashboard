import { getSnapshot, setSnapshot, logChange } from "../lib/db.js";

const MAX_BYTES = 200 * 1024;

// Postgres jsonb reorders object keys, so compare with sorted keys.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value === undefined ? null : value);
}

// What counts as "the numbers changed": bookkeeping fields and the source's time zone
// don't, and an empty missing-departments list is the same as none.
function comparable(data) {
  const out = Object.assign({}, data);
  delete out._changedAt;
  delete out._filesSavedAt;
  delete out.timeZone;
  if (Array.isArray(out.missing) && out.missing.length === 0) delete out.missing;
  // Optional blocks (safety, loading) that aren't there yet: null is the same as absent.
  for (const k of Object.keys(out)) if (out[k] === null) delete out[k];
  return out;
}

// The page escapes text, but the numbers it puts into HTML must really be numbers, and
// only fields the dashboard uses are stored.
function num(v) {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
}
function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : v === null || v === undefined ? "" : String(v).slice(0, max);
}
function cleanDept(d) {
  if (!d || typeof d !== "object") return null;
  const out = Object.assign({}, d, { id: str(d.id, 40), name: str(d.name, 60), attainment: num(d.attainment) === null ? 0 : num(d.attainment) });
  if (d.weekAttainment !== undefined) out.weekAttainment = num(d.weekAttainment);
  if (d.headline && typeof d.headline === "object") {
    out.headline = Object.assign({}, d.headline, { active: num(d.headline.active), total: num(d.headline.total), icon: "\u{1F464}", label: str(d.headline.label, 60) });
  }
  out.stats = (Array.isArray(d.stats) ? d.stats : []).slice(0, 20).filter((x) => x && typeof x === "object")
    .map((x) => ({ label: str(x.label, 40), tone: str(x.tone || "default", 20), value: typeof x.value === "number" && Number.isFinite(x.value) ? x.value : str(x.value, 200) }));
  return out;
}

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

// Called by whichever PC has "Connect Folder" open (the real source of data): once
// whenever its numbers change, and otherwise as a heartbeat about once a minute.
// Optional shared key: when the PUBLISH_KEY environment variable is set in Vercel, only a
// request carrying it (header x-publish-key) may change what the TVs show. Unset, the
// endpoint stays open as before.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const requiredKey = (process.env.PUBLISH_KEY || "").trim();
  if (requiredKey && String(req.headers["x-publish-key"] || "").trim() !== requiredKey) {
    res.status(401).json({ error: "bad_key", message: "publish key missing or wrong" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const result = body.result && typeof body.result === "object" ? Object.assign({}, body.result) : null;
  if (!result || !Array.isArray(result.departments) || result.departments.length === 0 || result.departments.length > 12) {
    res.status(400).json({ error: "bad_payload", message: "expected { result: { departments: [1..12 items] } }" });
    return;
  }
  result.departments = result.departments.map(cleanDept).filter(Boolean);
  const size = JSON.stringify(result).length;
  if (size > MAX_BYTES) {
    res.status(413).json({ error: "too_large", message: "snapshot is " + size + " bytes" });
    return;
  }

  // _changedAt only moves when the source's numbers change, so the TVs re-render only
  // then; the row's updated_at moves on every call and is the heartbeat.
  // A change is stamped with the server's clock, so a source PC whose clock is off doesn't
  // skew the timing log; heartbeats send back the stamp this endpoint returned.
  const now = new Date().toISOString();
  const data = Object.assign({}, result, {
    _changedAt: body.changed === true ? now : validIso(body.changedAt) || now,
    _filesSavedAt: validIso(body.filesSavedAt)
  });

  // The first send after the source page (re)opens can't tell a real edit from a plain
  // reload on its own; compare with what the TVs had before overwriting it. A new day
  // (midnight rollover, a date picked by hand) is not an edit either.
  let realChange = body.changed === true && body.firstAfterLoad !== true;
  if (body.changed === true) {
    try {
      const prev = await getSnapshot();
      if (prev && prev.data) {
        if (body.firstAfterLoad === true) realChange = canonical(comparable(prev.data)) !== canonical(comparable(result));
        if (prev.data.selectedDate !== result.selectedDate) realChange = false;
      }
    } catch (err) {}
  }

  try {
    await setSnapshot(data, typeof body.sourceLabel === "string" ? body.sourceLabel.slice(0, 300) : "");
  } catch (err) {
    res.status(503).json({ error: err.code || "write_failed", message: err.message });
    return;
  }
  // Timing log: a real edit (not the first send after the source page opened). Never
  // fails the publish - the TVs matter more than the stats.
  if (realChange) {
    try {
      await logChange({
        changed_at: data._changedAt,
        files_saved_at: data._filesSavedAt,
        newest_file: typeof body.newestFile === "string" ? body.newestFile.slice(0, 200) : null,
        source_label: typeof body.sourceLabel === "string" ? body.sourceLabel.slice(0, 300) : null
      });
    } catch (err) {}
  }
  res.status(200).json({ ok: true, heartbeatAt: now, changedAt: data._changedAt });
}
