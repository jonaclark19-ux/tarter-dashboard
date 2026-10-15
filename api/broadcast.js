import { getBroadcast, setBroadcast } from "../lib/db.js";
import { cleanMessage, clearMessage, feedSummary } from "../lib/broadcast.js";

// Screen messages sent from the main dashboard.
//   POST { kind, title, text, image?, seconds, target }  -> shows it on the screens
//   POST { clear: true }                                 -> closes it everywhere
//   GET  ?id=...                                         -> that message's photo, for the screens
// Sending needs the same key as /api/publish when PUBLISH_KEY is set in Vercel.
export default async function handler(req, res) {
  if (req.method === "GET") {
    const id = req.query && typeof req.query.id === "string" ? req.query.id : "";
    let msg;
    try { msg = await getBroadcast(); } catch (err) {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({ error: err.code || "read_failed", message: err.message });
      return;
    }
    if (!id || !msg || msg.id !== id || !msg.image) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).json({ error: "not_found" });
      return;
    }
    // One message id never changes, so every TV after the first gets it from the edge.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600");
    res.status(200).json({ id: msg.id, image: msg.image });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const requiredKey = (process.env.PUBLISH_KEY || "").trim();
  if (requiredKey && String(req.headers["x-publish-key"] || "").trim() !== requiredKey) {
    res.status(401).json({ error: "bad_key", message: "publish key missing or wrong" });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const now = Date.now();
  let msg;
  if (body.clear === true) msg = clearMessage(now);
  else {
    const r = cleanMessage(body, now);
    if (r.error) {
      res.status(r.error === "too_large" ? 413 : 400).json(r);
      return;
    }
    msg = r.ok;
  }
  try {
    await setBroadcast(msg);
  } catch (err) {
    res.status(503).json({ error: err.code || "write_failed", message: err.message });
    return;
  }
  res.status(200).json({ ok: true, message: feedSummary(msg, now) });
}
