// Screen messages: what the main dashboard may send, and what the TVs get to see.
// Shared by api/broadcast.js (stores it) and api/feed-snapshot.js (hands it out).

export const KINDS = ["safety", "quality", "info", "good"];
// After a message's own seconds run out, a screen that only now checks in (TVs check
// every 5 min outside the shift) may still show it within this window.
export const GRACE_MS = 6 * 6e4;
// A photo is shrunk in the browser before sending; this is the hard ceiling.
export const MAX_IMAGE_CHARS = 450 * 1024;
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function text(v, max) {
  // Plain text only: the screens put it in with textContent, never as HTML.
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}

/** -> { ok: message } or { error, message } */
export function cleanMessage(body, now) {
  const title = text(body.title, 90);
  const message = text(body.text, 400);
  if (!title && !message) return { error: "empty", message: "write a title or a message" };
  const kind = KINDS.includes(body.kind) ? body.kind : "info";
  const seconds = Math.min(300, Math.max(5, Math.round(Number(body.seconds) || 30)));
  let target = "all";
  if (body.target === "tv" || body.target === "pc") target = body.target;
  else if (typeof body.target === "string" && body.target.startsWith("screen:")) {
    const name = text(body.target.slice(7), 40);
    if (!name) return { error: "bad_target", message: "screen name missing" };
    target = "screen:" + name;
  }
  let image = null;
  if (body.image !== undefined && body.image !== null && body.image !== "") {
    if (typeof body.image !== "string" || !IMAGE_RE.test(body.image)) return { error: "bad_image", message: "image must be a JPEG, PNG or WebP" };
    if (body.image.length > MAX_IMAGE_CHARS) return { error: "too_large", message: "image is too large" };
    image = body.image;
  }
  const sentAt = new Date(now).toISOString();
  return {
    ok: {
      id: "m" + now.toString(36) + Math.random().toString(36).slice(2, 6),
      kind, title, text: message, image, seconds, target, sentAt,
      until: new Date(now + seconds * 1e3 + GRACE_MS).toISOString(),
      cleared: false
    }
  };
}

export function clearMessage(now) {
  return {
    id: "c" + now.toString(36) + Math.random().toString(36).slice(2, 6),
    cleared: true,
    sentAt: new Date(now).toISOString(),
    until: new Date(now + GRACE_MS).toISOString()
  };
}

/** What the feed carries: the live message without its photo (screens fetch that once). */
export function feedSummary(msg, now) {
  if (!msg || typeof msg !== "object" || !msg.id || !(Date.parse(msg.until) > now)) return null;
  if (msg.cleared) return { id: msg.id, cleared: true, sentAt: msg.sentAt };
  return {
    id: msg.id, kind: msg.kind, title: msg.title, text: msg.text, seconds: msg.seconds,
    target: msg.target, sentAt: msg.sentAt, hasImage: !!msg.image
  };
}
