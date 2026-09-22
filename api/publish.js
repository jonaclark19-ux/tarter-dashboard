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

function validIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

// Called by whichever PC has "Connect Folder" open (the real source of data): once
// whenever its numbers change, and otherwise as a heartbeat about once a minute.
// Deliberately unauthenticated ("the link is enough"); anyone who finds this URL could
// overwrite what the TVs show. Add a shared secret here if that becomes a concern.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const result = body.result;
  if (!result || !Array.isArray(result.departments) || result.departments.length === 0 || result.departments.length > 12) {
    res.status(400).json({ error: "bad_payload", message: "expected { result: { departments: [1..12 items] } }" });
    return;
  }
  const size = JSON.stringify(result).length;
  if (size > MAX_BYTES) {
    res.status(413).json({ error: "too_large", message: "snapshot is " + size + " bytes" });
    return;
  }

  // _changedAt only moves when the source's numbers change, so the TVs re-render only
  // then; the row's updated_at moves on every call and is the heartbeat.
  const now = new Date().toISOString();
  const data = Object.assign({}, result, {
    _changedAt: validIso(body.changedAt) || now,
    _filesSavedAt: validIso(body.filesSavedAt)
  });

  // The first send after the source page (re)opens can't tell a real edit from a plain
  // reload on its own; compare with what the TVs had before overwriting it.
  let realChange = body.changed === true && body.firstAfterLoad !== true;
  if (body.changed === true && body.firstAfterLoad === true) {
    try {
      const prev = await getSnapshot();
      if (prev && prev.data) {
        const old = Object.assign({}, prev.data);
        delete old._changedAt;
        delete old._filesSavedAt;
        realChange = canonical(old) !== canonical(result);
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
  res.status(200).json({ ok: true, heartbeatAt: now });
}
