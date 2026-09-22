import { logSeen } from "../lib/db.js";

// A viewer screen reports the moment it first showed a change (timing log).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const changedMs = typeof body.changedAt === "string" ? Date.parse(body.changedAt) : NaN;
  const screen = typeof body.screen === "string" ? body.screen.trim().slice(0, 40) : "";
  // Only recent changes: an old tab replaying ancient stamps would skew the averages.
  if (!Number.isFinite(changedMs) || Math.abs(Date.now() - changedMs) > 36e5 || !screen) {
    res.status(400).json({ error: "bad_payload" });
    return;
  }
  try {
    await logSeen({ changed_at: new Date(changedMs).toISOString(), screen, seen_at: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ error: err.code || "write_failed", message: err.message });
    return;
  }
  res.status(200).json({ ok: true });
}
