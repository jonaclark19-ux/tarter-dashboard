import { getTiming } from "../lib/db.js";

function secs(later, earlier) {
  if (!later || !earlier) return null;
  return Math.round((Date.parse(later) - Date.parse(earlier)) / 100) / 10;
}
function median(list) {
  const v = list.filter((x) => x !== null && x >= 0).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) * 5) / 10;
}

// Last N real edits with: Excel saved -> dashboard detected, and detected -> each screen.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const limit = Math.min(Math.max(parseInt(req.query && req.query.limit, 10) || 20, 1), 100);
  let data;
  try {
    data = await getTiming(limit);
  } catch (err) {
    res.status(503).json({ error: err.code || "read_failed", message: err.message });
    return;
  }
  const byChange = {};
  for (const s of data.seen) {
    const key = new Date(s.changed_at).toISOString();
    (byChange[key] = byChange[key] || []).push(s);
  }
  const screens = new Set();
  const changes = data.changes.map((c) => {
    const key = new Date(c.changed_at).toISOString();
    const seen = (byChange[key] || []).map((s) => {
      screens.add(s.screen);
      return { screen: s.screen, seenAt: s.seen_at, seconds: secs(s.seen_at, c.changed_at) };
    });
    const tvSecs = seen.map((s) => s.seconds);
    const toDash = secs(c.changed_at, c.files_saved_at);
    const slowestTv = tvSecs.length ? Math.max.apply(null, tvSecs) : null;
    return {
      changedAt: c.changed_at,
      filesSavedAt: c.files_saved_at,
      file: c.newest_file,
      excelToDashboard: toDash,
      screens: seen,
      slowestScreen: slowestTv,
      total: toDash !== null && slowestTv !== null ? Math.round((toDash + slowestTv) * 10) / 10 : null
    };
  });
  res.status(200).json({
    serverTime: new Date().toISOString(),
    screens: Array.from(screens).sort(),
    medians: {
      excelToDashboard: median(changes.map((c) => c.excelToDashboard)),
      dashboardToScreens: median(changes.flatMap((c) => c.screens.map((s) => s.seconds))),
      total: median(changes.map((c) => c.total))
    },
    changes
  });
}
