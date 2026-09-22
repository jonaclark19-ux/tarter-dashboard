import { getSnapshot } from "../lib/db.js";

// Shape matches what dashboard.html's pullFromUrl() already understands as an
// "already-parsed snapshot" feed (departments at the top level), plus:
//   updatedAt   - when the numbers last changed (the TVs' change signature)
//   heartbeatAt - when the source PC last checked in (stale-source detection)
//   serverTime  - so a TV with a wrong clock still measures heartbeat age correctly
export default async function handler(req, res) {
  let row;
  try {
    row = await getSnapshot();
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: err.code || "read_failed", message: err.message });
    return;
  }
  if (!row || !row.data || !Array.isArray(row.data.departments)) {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).json({ error: "no_snapshot", message: "Nobody has connected a folder and published yet." });
    return;
  }

  const data = Object.assign({}, row.data);
  const changedAt = data._changedAt || row.updated_at;
  const filesSavedAt = data._filesSavedAt || null;
  delete data._changedAt;
  delete data._filesSavedAt;

  const payload = Object.assign(data, {
    updatedAt: changedAt,
    heartbeatAt: row.updated_at,
    filesSavedAt,
    serverTime: new Date().toISOString(),
    fileName: row.source_label || "published snapshot"
  });

  // Cached for a few seconds at Vercel's edge: every TV polls every 10 s, and this keeps
  // the function (and Supabase) at roughly one call per few seconds however many TVs
  // there are. Browsers still revalidate every time (max-age=0).
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=5, stale-while-revalidate=5");
  res.status(200).json(payload);
}
