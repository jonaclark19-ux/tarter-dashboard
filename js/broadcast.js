// Screen messages: from the main dashboard, send a pop-up (safety reminder, quality
// alert with a photo, ...) that shows over the TVs and office computers for a few
// seconds and then closes by itself.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

// The quick-message buttons. Edit, add or remove entries here; kind is one of
// safety / quality / info / good (sets the colour and the label on the screens).
var BROADCAST_PRESETS = [
  { label: "PPE reminder", kind: "safety", title: "Wear your PPE", text: "Safety glasses, gloves and hearing protection at all times on the floor." },
  { label: "Forklift traffic", kind: "safety", title: "Watch for forklifts", text: "Stay in the marked walkways. Make eye contact with the driver before you cross." },
  { label: "Stay hydrated", kind: "safety", title: "Stay hydrated", text: "Drink water every 20 minutes and take your breaks in the shade." },
  { label: "Quality alert", kind: "quality", title: "Quality alert", text: "Check every weld on this part before it goes to Paint. If it looks like the photo, stop and call your lead." },
  { label: "Clean up / 5S", kind: "info", title: "5S: clean your area", text: "Last 15 minutes of the shift: clean and organize your work station." },
  { label: "Team huddle", kind: "info", title: "Team huddle in 5 minutes", text: "Meet at the front of the shop." },
  { label: "Great job", kind: "good", title: "Great job, team!", text: "We hit today's goal. Thank you!" }
];
var BROADCAST_KINDS = {
  safety: { label: "Safety", band: "#f59e0b", ink: "#1b1f24", icon: "!" },
  quality: { label: "Quality alert", band: "#dc2626", ink: "#ffffff", icon: "!" },
  info: { label: "Notice", band: "#013449", ink: "#ffffff", icon: "i" },
  good: { label: "Good news", band: "#15803d", ink: "#ffffff", icon: "✓" }
};
var BROADCAST_SECONDS = [15, 30, 45, 60, 90, 120];
var BROADCAST_SEEN_LS = "tarter-broadcast-seen";
var BROADCAST_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
var broadcastShown = { id: null, timer: null, el: null };

// ---- Screens: show what the feed carries -------------------------------------------

/** "all", "tv", "pc" or "screen:Name" (the &screen= in the TV's link, e.g. /tv/Soldadura). */
function broadcastTargetsMe(target) {
  if (!target || target === "all") return true;
  if (target === "tv") return IS_TV_MODE && !IS_PC_MODE;
  if (target === "pc") return IS_PC_MODE;
  if (target.indexOf("screen:") === 0) {
    const mine = (queryParam("screen") || "").trim().toLowerCase();
    return !!mine && target.slice(7).trim().toLowerCase() === mine;
  }
  return false;
}

/** Called by pullFromUrl with every feed response. Each message shows once per screen. */
function handleBroadcast(payload) {
  const msg = payload && payload.broadcast;
  if (!msg || typeof msg.id !== "string") return;
  if (msg.id === broadcastShown.id || lsGet(BROADCAST_SEEN_LS) === msg.id) return;
  broadcastShown.id = msg.id;
  // Remembered across reloads, so a TV that restarts doesn't show it a second time.
  lsSet(BROADCAST_SEEN_LS, msg.id);
  if (msg.cleared) { closeBroadcast(); return; }
  if (!broadcastTargetsMe(msg.target)) return;
  if (!msg.hasImage) { showBroadcast(msg, null); return; }
  let photoUrl;
  try { photoUrl = new URL("broadcast?id=" + encodeURIComponent(msg.id), new URL(sync.url, location.href)).href; } catch (err) { showBroadcast(msg, null); return; }
  // The photo comes separately (once per message, cached at the edge), so the feed the
  // TVs poll every 15 s stays a few KB. No photo after 15 s: show the words anyway.
  fetchWithTimeout(photoUrl, {}, 15e3)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((j) => {
      if (broadcastShown.id !== msg.id) return;
      showBroadcast(msg, j && typeof j.image === "string" && BROADCAST_IMAGE_RE.test(j.image) ? j.image : null);
    });
}

function closeBroadcast() {
  clearTimeout(broadcastShown.timer);
  broadcastShown.timer = null;
  if (broadcastShown.el && broadcastShown.el.parentNode) broadcastShown.el.parentNode.removeChild(broadcastShown.el);
  broadcastShown.el = null;
}

function bcEl(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  // Always textContent: nothing that arrives in a message is ever treated as HTML.
  if (text) node.textContent = text;
  return node;
}

/** The pop-up itself. On TVs it sits inside the scaled page, so sizes are in canvas px. */
function showBroadcast(msg, image) {
  closeBroadcast();
  const kind = BROADCAST_KINDS[msg.kind] || BROADCAST_KINDS.info;
  const seconds = Math.min(300, Math.max(5, Number(msg.seconds) || 30));
  const overlay = bcEl("div", "bc-overlay" + (IS_TV_MODE ? "" : " bc-compact"));
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-live", "assertive");
  const card = bcEl("div", "bc-card");
  card.style.borderColor = kind.band;
  const band = bcEl("div", "bc-band");
  band.style.background = kind.band;
  band.style.color = kind.ink;
  const icon = bcEl("span", "bc-icon", kind.icon);
  icon.style.color = kind.band;
  icon.style.background = kind.ink;
  band.appendChild(icon);
  band.appendChild(bcEl("span", "bc-kind", kind.label));
  const sent = msg.sentAt ? new Date(msg.sentAt) : new Date();
  band.appendChild(bcEl("span", "bc-time", Number.isFinite(sent.getTime()) ? plantTimeText(sent) : ""));
  card.appendChild(band);

  const body = bcEl("div", "bc-body" + (image ? " bc-has-image" : ""));
  if (image) {
    const img = bcEl("img", "bc-img");
    img.alt = "";
    img.src = image;
    body.appendChild(img);
  }
  const words = bcEl("div", "bc-words");
  if (msg.title) words.appendChild(bcEl("div", "bc-title", msg.title));
  if (msg.text) words.appendChild(bcEl("div", "bc-text", msg.text));
  body.appendChild(words);
  card.appendChild(body);

  const bar = bcEl("div", "bc-bar");
  const fill = bcEl("div", "bc-bar-fill");
  fill.style.background = kind.band;
  bar.appendChild(fill);
  card.appendChild(bar);
  overlay.appendChild(card);
  // Office PCs and the preview can close it early; TVs have no mouse and just wait.
  overlay.addEventListener("click", closeBroadcast);
  document.body.appendChild(overlay);
  broadcastShown.el = overlay;
  // The countdown bar is one CSS transition: nothing for a weak TV browser to redraw.
  void fill.offsetWidth;
  fill.style.transition = "width " + seconds + "s linear";
  fill.style.width = "0%";
  broadcastShown.timer = setTimeout(closeBroadcast, seconds * 1e3);
}
document.addEventListener("keydown", (e) => {
  // Esc closes the pop-up first; the sending panel behind it stays open.
  if (e.key === "Escape" && broadcastShown.el) { e.preventDefault(); closeBroadcast(); }
});

// ---- Main dashboard: the panel that sends them ---------------------------------------

/** A phone photo is several MB; shrink it to a JPEG of ~300 KB at most before sending. */
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("could not read the photo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("that file is not a picture this browser can open"));
      img.onload = () => {
        let side = 1280;
        for (let round = 0; round < 6; round++) {
          const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
          const ctx = canvas.getContext("2d");
          // White behind transparent PNGs (JPEG would turn it black).
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          for (const q of [0.85, 0.72, 0.6]) {
            const out = canvas.toDataURL("image/jpeg", q);
            if (out.length <= 300 * 1024) { resolve(out); return; }
          }
          side = Math.round(side * 0.75);
        }
        reject(new Error("the photo is too large even after shrinking it"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

var broadcastForm = { image: null, panel: null };

function buildBroadcastPanel() {
  const backdrop = bcEl("div", "bc-panel-backdrop");
  // Static markup only; every value is set afterwards with .value / textContent.
  backdrop.innerHTML =
    '<div class="bc-panel" role="dialog" aria-modal="true" aria-labelledby="bc-panel-title">' +
    '<div class="bc-panel-head"><div><div id="bc-panel-title" class="bc-panel-title">Send a message to the screens</div>' +
    '<div class="bc-panel-sub">It pops up over the dashboard on the TVs and office computers, then closes by itself.</div></div>' +
    '<button type="button" class="bc-x" data-bc="close" aria-label="Close">✕</button></div>' +
    '<div class="bc-section">Quick messages</div><div class="bc-presets" data-bc="presets"></div>' +
    '<div class="bc-grid">' +
    '<label class="bc-field"><span>Type</span><select data-bc="kind"></select></label>' +
    '<label class="bc-field"><span>Show for</span><select data-bc="seconds"></select></label>' +
    '<label class="bc-field bc-wide"><span>Title</span><input data-bc="title" maxlength="90" placeholder="Short and big, e.g. Wear your PPE"></label>' +
    '<label class="bc-field bc-wide"><span>Message</span><textarea data-bc="text" maxlength="400" rows="3" placeholder="One or two sentences"></textarea></label>' +
    '<label class="bc-field"><span>Send to</span><select data-bc="target">' +
    '<option value="all">All screens</option><option value="tv">TVs only</option><option value="pc">Office computers only</option><option value="screen">One screen…</option></select></label>' +
    '<label class="bc-field" data-bc="screen-wrap" hidden><span>Screen name (as in /tv/Name)</span><input data-bc="screen" maxlength="40" placeholder="e.g. Soldadura"></label>' +
    '<div class="bc-field bc-wide"><span>Photo (optional)</span><div class="bc-photo-row">' +
    '<input type="file" accept="image/*" data-bc="file"><img data-bc="thumb" class="bc-thumb" alt="" hidden>' +
    '<button type="button" class="bc-btn bc-btn-ghost" data-bc="nophoto" hidden>Remove photo</button></div></div>' +
    '<label class="bc-field bc-wide" data-bc="key-wrap" hidden><span>Publish key (the same one the source PC uses)</span><input data-bc="key" type="password" autocomplete="off"></label>' +
    '</div>' +
    '<div class="bc-actions"><button type="button" class="bc-btn bc-btn-ghost" data-bc="preview">Preview here</button>' +
    '<button type="button" class="bc-btn bc-btn-stop" data-bc="stop">Stop message on screens</button>' +
    '<button type="button" class="bc-btn bc-btn-send" data-bc="send">Send to screens</button></div>' +
    '<div class="bc-status" data-bc="status" aria-live="polite"></div></div>';
  const q = (name) => backdrop.querySelector('[data-bc="' + name + '"]');

  const kindSel = q("kind");
  Object.keys(BROADCAST_KINDS).forEach((k) => {
    const o = bcEl("option", "", BROADCAST_KINDS[k].label);
    o.value = k;
    kindSel.appendChild(o);
  });
  const secSel = q("seconds");
  BROADCAST_SECONDS.forEach((s) => {
    const o = bcEl("option", "", s + " seconds");
    o.value = String(s);
    secSel.appendChild(o);
  });
  secSel.value = "30";
  const presets = q("presets");
  BROADCAST_PRESETS.forEach((p) => {
    const b = bcEl("button", "bc-preset", p.label);
    b.type = "button";
    b.style.borderLeftColor = (BROADCAST_KINDS[p.kind] || BROADCAST_KINDS.info).band;
    b.addEventListener("click", () => {
      kindSel.value = BROADCAST_KINDS[p.kind] ? p.kind : "info";
      q("title").value = p.title || "";
      q("text").value = p.text || "";
      setPhoto(null);
      setStatus("Loaded “" + p.label + "”. Edit it if you like, then Send to screens.", "");
    });
    presets.appendChild(b);
  });

  const target = q("target");
  target.addEventListener("change", () => { q("screen-wrap").hidden = target.value !== "screen"; });

  function setStatus(text, tone) {
    const s = q("status");
    s.textContent = text;
    s.className = "bc-status" + (tone ? " bc-" + tone : "");
  }
  function setPhoto(dataUrl) {
    broadcastForm.image = dataUrl;
    q("thumb").hidden = !dataUrl;
    q("nophoto").hidden = !dataUrl;
    if (dataUrl) q("thumb").src = dataUrl; else { q("thumb").removeAttribute("src"); q("file").value = ""; }
  }
  q("file").addEventListener("change", () => {
    const f = q("file").files && q("file").files[0];
    if (!f) return;
    setStatus("Preparing the photo…", "");
    shrinkImage(f).then((d) => { setPhoto(d); setStatus("Photo ready (" + Math.round(d.length / 1024) + " KB).", ""); })
      .catch((err) => { setPhoto(null); setStatus(err.message, "error"); });
  });
  q("nophoto").addEventListener("click", () => setPhoto(null));

  function message() {
    const t = target.value === "screen" ? "screen:" + q("screen").value.trim() : target.value;
    return { kind: kindSel.value, title: q("title").value.trim(), text: q("text").value.trim(), seconds: Number(secSel.value), target: t, image: broadcastForm.image };
  }
  function check(m) {
    if (!m.title && !m.text) return "Write a title or a message first.";
    if (m.target === "screen:") return "Type the screen name (the part after /tv/ in its link).";
    return "";
  }
  q("preview").addEventListener("click", () => {
    const m = message();
    const problem = check(m);
    if (problem) { setStatus(problem, "error"); return; }
    showBroadcast(Object.assign({ sentAt: new Date().toISOString() }, m), m.image);
  });

  async function post(body, what) {
    const typed = q("key").value.trim();
    if (typed) lsSet(PUBLISH_KEY_LS, typed);
    const headers = { "Content-Type": "application/json" };
    const key = publishKey();
    if (key) headers["x-publish-key"] = key;
    q("send").disabled = q("stop").disabled = true;
    setStatus(what + "…", "");
    try {
      const resp = await fetchWithTimeout("/api/broadcast", { method: "POST", headers, body: JSON.stringify(body) });
      if (resp.status === 401) {
        q("key-wrap").hidden = false;
        setStatus("The publish key is missing or wrong. Type it above and try again.", "error");
        return false;
      }
      if (!resp.ok) { setStatus("Not sent: " + (await responseErrorText(resp)), "error"); return false; }
      return true;
    } catch (err) {
      setStatus("Not sent: " + (err && err.message ? err.message : String(err)), "error");
      return false;
    } finally {
      q("send").disabled = q("stop").disabled = false;
    }
  }
  q("send").addEventListener("click", async () => {
    const m = message();
    const problem = check(m);
    if (problem) { setStatus(problem, "error"); return; }
    const where = target.options[target.selectedIndex].text.replace("…", "") + (m.target.indexOf("screen:") === 0 ? " (" + m.target.slice(7) + ")" : "");
    if (await post(m, "Sending")) {
      setStatus("Sent " + plantTimeText(new Date()) + " to " + where.toLowerCase() + ". The screens show it within 15 seconds during the shift (up to 5 minutes at night and on weekends).", "ok");
    }
  });
  q("stop").addEventListener("click", async () => {
    if (await post({ clear: true }, "Stopping")) setStatus("Stopped. The screens close the message within 15 seconds.", "ok");
  });

  const close = () => { backdrop.hidden = true; };
  q("close").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !backdrop.hidden && !e.defaultPrevented) close(); });
  document.body.appendChild(backdrop);
  return backdrop;
}

function initBroadcastSender() {
  const btn = document.getElementById("broadcast-open-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!broadcastForm.panel) broadcastForm.panel = buildBroadcastPanel();
    broadcastForm.panel.hidden = false;
  });
}
