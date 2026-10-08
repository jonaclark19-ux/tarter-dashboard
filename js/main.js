// Page state, clock, TV mode and scaling.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

var TV_SNAPSHOT = window.__TV_SNAPSHOT__ || null;
var TV_REFRESH_MS = window.__TV_REFRESH_MS_OVERRIDE__ || 6e4;
var state = {
  result: TV_SNAPSHOT ? TV_SNAPSHOT.result : null,
  statusTone: TV_SNAPSHOT && TV_SNAPSHOT.result ? "success" : "sample"
};
function updateClock() {
  const now = plantNow();
  // Text is only written when it changes: weak TV browsers re-lay-out on every write.
  setTextIfChanged(document.getElementById("clock-time"), now.toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  setTextIfChanged(document.getElementById("clock-date"), now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase());
  updateShiftKpi();
}
// The card grid is authored for a 1800 px-wide canvas (main is max-w-[1800px]).
// Auto mode lays the page out at that width whatever the panel reports, so a 4K TV
// gets big type instead of a postage stamp and a 1366-wide TV keeps four columns
// instead of collapsing to two.
var TV_DESIGN_WIDTH = 1800;
var TV_SCALE_MIN = 0.25;
var TV_SCALE_MAX = 3;
// Some Smart TV browsers (seen on Hisense/VIDAA) report a window.innerWidth/Height
// well below the panel's real resolution - the page then fits itself to that smaller
// number and leaves the rest of the screen black. window.screen.width/height reflects
// the physical panel instead, so TV mode prefers it when it's the larger of the two.
// This flag is only ever true in kiosk/TV mode (enterTvMode), never for the normal
// admin view someone might have windowed on a desktop monitor.
var IS_TV_MODE = false;
function clampTvScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(TV_SCALE_MAX, Math.max(TV_SCALE_MIN, n));
}
/** "auto" stays the string "auto"; anything else becomes a clamped number. */
function normalizeTvScale(value) {
  if (value === null || value === void 0 || value === "") return null;
  if (String(value).trim().toLowerCase() === "auto") return "auto";
  const n = Number(value);
  return Number.isFinite(n) ? clampTvScale(n) : null;
}
// &pad=N (0-15) keeps an N% blank margin on every side of the TV page. For TVs that
// zoom their HDMI input ("overscan") and cut the edges off, with no picture-size
// setting to turn it off: the dashboard shrinks itself into the part that is visible.
var TV_PAD_PCT = (function () {
  const m = /[?&]pad=([0-9.]+)/.exec(location.search);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) ? Math.min(15, Math.max(0, n)) : 0;
})();
function viewportSize() {
  const full = rawViewportSize();
  const ox = Math.round(full.w * TV_PAD_PCT / 100);
  const oy = Math.round(full.h * TV_PAD_PCT / 100);
  return { w: full.w - 2 * ox, h: full.h - 2 * oy, ox, oy, fullW: full.w, fullH: full.h };
}
function rawViewportSize() {
  const vv = window.visualViewport;
  const winW = Math.round((vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || TV_DESIGN_WIDTH);
  const winH = Math.round((vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 1000);
  // Only trust window.screen over the window's own reported size when the browser is
  // actually filling the screen (outerWidth close to screen.width) - true on a TV
  // running fullscreen/kiosk, but NOT true for someone testing this in a normal,
  // windowed desktop browser, where screen.width is the whole monitor and would be
  // wrong to scale the page to.
  const nearFullscreen = window.screen && window.outerWidth && window.outerWidth >= window.screen.width * 0.95;
  if (IS_TV_MODE && nearFullscreen && window.screen.width > winW) {
    return { w: Math.round(window.screen.width), h: Math.round(window.screen.height) };
  }
  return { w: winW, h: winH };
}
/**
 * CSS "zoom" is a non-standard Chromium property. It's fine on the desktop browsers
 * this was built and tested on, but most Smart TV browsers run an older WebKit that
 * doesn't support it at all - the page then renders at its full, unscaled design
 * width and simply runs off the edges of the screen. "transform: scale()" is a real
 * CSS3 property that every TV browser we've seen supports, so TV mode uses that
 * instead. Unlike zoom, a transform never changes layout/reflow on its own, so the
 * html element is explicitly pinned to the real screen size with overflow hidden -
 * without that, the *unscaled* (larger) layout size would still be what the browser
 * measures for scrolling, leaving blank space or a scrollbar around the shrunk page.
 */
function applyTvViewport(scale, view) {
  const html = document.documentElement;
  const body = document.body;
  html.style.overflow = "hidden";
  html.style.width = (view.fullW || view.w) + "px";
  html.style.height = (view.fullH || view.h) + "px";
  body.style.transformOrigin = "top left";
  const shift = view.ox || view.oy ? "translate(" + (view.ox || 0) + "px, " + (view.oy || 0) + "px) " : "";
  body.style.transform = shift + "scale(" + scale + ")";
  // The margin around a padded page shows the html element; match the page colour.
  if (shift && !html.style.backgroundColor) html.style.backgroundColor = getComputedStyle(body).backgroundColor;
  body.style.width = (view.w - 2) / scale + "px";
  body.style.minHeight = (view.h - 2) / scale + "px";
  html.style.setProperty("--tv-scale", String(scale));
  body.dataset.tvScale = String(scale);
  // overflow:hidden stops the scrollbars but not an existing scroll offset: a page that
  // was scrolled before going fullscreen (F11) kept it and showed up with the header
  // and the left edge cut off. The TV page never scrolls, so always pin it to 0,0.
  if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  html.scrollTop = 0; html.scrollLeft = 0; body.scrollTop = 0; body.scrollLeft = 0;
  renderTvDebug(scale, view);
}
// &debug=1 on a TV link shows the sizes the browser reports, to diagnose a screen
// that crops or leaves borders without needing dev tools on the TV.
var TV_DEBUG = /[?&]debug=1(&|$)/.test(location.search);
function renderTvDebug(scale, view) {
  if (!TV_DEBUG) return;
  let box = document.getElementById("tv-debug");
  if (!box) {
    box = document.createElement("div");
    box.id = "tv-debug";
    box.style.cssText = "position:fixed;left:8px;top:8px;z-index:99999;background:rgba(0,0,0,.85);color:#0f0;font:bold 16px/1.4 monospace;padding:10px 14px;border-radius:6px;white-space:pre;pointer-events:none";
    document.documentElement.appendChild(box);
  }
  const vv = window.visualViewport;
  box.textContent = [
    "inner " + window.innerWidth + "x" + window.innerHeight + "  outer " + window.outerWidth + "x" + window.outerHeight,
    "screen " + (window.screen ? window.screen.width + "x" + window.screen.height : "?") + "  dpr " + window.devicePixelRatio,
    "visualViewport " + (vv ? Math.round(vv.width) + "x" + Math.round(vv.height) + " scale " + vv.scale : "n/a"),
    "used " + view.w + "x" + view.h + (TV_PAD_PCT ? "  pad " + TV_PAD_PCT + "%" : "") + "  tvScale " + scale,
    "scroll " + window.scrollX + "," + window.scrollY
  ].join("\n");
}
/**
 * Width sets the first guess (lay the cards out on the 1800 px canvas they were drawn
 * for); if the cards still do not fit the panel height, back the zoom off until they
 * do. Backing off widens the canvas as well, so tall cards get shorter too.
 */
function computeAutoTvScale() {
  const view = viewportSize();
  let scale = Math.min(TV_SCALE_MAX, Math.max(TV_SCALE_MIN, view.w / TV_DESIGN_WIDTH));
  for (let pass = 0; pass < 6; pass++) {
    applyTvViewport(scale, view);
    // applyTvViewport just forced a min-height equal to the room we're trying to fit
    // into, so body.scrollHeight would otherwise report that floor back to us instead
    // of the content's real height - every pass would look like it already fits, and
    // the loop would never back the scale off. Clear it right before measuring so
    // scrollHeight reflects the actual, unforced content height at this width.
    document.body.style.minHeight = "0px";
    const roomH = (view.h - 2) / scale;
    const contentH = document.body.scrollHeight;
    if (!contentH || contentH <= roomH + 1) break;
    const next = Math.max(TV_SCALE_MIN, scale * (roomH / contentH));
    if (next >= scale - 1e-3) break;
    scale = next;
  }
  scale = Math.round(scale * 1e4) / 1e4;
  applyTvViewport(scale, view);
  return scale;
}
var tvScaleMode = 1;
var tvScaleApplied = 1;
function getRuntimeTvScale(snap) {
  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(location.search).get("scale");
  } catch (err) {
    fromQuery = null;
  }
  // Precedence: the URL, then what an exported TV page carries, then auto.
  return normalizeTvScale(fromQuery)
    || normalizeTvScale(window.__TV_SCALE_OVERRIDE__)
    || normalizeTvScale(snap && snap.tvScale)
    || "auto";
}
function applyTvScale(scale) {
  const mode = normalizeTvScale(scale) || "auto";
  tvScaleMode = mode;
  tvScaleApplied = mode === "auto" ? computeAutoTvScale() : mode;
  // A hand-picked scale gets the same explicit canvas, so 110% no longer pushes the
  // right-hand column off the screen.
  if (mode !== "auto") applyTvViewport(tvScaleApplied, viewportSize());
  return tvScaleApplied;
}
/** Re-fit after a resize or after new data changed how tall the cards are. */
var tvRefitTimer = null;
function scheduleTvRefit(delay) {
  if (!tvScaleMode) return;
  clearTimeout(tvRefitTimer);
  tvRefitTimer = setTimeout(() => {
    if (tvScaleMode === "auto") {
      const next = computeAutoTvScale();
      // Re-parsing the same cards on every 10s poll can compute a scale a hair
      // different from last time (subpixel font rounding), which would otherwise
      // visibly jitter the screen every cycle for no real layout change. Only accept
      // a new scale when it actually changed; otherwise snap back to the one already
      // on screen (computeAutoTvScale already wrote `next` to the DOM, so this still
      // needs to run to restore it).
      if (Math.abs(next - tvScaleApplied) > 0.004) {
        tvScaleApplied = next;
      } else {
        applyTvViewport(tvScaleApplied, viewportSize());
      }
    } else {
      applyTvViewport(tvScaleApplied, viewportSize());
    }
  }, delay || 200);
}
function render() {
  // Sample numbers only on the source PC before it loads anything, or in ?preview=1. A
  // TV with no data yet says so instead of showing realistic-looking demo numbers.
  const waiting = !state.result && sync.mode === "url" && !LAYOUT_PREVIEW;
  const departments = state.result ? state.result.departments : waiting ? [] : sampleDepartmentsNow();
  const warnings = state.result ? state.result.warnings : [];
  renderTopKpis(departments);
  renderDeptGrid(departments, state.result ? state.result.missing : null);
  // Weekends the TVs show a plain "no shift" screen (Friday's numbers would only invite
  // a wrong read); the source PC still sees everything.
  const plantDay = plantNow().getDay();
  const weekendScreen = !waiting && sync.mode === "url" && !LAYOUT_PREVIEW && !SCHEDULE_OFF && (plantDay === 0 || plantDay === 6);
  if (weekendScreen) {
    const safety = renderSafetyTile(state.result ? state.result.safety : null);
    document.getElementById("top-kpis").innerHTML = safety;
    document.getElementById("top-kpis").style.gridTemplateColumns = safety ? "minmax(0, 1fr)" : "";
    document.getElementById("dept-grid").__lastHtml = null;
    document.getElementById("dept-grid").innerHTML = `<div class="tv-waiting" style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;text-align:center"><div style="font-size:72px;font-weight:900;letter-spacing:.06em;color:#013449">WEEKEND</div><div style="font-size:28px;font-weight:700;color:#64748b;margin-top:12px">No production shift \u00B7 back Monday ${SHIFT_START_HOUR}:00 AM</div></div>`;
  }
  if (waiting) {
    document.getElementById("top-kpis").innerHTML = "";
    const grid = document.getElementById("dept-grid");
    grid.__lastHtml = null;
    grid.innerHTML = `<div class="tv-waiting" style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:50vh;text-align:center"><div style="font-size:56px;font-weight:900;letter-spacing:.06em;color:#013449">WAITING FOR DATA</div><div style="font-size:24px;font-weight:700;color:#64748b;margin-top:12px">${sync.lastError ? "No connection to the server \u00B7 retrying" : "Connecting\u2026"}</div></div>`;
  }
  renderDataDayBadge();
  renderLoadingBar();
  if (weekendScreen || waiting) { const lb = document.getElementById("loading-bar"); if (lb) lb.style.display = "none"; }
  renderFooterAlert(departments);
  const dsLabel = document.getElementById("data-source-label");
  const uploadLabel = document.getElementById("upload-label-text");
  const liveIndicator = document.getElementById("live-indicator");
  if (state.result) {
    dsLabel.textContent = sync.mode === "folder" ? "LIVE \xB7 AUTO FOLDER" : sync.mode === "url" ? "LIVE \xB7 AUTO FEED" : "LIVE \xB7 EXCEL DATA";
    dsLabel.className = "bg-green-100 text-green-800 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border border-green-300 shadow-sm";
    uploadLabel.textContent = "Update Workbook";
    liveIndicator.classList.remove("hidden");
    liveIndicator.classList.add("flex");
  } else {
    dsLabel.textContent = "DEMO \xB7 SAMPLE DATA";
    dsLabel.className = "bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black tracking-widest uppercase border border-slate-300 shadow-inner-soft";
    uploadLabel.textContent = "Upload Workbook (.xlsx)";
    liveIndicator.classList.add("hidden");
    liveIndicator.classList.remove("flex");
  }
  const statusLine = document.getElementById("status-line");
  let statusText = "Ready";
  let statusColor = "text-slate-500";
  if (state.statusTone === "loading") {
    statusText = "Parsing workbook\u2026";
    statusColor = "text-indigo-600 animate-pulse";
  } else if (state.statusTone === "success") {
    statusText = "Excel loaded successfully";
    statusColor = "text-green-600";
  } else if (state.statusTone === "error") {
    statusText = "Parse Error";
    statusColor = "text-red-600";
  } else if (state.statusTone === "sample") {
    statusText = "Using sample data";
  }
  statusLine.className = `text-[11px] font-black tracking-wider uppercase ${statusColor}`;
  statusLine.innerHTML = escapeHtml(statusText) + (warnings.length > 0 ? ` <span class="text-[9px] ml-2 opacity-70 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">${warnings.length} warning(s)</span>` : "");
  const warningsList = document.getElementById("warnings-list");
  const warningsContainer = document.getElementById("warnings-container");
  const warningsTitle = document.getElementById("warnings-title-text");
  // A failed auto-sync belongs here, not only in the small status line: "Parse Error"
  // on its own tells nobody which file was read or what was wrong with it.
  const failure = sync.lastError ? ["AUTO-SYNC: " + sync.lastError].concat(sync.diagnostic) : [];
  const sourceOffline = sync.mode === "url" && sync.sourceStale && sync.sourceHeartbeatAt;
  const lastSeen = sourceOffline ? plantTimeText(sync.sourceHeartbeatAt) : "";
  const feedDown = feedUnreachable();
  if (sourceOffline) {
    failure.unshift("SOURCE PC OFFLINE: no update since " + lastSeen + " — showing the last data it sent. Check that the PC with Connect Folder is on and its dashboard tab is open.");
  }
  const offlineBadge = document.getElementById("source-offline-badge");
  const dataFrom = sync.sourceHeartbeatAt ? plantTimeText(sync.sourceHeartbeatAt) : sync.lastFeedOkAt ? plantTimeText(new Date(sync.lastFeedOkAt)) : "--:--";
  const sourceError = sync.mode === "url" && state.result && typeof state.result.sourceError === "string" ? state.result.sourceError : "";
  // SOURCE PC OFFLINE is not shown on the big banner (only in the warnings list).
  const tvAlert = feedDown ? "\u26A0 NO CONNECTION TO SERVER \xB7 DATA FROM " + dataFrom
    : sourceError ? "\u26A0 " + sourceError.toUpperCase() : "";
  if (offlineBadge) {
    offlineBadge.textContent = tvAlert;
    offlineBadge.classList.toggle("hidden", !tvAlert);
    offlineBadge.classList.toggle("flex", !!tvAlert);
  }
  if (liveIndicator) {
    const txt = liveIndicator.querySelector("span");
    const dot = liveIndicator.querySelector("div");
    if (txt) txt.textContent = feedDown ? "No connection" : sourceOffline ? "Source offline" : "System active";
    if (dot) dot.style.background = tvAlert ? "#ef4444" : "";
  }
  const shown = failure.concat(warnings.slice(0, 3));
  const remaining = warnings.length - Math.min(warnings.length, 3);
  if (warningsTitle) warningsTitle.textContent = "Data / System Warnings";
  if (shown.length > 0) {
    warningsContainer.classList.remove("hidden");
    warningsList.innerHTML = shown.map((w) => "<li>" + escapeHtml(w) + "</li>").join("") + (remaining > 0 ? '<li class="italic opacity-80 mt-1">+' + remaining + " more warning(s) in console</li>" : "");
  } else {
    warningsContainer.classList.add("hidden");
    warningsList.innerHTML = "";
  }
  document.getElementById("reset-btn").disabled = state.result === null;
}
document.getElementById("file-input").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  // A hand-picked workbook wins until the operator re-arms auto-sync, otherwise the
  // next poll would silently overwrite whatever they just uploaded.
  if (sync.mode !== "off") stopSync(false, "Paused — manual workbook loaded");
  state.statusTone = "loading";
  render();
  const selectedDate = document.getElementById("date-input").value;
  const buffer = await file.arrayBuffer();
  try {
    const result = await buildDashboardData(buffer, selectedDate);
    state.result = result;
    state.statusTone = "success";
    console.log("Excel parsed successfully. Warnings:", result.warnings);
  } catch (err) {
    console.error("Excel parse failed:", err);
    state.result = null;
    state.statusTone = "error";
  }
  render();
  e.target.value = "";
});
document.getElementById("reset-btn").addEventListener("click", () => {
  state.result = null;
  state.statusTone = "sample";
  render();
});
var tvScaleInput = document.getElementById("tv-scale-input");
function tvScaleToString(value) {
  return value === "auto" ? "auto" : Number(value).toFixed(2);
}
function getSelectedTvScale() {
  return normalizeTvScale(tvScaleInput ? tvScaleInput.value : "auto") || "auto";
}
if (tvScaleInput) {
  try {
    const savedScale = normalizeTvScale(localStorage.getItem("tarter-tv-scale"));
    if (savedScale) tvScaleInput.value = tvScaleToString(savedScale);
  } catch (err) {}
  tvScaleInput.addEventListener("change", () => {
    try {
      localStorage.setItem("tarter-tv-scale", tvScaleToString(getSelectedTvScale()));
    } catch (err) {}
  });
}
/**
 * Tailwind's responsive classes (md:, xl:, 2xl: - grid columns, font sizes, paddings)
 * are CSS media queries on the browser's reported viewport width, which our scaling
 * cannot influence. Smart TV browsers often report half their real width (960 px on a
 * 1080p panel), so those rules switch off and the TV gets the phone layout: two stacked
 * columns, smaller type - even though we lay the page out 1800 px wide. TV mode always
 * wants the layout it was designed at, so copy every min-width rule up to the design
 * width into an unconditional stylesheet appended after the original (same specificity,
 * later in the cascade, ascending breakpoint order preserved).
 */
function forceDesignBreakpoints() {
  if (document.getElementById("tv-forced-breakpoints")) return;
  const copied = [];
  const sheets = Array.prototype.slice.call(document.styleSheets);
  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (err) { continue; }
    if (!rules) continue;
    for (const rule of Array.prototype.slice.call(rules)) {
      if (!rule.cssRules || !rule.media) continue;
      const cond = rule.conditionText || rule.media.mediaText || "";
      const m = /^\s*(?:(?:only\s+)?screen\s+and\s+)?\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)\s*$/i.exec(cond);
      if (!m || Number(m[1]) > TV_DESIGN_WIDTH) continue;
      for (const inner of Array.prototype.slice.call(rule.cssRules)) copied.push(inner.cssText);
    }
  }
  if (!copied.length) return;
  const style = document.createElement("style");
  style.id = "tv-forced-breakpoints";
  style.textContent = copied.join("\n");
  document.head.appendChild(style);
}
function enterTvMode(snap) {
  snap = snap || {};
  IS_TV_MODE = true;
  forceDesignBreakpoints();
  // Belt and braces for the one layout rule that matters most: four columns side by
  // side, even if a TV browser refused the stylesheet copy above.
  const topKpis = document.getElementById("top-kpis");
  const deptGrid = document.getElementById("dept-grid");
  // The KPI row sets its own columns in renderTopKpis (3 or 4 tiles).
  if (topKpis && !LAYOUT_V2) topKpis.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  if (deptGrid) deptGrid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  // A TV page never scrolls; snap back if anything (keys, focus, restore) moves it.
  window.addEventListener("scroll", () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, { passive: true });
  const activeTvScale = applyTvScale(getRuntimeTvScale(snap));
  const bar = document.getElementById("control-bar");
  if (bar) bar.style.display = "none";
  // TVs drop the footer (its alert repeated the cards). The offline / no-connection
  // warning, the TV's one cue that the numbers are old, becomes a big fixed banner.
  const footer = document.querySelector("footer");
  const offline = document.getElementById("source-offline-badge");
  if (offline) {
    document.body.appendChild(offline);
    offline.classList.add("tv-alert-banner");
  }
  if (footer) footer.style.display = "none";
  const li = document.getElementById("live-indicator");
  let tvLabel = null;
  // The TV MODE / NEXT CHECK chip is for troubleshooting only: &debug=1 shows it.
  if (li && li.parentElement && /[?&]debug=1(&|$)/.test(location.search)) {
    const chip = document.createElement("div");
    chip.className = "flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/20";
    tvLabel = document.createElement("span");
    tvLabel.className = "text-[10px] font-bold tracking-widest text-tarter-beige uppercase";
    chip.appendChild(tvLabel);
    li.parentElement.insertBefore(chip, li);
  }
  const dataStamp = () => {
    // On a shared-feed screen, "DATA" is when the source PC last confirmed its numbers.
    const when = sync.sourceHeartbeatAt || sync.lastOkAt || (snap.exportedAt ? new Date(snap.exportedAt) : null);
    return when ? plantTimeText(when) : "--:--";
  };
  const paint = (tail) => {
    if (!tvLabel) return;
    const scaleText = (tvScaleMode === "auto" ? "AUTO " : "") + Math.round(tvScaleApplied * 100) + "%";
    tvLabel.textContent = "TV MODE \xB7 DATA " + dataStamp() + " \xB7 SCALE " + scaleText + (tail || "");
  };
  let secondsLeft = Math.round(TV_REFRESH_MS / 1e3);
  const tick = () => {
    // While a live source is connected the page refreshes its own data, so it must not
    // reload itself — a reload would blank the TV every minute and drop the folder grant.
    if (sync.mode !== "off") {
      const secs = sync.nextAt ? Math.max(0, Math.round((sync.nextAt - Date.now()) / 1e3)) : 0;
      const stale = sync.mode === "url" && sync.sourceStale ? " \xB7 SOURCE OFFLINE" : "";
      paint(stale + (sync.lastError ? " \xB7 FEED ERROR \xB7 RETRY " + secs + "S" : " \xB7 NEXT CHECK " + secs + "S"));
      secondsLeft = Math.round(TV_REFRESH_MS / 1e3);
      return;
    }
    secondsLeft -= 1;
    paint(" \xB7 NEXT CHECK " + secondsLeft + "S");
    if (secondsLeft <= 0) {
      // Keep every other query parameter (tv=1, src=...), and keep auto-fit as auto
      // instead of freezing whatever size the first fit happened to pick.
      const next = new URL(location.href);
      next.searchParams.set("_r", String(Date.now()));
      next.searchParams.set("scale", tvScaleMode === "auto" ? "auto" : String(activeTvScale));
      location.replace(next.href);
    }
  };
  paint("");
  setInterval(tick, 1e3);
  // The first measurement runs before the web font and the cards have settled, and a
  // TV can report its real size a moment after the browser opens full screen.
  setTimeout(() => scheduleTvRefit(0), 400);
  setTimeout(() => scheduleTvRefit(0), 2500);
  window.addEventListener("resize", () => scheduleTvRefit(250));
  window.addEventListener("orientationchange", () => scheduleTvRefit(400));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", () => scheduleTvRefit(250));
  // Taller or shorter cards (a new downtime note, a shortage banner) change the fit.
  const grid = document.getElementById("dept-grid");
  if (grid && typeof MutationObserver === "function") {
    new MutationObserver(() => scheduleTvRefit(300)).observe(grid, { childList: true, subtree: true });
  }
}
