import { getSnapshot } from "../lib/db.js";

// Called once a day by a Vercel Cron Job (vercel.json). Supabase's free plan pauses a
// project after 7 days without activity - a plant shutdown longer than that would
// otherwise leave every TV showing an error until someone restores the project by hand.
// One tiny read a day keeps it active. Harmless if anyone else calls it.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const row = await getSnapshot();
    res.status(200).json({ ok: true, lastHeartbeat: row ? row.updated_at : null });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.code || "read_failed", message: err.message });
  }
}
