// Auto-sync: folder reads on the source PC, publishing, TV feed polling.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

// Keeps the workbook flowing in without anyone clicking Upload.
// Two sources, same parser: a folder this browser was granted (OneDrive-synced
// SharePoint library, network share, local copy) or a URL that serves the workbook
// (local bridge script, Netlify feed, Power Automate output).
var SYNC_MIN_MS = 1e4;
// The source PC only reads its own synced folder (free), so it checks often. Viewer
// screens each cost one Vercel request per check; 30 s keeps ~10 TVs x 13 h x 22 days
// (~345k requests/month) well inside the free 1M.
var SOURCE_CHECK_MS = 5e3;
var VIEWER_CHECK_MS = 15e3;
var SYNC_LS = { url: "tarter-feed-url", interval: "tarter-feed-interval", name: "tarter-feed-name" };
var IDB_NAME = "tarter-dashboard";
var IDB_STORE = "handles";
var sync = {
  mode: "off",
  url: "",
  intervalMs: TV_REFRESH_MS,
  dirHandle: null,
  fileLabel: "",
  signature: null,
  lastOkAt: null,
  lastDateISO: null,
  lastError: null,
  diagnostic: [],
  parsedCache: {},
  lastCheckAt: 0,
  sourceSavedAt: null,
  note: "",
  busy: false,
  timer: null,
  nextAt: 0,
  needsPermission: false,
  // Source PC: result of the last publish to /api/publish, shown in its status line.
  publishStatus: "",
  // Viewer screens: when the source PC last checked in, and whether that is too long ago.
  sourceHeartbeatAt: null,
  sourceStale: false
};
var dateManuallySet = false;
// A hand-picked date lasts for the plant day it was picked on; next day the board goes
// back to following the calendar on its own.
var dateManualDay = null;

function lsGet(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}
function lsSet(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (err) {}
}
function queryParam(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (err) { return null; }
}

// Folder grants survive a reload only when the handle can be stored, and IndexedDB is
// blocked on file:// — that is why serving the page over http://localhost is worth it.
function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(IDB_NAME, 1); } catch (err) { reject(err); return; }
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB unavailable"));
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
async function idbGet(key) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

function todayISO() {
  const d = plantNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// A display left running overnight has to roll onto the new day by itself.
// Saturday/Sunday have no production tabs: follow Friday instead of letting each
// parser fall back on its own (the week-block sheets used to show Monday).
function autoTargetISO() {
  const now = plantNow();
  const back = now.getDay() === 6 ? 1 : now.getDay() === 0 ? 2 : 0;
  if (!back) return todayISO();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function syncTargetDateISO() {
  const input = document.getElementById("date-input");
  if (dateManuallySet && dateManualDay !== todayISO()) dateManuallySet = false;
  if (dateManuallySet && input && input.value) return input.value;
  const iso = autoTargetISO();
  if (input && input.value !== iso) input.value = iso;
  return iso;
}
function bufferSignature(buffer) {
  const bytes = new Uint8Array(buffer);
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i += step) { h ^= bytes[i]; h = Math.imul(h, 16777619); }
  return bytes.length + ":" + (h >>> 0).toString(16);
}
function urlFileName(url) {
  try {
    const path = new URL(url, location.href).pathname;
    const name = path.split("/").filter(Boolean).pop();
    return name || url;
  } catch (err) { return url; }
}
function isWorkbookName(name) {
  return /\.(xlsx|xlsm|xls)$/i.test(name) && !name.startsWith("~$");
}

// The Excel reader is ~250 KB - half the page. Only the source PC (and a feed that
// serves raw workbooks) needs it, so it is fetched the first time a workbook is read.
var xlsxLoading = null;
function ensureXlsx() {
  if (typeof XLSX !== "undefined" && XLSX.read) return Promise.resolve();
  if (!xlsxLoading) {
    xlsxLoading = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "vendor/xlsx.js?v=0.18.5"; // cached a year; bump v when the file changes
      tag.onload = () => (typeof XLSX !== "undefined" && XLSX.read ? resolve() : reject(new Error("Excel reader failed to start.")));
      tag.onerror = () => reject(new Error("Could not load the Excel reader (vendor/xlsx.js)."));
      document.head.appendChild(tag);
    }).catch((err) => { xlsxLoading = null; throw err; });
  }
  return xlsxLoading;
}
/** Sheet names only — cheap enough to run while reporting a failure. */
function sheetNamesOf(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: "array", bookSheets: true });
    return wb.SheetNames || [];
  } catch (err) {
    return [];
  }
}

/**
 * Hands a set of department workbooks to the parser. On failure it reports what was
 * actually read — file names, sizes and their most recent dated tabs — because the
 * parser's own message cannot say whether the wrong file or the wrong day was used.
 */
/** The parse kept from last time, when the file and the day are both unchanged. */
function cachedParseFor(fileName, signature) {
  const hit = sync.parsedCache[fileName];
  if (!hit || !signature || hit.signature !== signature) return null;
  if (hit.date !== syncTargetDateISO()) return null;
  return hit;
}

async function applyFileSet(files, sourceLabel) {
  const targetDate = syncTargetDateISO();
  let result;
  try {
    result = await buildDashboardFromFiles(files, targetDate);
  } catch (err) {
    sync.diagnostic = ["Date looked for: " + targetDate].concat(files.map((f) => {
      // A cached entry carries no buffer — reading .byteLength here would replace the
      // parser's real message with a TypeError.
      if (!f.buffer) return f.fileName + " (unchanged since the last read, reused from cache)";
      const names = sheetNamesOf(f.buffer);
      const recent = names.filter((n) => parseSheetDateISO(n)).slice(-6);
      const shown = recent.length ? recent.join(" | ") : names.length ? names.slice(0, 6).join(" | ") : "no readable sheets — not an Excel file, or still downloading from OneDrive";
      return f.fileName + " (" + Math.round(f.buffer.byteLength / 1024) + " KB) latest dated tabs: " + shown;
    }));
    throw err;
  }
  sync.diagnostic = [];
  sync.parsedCache = result.parsed || {};
  const saved = files.map((f) => f.modifiedAt).filter((t) => t);
  sync.sourceSavedAt = saved.length ? new Date(Math.max.apply(null, saved)) : null;
  const newest = files.reduce((a, f) => (f.modifiedAt && (!a || f.modifiedAt > a.modifiedAt) ? f : a), null);
  sync.sourceNewestFile = newest ? newest.fileName : "";
  if (result.sources && result.sources.length) {
    sourceLabel = result.sources.map((s) => s.label + " " + s.sheetName).join(" · ");
  }
  result.safety = safetyFor(sync.board, targetDate);
  result.loading = loadingFor(sync.loadingBooks, targetDate);
  state.result = result;
  state.statusTone = "success";
  sync.fileLabel = sourceLabel || "";
  sync.lastOkAt = /* @__PURE__ */ new Date();
  sync.lastDateISO = targetDate;
  sync.lastError = null;
  render();
}
function applyWorkbookBuffer(buffer, sourceLabel) {
  return applyFileSet([{ fileName: sourceLabel || "workbook.xlsx", buffer }], sourceLabel);
}
// TVs keep the last good feed in browser storage, so one that boots while the network
// or the server is down shows the last real numbers (with their time) instead of nothing.
var TV_LAST_GOOD_LS = "tarter-tv-last-good";
// The feed is public, so anything in it is untrusted: numbers must be numbers before
// they reach an HTML template (strings there are escaped at render time).
function sanitizeFeedResult(result) {
  const num = (v) => { const n = Number(v); return v === null || v === void 0 || v === "" || !Number.isFinite(n) ? null : n; };
  for (const d of Array.isArray(result.departments) ? result.departments : []) {
    if (!d || typeof d !== "object") continue;
    d.attainment = num(d.attainment) === null ? 0 : num(d.attainment);
    if (d.weekAttainment !== void 0) d.weekAttainment = num(d.weekAttainment);
    if (d.headline && typeof d.headline === "object") {
      d.headline.active = num(d.headline.active);
      d.headline.total = num(d.headline.total);
      d.headline.icon = "\u{1F464}";
    }
    if (!Array.isArray(d.stats)) d.stats = [];
    d.stats = d.stats.filter((x) => x && typeof x === "object").map((x) => ({ label: String(x.label || ""), tone: String(x.tone || "default"), value: typeof x.value === "number" ? x.value : String(x.value === null || x.value === void 0 ? "" : x.value) }));
  }
  return result;
}
function applySnapshotResult(result, sourceLabel) {
  sanitizeFeedResult(result);
  if (!Array.isArray(result.warnings)) result.warnings = [];
  if (sync.mode === "url") lsSet(TV_LAST_GOOD_LS, JSON.stringify({ result, at: Date.now(), heartbeatAt: sync.sourceHeartbeatAt ? sync.sourceHeartbeatAt.toISOString() : null }));
  state.result = result;
  state.statusTone = "success";
  sync.fileLabel = sourceLabel || "";
  sync.lastOkAt = /* @__PURE__ */ new Date();
  sync.lastDateISO = syncTargetDateISO();
  sync.lastError = null;
  render();
}

/** "HTTP 503 — <the server's own message>" instead of a bare status code. */
async function responseErrorText(res) {
  let detail = res.statusText || "error";
  try {
    const text = (await res.text()).trim();
    if (text) {
      try {
        const j = JSON.parse(text);
        detail = j.message || j.error || detail;
      } catch (err) {
        detail = text.slice(0, 120);
      }
    }
  } catch (err) {}
  return "HTTP " + res.status + " — " + detail;
}

// Our own shared feed is cached a few seconds at Vercel's edge, so any number of TVs
// cost the backend about the same as one. A cache-busting query string would give
// every poll a unique URL and defeat that, so it is only added for other feeds.
var SHARED_FEED_RE = /\/api\/feed-snapshot(\?|$)/;
// A request caught by a Wi-Fi drop can hang for minutes before the browser gives up,
// and while it hangs the screen stops checking (and the source PC stops its heartbeat).
// Every request gets a deadline; the next scheduled check simply tries again.
var FETCH_TIMEOUT_MS = 2e4;
function fetchWithTimeout(url, opts, ms) {
  const limit = ms || FETCH_TIMEOUT_MS;
  if (typeof AbortController === "undefined") return fetch(url, opts);
  const ctrl = new AbortController();
  // Not cleared on success on purpose: the deadline also covers reading the body,
  // and aborting a request that already finished does nothing.
  setTimeout(() => ctrl.abort(), limit);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).catch((err) => {
    if (err && err.name === "AbortError") throw new Error("no response in " + Math.round(limit / 1e3) + " s (network down?)");
    throw err;
  });
}
async function fetchWorkbookBuffer(url) {
  const target = SHARED_FEED_RE.test(url) ? url : url + (url.indexOf("?") === -1 ? "?" : "&") + "_ts=" + Date.now();
  // A raw workbook can be megabytes; the shared JSON feed is a few KB.
  const res = await fetchWithTimeout(target, { cache: "no-store" }, SHARED_FEED_RE.test(url) ? FETCH_TIMEOUT_MS : 6e4);
  if (!res.ok) throw new Error(await responseErrorText(res));
  return { buffer: await res.arrayBuffer(), stamp: res.headers.get("last-modified") || res.headers.get("etag") || "" };
}

// The source PC sends a heartbeat at least once a minute (PUBLISH_HEARTBEAT_MS); allow
// for that, the edge cache and a throttled background tab before calling it offline.
var SOURCE_STALE_MS = 18e4;
// A TV that can't reach the feed keeps its last numbers; after this long it says so.
var FEED_DOWN_MS = 15 * 6e4;
function feedUnreachable() {
  if (sync.mode !== "url" || !sync.lastError) return false;
  return Date.now() - (sync.lastFeedOkAt || PAGE_LOADED_AT) > FEED_DOWN_MS;
}
function plantTimeText(d) {
  const opts = { hour: "2-digit", minute: "2-digit" };
  if (plantTimeZone) opts.timeZone = plantTimeZone;
  try { return d.toLocaleTimeString("en-US", opts); } catch (err) { return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }
}
function noteSourceHeartbeat(payload) {
  const beat = payload && payload.heartbeatAt ? Date.parse(payload.heartbeatAt) : NaN;
  if (!Number.isFinite(beat)) {
    sync.sourceHeartbeatAt = null;
    if (sync.sourceStale) { sync.sourceStale = false; render(); }
    return;
  }
  // Age measured on the server's clock, so a TV whose own clock is off still judges it right.
  const serverNow = payload.serverTime ? Date.parse(payload.serverTime) : NaN;
  const ageMs = Math.max(0, (Number.isFinite(serverNow) ? serverNow : Date.now()) - beat);
  sync.sourceHeartbeatAt = new Date(Date.now() - ageMs);
  const stale = ageMs > SOURCE_STALE_MS;
  if (stale !== sync.sourceStale) {
    sync.sourceStale = stale;
    render();
  }
}

async function pullFromUrl(force) {
  const first = await fetchWorkbookBuffer(sync.url);
  const bytes = new Uint8Array(first.buffer);
  // Every .xlsx is a zip, so the first two bytes say whether this is a workbook or JSON.
  if (bytes.length > 1 && bytes[0] === 80 && bytes[1] === 75) {
    const signature = first.stamp || bufferSignature(first.buffer);
    if (!force && signature === sync.signature) return false;
    await applyWorkbookBuffer(first.buffer, urlFileName(sync.url));
    sync.signature = signature;
    return true;
  }
  const text = new TextDecoder().decode(first.buffer).trim();
  if (!text) throw new Error("The feed returned an empty response.");
  if (text.charAt(0) !== "{" && text.charAt(0) !== "[") {
    throw new Error("The feed is not an .xlsx file and not JSON (starts with \"" + text.slice(0, 24) + "\").");
  }
  let payload;
  try { payload = JSON.parse(text); } catch (err) { throw new Error("The feed returned invalid JSON: " + err.message); }
  if (Array.isArray(payload)) payload = payload[0] || {};
  const stamp = payload.updatedAt || payload.updated || payload.lastModified || payload.modified || "";

  // Last shape: the feed already did the parsing and sends the dashboard payload.
  const snapshot = payload.result && payload.result.departments ? payload.result : payload.departments ? payload : null;
  if (snapshot) {
    noteSourceHeartbeat(payload);
    if (!plantTzFromUrl && typeof payload.timeZone === "string") setPlantTimeZone(payload.timeZone);
    // updatedAt only moves when the numbers change (heartbeats leave it alone), so an
    // unchanged feed doesn't re-render the TV every minute.
    const signature = stamp || JSON.stringify(snapshot).length + ":snap";
    if (!force && signature === sync.signature) return false;
    // An older snapshot (a slow response, a stale cache node) never replaces a newer one.
    if (stamp && sync.signature && Date.parse(stamp) < Date.parse(sync.signature)) return false;
    const prevSignature = sync.signature;
    applySnapshotResult(snapshot, payload.fileName || "feed snapshot");
    sync.signature = signature;
    // A real change arriving on an already-running screen: report when it showed up.
    if (stamp && prevSignature && prevSignature !== signature) ackSeen(stamp);
    return true;
  }
  throw new Error("The JSON feed has no departments.");
}

// Timing log: tells the server when this screen first showed a change. Named with
// &screen=Name in the link; otherwise a random id remembered by this browser.
function screenName() {
  const fromUrl = (new URLSearchParams(location.search).get("screen") || "").trim();
  if (fromUrl) return fromUrl.slice(0, 40);
  let id = "";
  try { id = localStorage.getItem("tarter-screen-id") || ""; } catch (err) {}
  if (!id) {
    id = "screen-" + Math.random().toString(36).slice(2, 7);
    try { localStorage.setItem("tarter-screen-id", id); } catch (err) {}
  }
  return id;
}
function ackSeen(changedAt) {
  try {
    const url = new URL("seen", new URL(sync.url, location.href));
    fetchWithTimeout(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changedAt, screen: screenName() })
    }).catch(() => {});
  } catch (err) {}
}

async function findWorkbookInFolder(dir) {
  const wanted = ""; // Department files are auto-detected; legacy name filtering is disabled.
  let best = null;
  const candidates = [];
  const skipped = [];
  const filteredOut = [];
  // Two levels deep so the picker can be pointed straight at a synced library root.
  async function walk(handle, depth, prefix) {
    for await (const entry of handle.values()) {
      if (entry.kind === "directory") {
        if (depth > 0 && entry.name.charAt(0) !== ".") await walk(entry, depth - 1, prefix + entry.name + "/");
        continue;
      }
      if (!isWorkbookName(entry.name)) continue;
      if (wanted && entry.name.toLowerCase().indexOf(wanted) === -1) { filteredOut.push(prefix + entry.name); continue; }
      let file;
      try {
        file = await entry.getFile();
      } catch (err) {
        // Usually a OneDrive cloud-only placeholder or a file held open elsewhere.
        skipped.push(prefix + entry.name);
        continue;
      }
      candidates.push({ name: prefix + entry.name, modified: file.lastModified, file });
      if (!best || file.lastModified > best.file.lastModified) best = { file, name: prefix + entry.name };
    }
  }
  await walk(dir, 2, "");
  candidates.sort((a, b) => b.modified - a.modified);
  return { best, candidates, skipped, filteredOut };
}

async function pullFromFolder(force) {
  if (!sync.dirHandle) throw new Error("No folder connected.");
  const permission = typeof sync.dirHandle.queryPermission === "function"
    ? await sync.dirHandle.queryPermission({ mode: "read" })
    : "granted";
  if (permission !== "granted") {
    sync.needsPermission = true;
    throw new Error("Folder access expired — click Reconnect Folder.");
  }
  sync.needsPermission = false;
  const scan = await findWorkbookInFolder(sync.dirHandle);
  const filter = "";
  // Rebuilt on every poll so the list always describes the folder as it is now.
  const context = [];
  if (scan.candidates.length > 1) {
    context.push("Workbooks found (newest first): " + scan.candidates.slice(0, 8).map((c) => c.name).join(" | ") + (scan.candidates.length > 8 ? " | …" : "") + ". Department files are selected automatically by name.");
  }
  if (scan.filteredOut.length) {
    context.push("Skipped by the \"" + filter + "\" filter: " + scan.filteredOut.slice(0, 8).join(" | ") + (scan.filteredOut.length > 8 ? " | …" : ""));
  }
  if (scan.skipped.length) {
    context.push("Could not be opened (cloud-only in OneDrive, or locked): " + scan.skipped.slice(0, 8).join(" | ") + ". Right-click the folder and choose \"Always keep on this device\".");
  }
  if (!scan.best) {
    sync.diagnostic = context;
    throw new Error("No workbook found in that folder" + (filter ? " matching \"" + filter + "\"." : "."));
  }

  // One workbook per department: take the newest file whose name names that
  // department, and ignore everything else sitting in the folder.
  const chosen = [];
  const missing = [];
  for (const source of DEPT_SOURCES) {
    const match = scan.candidates.filter((c) => { const d = deptForFileName(c.name); return d && d.id === source.id; });
    if (match.length) chosen.push({ source, cand: match[0] });
    else missing.push(source.label);
    if (match.length > 1) context.push(source.label + ": " + match.length + " files match (" + match.slice(0, 3).map((c) => c.name).join(" | ") + ") - using the newest, " + match[0].name + ".");
  }
  if (chosen.length === 0) {
    sync.diagnostic = ["No file name in that folder contains fab, weld, paint or tank."].concat(context);
    throw new Error("None of the four department workbooks were found in that folder.");
  }
  if (missing.length) {
    context.unshift("No file found for: " + missing.join(", ") + ". Those cards stay empty.");
  }

  // Plant-wide board info (safety days + today's toolbox topic) lives in its own
  // workbook next to the department files. Optional: no file, no safety tile.
  const board = scan.candidates.find((c) => BOARD_INFO_RE.test(c.name)) || null;
  const boardSig = board ? board.name + ":" + board.modified + ":" + board.file.size : "";
  // Loading: the "Load Sign Off <Month> <year>" workbook(s) covering Monday..today.
  const loadDay = syncTargetDateISO();
  const loadCands = scan.candidates.filter((c) => LOADING_FILE_RE.test(c.name));
  const loadFiles = [];
  for (const iso of [weekMondayISO(loadDay), loadDay]) {
    const f = loadingFileFor(loadCands, iso);
    if (f && loadFiles.indexOf(f) === -1) loadFiles.push(f);
  }
  const loadSig = loadFiles.map((f) => f.name + ":" + f.modified + ":" + f.file.size).join("|");
  const signature = chosen.map((c) => c.cand.name + ":" + c.cand.modified + ":" + c.cand.file.size).join("~") + "~board:" + boardSig + "~load:" + loadSig;
  if (!force && signature === sync.signature) return false;
  const books = [];
  for (const f of loadFiles) {
    const sig = f.name + ":" + f.modified + ":" + f.file.size;
    const cached = (sync.loadingBooks || []).find((b) => b.sig === sig);
    if (cached) { books.push(cached); continue; }
    try {
      await ensureXlsx();
      books.push({ sig, fileName: f.name, savedAt: f.modified, days: parseLoadSignOff(await f.file.arrayBuffer()) });
    } catch (err) {
      context.push("Could not read " + f.name + ": " + (err && err.message ? err.message : String(err)));
    }
  }
  sync.loadingBooks = books;
  if (!board) sync.board = null;
  else if (!sync.board || sync.board.sig !== boardSig) {
    try {
      await ensureXlsx();
      sync.board = Object.assign({ sig: boardSig, fileName: board.name, savedAt: board.modified }, parseBoardInfo(await board.file.arrayBuffer()));
    } catch (err) {
      sync.board = null;
      context.push("Could not read " + board.name + ": " + (err && err.message ? err.message : String(err)));
    }
  }

  const files = [];
  let readFailed = false;
  for (const pick of chosen) {
    const fileSig = pick.cand.name + ":" + pick.cand.modified + ":" + pick.cand.file.size;
    const cached = force ? null : cachedParseFor(pick.cand.name, fileSig);
    if (cached) { files.push({ fileName: pick.cand.name, signature: fileSig, cached, modifiedAt: pick.cand.modified }); continue; }
    try {
      files.push({ fileName: pick.cand.name, signature: fileSig, modifiedAt: pick.cand.modified, buffer: await pick.cand.file.arrayBuffer() });
    } catch (err) {
      // OneDrive locks a file for a moment while it swaps in a new copy. Keep showing the
      // last good parse of it and retry on the next check, instead of a NO DATA card
      // that would stick until some other workbook changes.
      readFailed = true;
      const prev = sync.parsedCache[pick.cand.name];
      if (prev && prev.date === syncTargetDateISO()) files.push({ fileName: pick.cand.name, signature: prev.signature, cached: prev, modifiedAt: pick.cand.modified });
      context.push("Could not read " + pick.cand.name + ": " + (err && err.message ? err.message : String(err)) + " - retrying.");
    }
  }
  if (files.length === 0) {
    sync.diagnostic = context;
    throw new Error("The department workbooks were found but none could be opened.");
  }
  try {
    await applyFileSet(files, chosen.map((c) => c.source.label).join(", "));
  } catch (err) {
    sync.diagnostic = sync.diagnostic.concat(context);
    throw err;
  }
  if (missing.length) sync.note = "No file for " + missing.join(", ");
  else sync.note = "";
  // A file that couldn't be read leaves the signature unset, so the next check retries it.
  sync.signature = readFailed ? null : signature;
  return true;
}

function scheduleNextSync(elapsedMs) {
  clearTimeout(sync.timer);
  if (sync.mode === "off") { sync.nextAt = 0; return; }
  // Count the wait from when the last check started. Otherwise a 10 s parse turns a
  // 30 s setting into 40 s, and a change can sit unseen for most of a minute.
  sync.intervalMs = readIntervalMs();
  const wait = Math.max(2e3, sync.intervalMs - (elapsedMs || 0));
  sync.nextAt = Date.now() + wait;
  sync.timer = setTimeout(() => { syncNow(false); }, wait);
}

// Screen Wake Lock: while this page is visible with a live source connected, the
// browser keeps the display on and Windows from going to sleep - no power settings
// or admin rights needed. The browser drops the lock when the tab is hidden; it is
// asked for again on the next check or when the tab comes back.
var screenWakeLock = null;
async function keepScreenAwake() {
  if (screenWakeLock || sync.mode === "off" || document.visibilityState !== "visible") return;
  if (!navigator.wakeLock || typeof navigator.wakeLock.request !== "function") return;
  try {
    screenWakeLock = await navigator.wakeLock.request("screen");
    screenWakeLock.addEventListener("release", () => { screenWakeLock = null; });
  } catch (err) {
    screenWakeLock = null;
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepScreenAwake(); });

// A TV browser left open for weeks can slow down. Viewer screens reload themselves
// once a day at 3 AM plant time (outside the 5:00-15:30 shift) - but only after
// confirming the site answers, so a network outage at that minute can't strand the
// TV on a browser error page.
var DAILY_RELOAD_HOUR = 3;
var PAGE_LOADED_AT = Date.now();
async function maybeDailyReload() {
  if (sync.mode !== "url" || plantNow().getHours() !== DAILY_RELOAD_HOUR) return;
  if (Date.now() - PAGE_LOADED_AT < 2 * 36e5) return;
  try {
    const res = await fetchWithTimeout(location.pathname + "?_alive=" + Date.now(), { cache: "no-store" }, 15e3);
    if (!res.ok) return;
    // The page alone isn't enough: a TV that reloads while the feed is down comes back
    // with nothing to show, so the feed must answer with departments too.
    const feed = await fetchWithTimeout(sync.url + (sync.url.indexOf("?") === -1 ? "?" : "&") + "_alive=" + Date.now(), { cache: "no-store" }, 15e3);
    if (!feed.ok) return;
    const body = await feed.json();
    if (body && Array.isArray(body.departments) && body.departments.length) location.reload();
  } catch (err) {
    // Site unreachable right now: keep showing the last data and try next minute.
  }
}
setInterval(maybeDailyReload, 6e4);

async function syncNow(force) {
  if (sync.mode === "off") return;
  // A forced check asked for mid-check (date picked, Sync Now) runs right after it.
  if (sync.busy) { if (force === true) sync.pendingForce = true; return; }
  keepScreenAwake();
  sync.busy = true;
  sync.diagnostic = [];
  sync.lastCheckAt = Date.now();
  updateSyncUi();
  // Same file, new day: the workbook has a sheet per date, so re-parse at rollover.
  // After a failed rollover parse (e.g. Monday's tabs not created yet) wait a minute
  // before re-reading every workbook again, instead of every 5 s all night.
  const staleDate = !dateManuallySet && sync.lastDateISO !== null && sync.lastDateISO !== autoTargetISO() && Date.now() >= (sync.rolloverRetryAt || 0);
  const forceParse = force === true || staleDate;
  if (!state.result) { state.statusTone = "loading"; render(); }
  try {
    if (sync.mode === "folder") {
      await pullFromFolder(forceParse);
      // Runs on every good check, not only when a workbook was re-read: an unchanged
      // folder still owes the TVs a heartbeat. Not awaited - a slow backend must not
      // hold up this screen's own refresh loop.
      publishSnapshot(state.result, sync.fileLabel);
    } else {
      await pullFromUrl(forceParse);
      sync.lastFeedOkAt = Date.now();
    }
    // A good check clears an earlier blip even when nothing changed.
    if (sync.lastError) { sync.lastError = null; render(); }
  } catch (err) {
    sync.lastError = err && err.message ? err.message : String(err);
    if (staleDate) sync.rolloverRetryAt = Date.now() + 6e4;
    console.error("Auto-sync failed:", err, sync.diagnostic);
    // The source PC keeps its heartbeat going with the reason it can't read the Excel,
    // so the TVs say what to fix instead of "the PC is off".
    if (sync.mode === "folder" && state.result) {
      const reason = sync.needsPermission ? "Click Reconnect Folder on the source PC" : "Source PC can't read the Excel files: " + String(sync.lastError).slice(0, 90);
      publishSnapshot(Object.assign({}, state.result, { sourceError: reason }), sync.fileLabel);
    }
    if (!state.result) state.statusTone = "error";
    render();
  }
  sync.busy = false;
  if (sync.pendingForce) { sync.pendingForce = false; setTimeout(() => syncNow(true), 0); return; }
  // Rearm here rather than at the call sites so a failed read never ends the loop.
  if (sync.mode !== "off") scheduleNextSync(Date.now() - sync.lastCheckAt);
  updateSyncUi();
}

// Fast checks only around the shift (Mon-Fri 4:30 AM - 4:00 PM plant time). Nights and
// weekends nothing changes, so TVs check every 5 min and the source PC every minute;
// that keeps ~10 always-on TVs well inside Vercel's monthly request allowance.
var SOURCE_IDLE_CHECK_MS = 6e4;
var VIEWER_IDLE_CHECK_MS = 3e5;
function inActiveHours() {
  if (SCHEDULE_OFF) return true;
  const now = plantNow();
  const day = now.getDay();
  const min = now.getHours() * 60 + now.getMinutes();
  return day >= 1 && day <= 5 && min >= SHIFT_START_HOUR * 60 - 30 && min < 16 * 60;
}
function readIntervalMs() {
  const active = inActiveHours();
  if (sync.mode === "folder") return active ? SOURCE_CHECK_MS : SOURCE_IDLE_CHECK_MS;
  return active ? VIEWER_CHECK_MS : VIEWER_IDLE_CHECK_MS;
}
function startUrlSync(url, opts) {
  const clean = String(url || "").trim();
  if (!clean) return;
  sync.mode = "url";
  sync.url = clean;
  sync.dirHandle = null;
  sync.signature = null;
  sync.lastError = null;
  sync.note = "";
  sync.intervalMs = readIntervalMs();
  if (!state.result) {
    try {
      const cached = JSON.parse(lsGet(TV_LAST_GOOD_LS) || "null");
      if (cached && cached.result && Array.isArray(cached.result.departments)) {
        state.result = sanitizeFeedResult(cached.result);
        if (cached.result.timeZone && !plantTzFromUrl) setPlantTimeZone(cached.result.timeZone);
        sync.lastFeedOkAt = cached.at || null;
        if (cached.heartbeatAt) sync.sourceHeartbeatAt = new Date(cached.heartbeatAt);
        render();
      }
    } catch (err) {
      // Unreadable cache: start empty and wait for the feed.
    }
  }
  if (!opts || opts.remember !== false) lsSet(SYNC_LS.url, clean);
  const input = document.getElementById("sync-url-input");
  if (input) input.value = clean;
  updateSyncUi();
  syncNow(true);
}
function startFolderSync(dirHandle, opts) {
  sync.mode = "folder";
  sync.dirHandle = dirHandle;
  sync.url = "";
  sync.signature = null;
  sync.lastError = null;
  sync.note = "";
  sync.intervalMs = readIntervalMs();
  if (!opts || opts.remember !== false) {
    lsSet(SYNC_LS.url, null);
    idbSet("dataFolder", dirHandle).catch(() => {
      sync.note = "Folder will need reconnecting after a reload (open the page over http://localhost to make it stick).";
      updateSyncUi();
    });
  }
  updateSyncUi();
  syncNow(true);
}
function stopSync(forget, note) {
  clearTimeout(sync.timer);
  sync.mode = "off";
  sync.timer = null;
  sync.nextAt = 0;
  sync.signature = null;
  sync.dirHandle = null;
  sync.url = "";
  sync.lastError = null;
  sync.note = note || "";
  if (forget) {
    lsSet(SYNC_LS.url, null);
    idbSet("dataFolder", null).catch(() => {});
  }
  updateSyncUi();
}

function updateSyncUi() {
  const statusEl = document.getElementById("sync-status");
  const detailEl = document.getElementById("sync-detail");
  const stopBtn = document.getElementById("sync-stop-btn");
  const folderBtn = document.getElementById("sync-folder-btn");
  if (folderBtn) {
    folderBtn.textContent = sync.needsPermission ? "Reconnect Folder" : sync.mode === "folder" ? "Change Folder" : "Connect Folder";
    folderBtn.classList.toggle("border-red-400", sync.needsPermission);
    folderBtn.classList.toggle("text-red-600", sync.needsPermission);
  }
  if (stopBtn) stopBtn.classList.toggle("hidden", sync.mode === "off");
  if (!statusEl || !detailEl) return;

  if (sync.mode === "off") {
    if (sync.lastError) {
      statusEl.textContent = "Auto-sync off — error";
      statusEl.className = "text-[11px] font-black tracking-wider uppercase text-red-600";
      detailEl.textContent = sync.lastError;
      return;
    }
    statusEl.textContent = "Auto-sync off";
    statusEl.className = "text-[11px] font-black tracking-wider uppercase text-slate-500";
    detailEl.textContent = sync.note || "Connect the production folder to start live updates";
    return;
  }
  const seconds = sync.nextAt ? Math.max(0, Math.round((sync.nextAt - Date.now()) / 1e3)) : 0;
  const where = sync.mode === "folder" ? "Folder" : "Feed";
  if (sync.busy) {
    statusEl.textContent = where + " — checking…";
    statusEl.className = "text-[11px] font-black tracking-wider uppercase text-indigo-600 animate-pulse";
  } else if (sync.lastError) {
    statusEl.textContent = where + " — error";
    statusEl.className = "text-[11px] font-black tracking-wider uppercase text-red-600";
  } else if (sync.lastOkAt) {
    statusEl.textContent = where + " — updated " + sync.lastOkAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    statusEl.className = "text-[11px] font-black tracking-wider uppercase text-green-600";
  } else {
    statusEl.textContent = where + " — waiting for first read";
    statusEl.className = "text-[11px] font-black tracking-wider uppercase text-slate-500";
  }
  const parts = [];
  if (sync.lastError) parts.push(sync.lastError);
  else if (sync.fileLabel) parts.push(sync.fileLabel);
  if (sync.note) parts.push(sync.note);
  // The files' own save time, so a stale screen points at the right culprit: the
  // dashboard has not looked yet, or OneDrive has not delivered the new file yet.
  if (!sync.lastError && sync.sourceSavedAt) parts.push("files saved " + sync.sourceSavedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  if (sync.mode === "folder" && sync.publishStatus) parts.push(sync.publishStatus);
  if (sync.mode === "url" && sync.sourceStale) parts.push("SOURCE PC OFFLINE");
  if (!sync.busy) parts.push("next check in " + seconds + "s");
  detailEl.textContent = parts.join(" \xB7 ");
}

// ---- Publish: the PC with "Connect Folder" open is the one true source. After every
// successful folder check it relays what it has on screen to /api/publish, so every
// other screen can just read /api/feed-snapshot. It sends whenever the data changed,
// and otherwise a heartbeat at most once a minute, so the TVs can tell "the numbers
// haven't changed" apart from "the source PC went off" (see SOURCE_STALE_MS).
// Best-effort: a failed publish never breaks rendering on this machine.
var PUBLISH_HEARTBEAT_MS = 6e4;
var publishState = { lastBody: null, changedAt: null, lastSentAt: 0, inFlight: false, sentOnce: false };
// Optional publish key (matches PUBLISH_KEY in Vercel). Set once per source PC by
// opening the dashboard with ?publishkey=..., kept in this browser afterwards.
var PUBLISH_KEY_LS = "tarter-publish-key";
(function () {
  const m = /[?&]publishkey=([^&]+)/.exec(location.search);
  if (m) {
    lsSet(PUBLISH_KEY_LS, decodeURIComponent(m[1]));
    const clean = new URL(location.href);
    clean.searchParams.delete("publishkey");
    try { history.replaceState(null, "", clean.href); } catch (err) {}
  }
})();
function publishKey() {
  return lsGet(PUBLISH_KEY_LS) || "";
}
function publishPayload(result) {
  return {
    selectedDate: result.selectedDate,
    selectedWeekStart: result.selectedWeekStart,
    departments: result.departments,
    warnings: result.warnings,
    fabWorkers: result.fabWorkers,
    sources: result.sources,
    missing: result.missing || [],
    safety: result.safety || null,
    loading: result.loading || null,
    sourceError: typeof result.sourceError === "string" ? result.sourceError : null,
    timeZone: plantTimeZone || deviceTimeZone()
  };
}
async function publishSnapshot(result, sourceLabel) {
  if (!result || !Array.isArray(result.departments) || publishState.inFlight) return;
  // The whole payload is the signature: any number that moves on screen is a change.
  const dataText = JSON.stringify(publishPayload(result));
  const changed = dataText !== publishState.lastBody;
  if (!changed && Date.now() - publishState.lastSentAt < PUBLISH_HEARTBEAT_MS) return;
  // After a failed send, wait 5 s, 10 s, 20 s ... up to a minute before the next try.
  if (Date.now() < (publishState.retryAt || 0)) return;
  const changedAt = changed ? new Date().toISOString() : publishState.changedAt;
  publishState.inFlight = true;
  try {
    const headers = { "Content-Type": "application/json" };
    const key = publishKey();
    if (key) headers["x-publish-key"] = key;
    const resp = await fetchWithTimeout("/api/publish", {
      method: "POST",
      headers,
      body: JSON.stringify({
        result: JSON.parse(dataText),
        sourceLabel: sourceLabel || "",
        changedAt,
        filesSavedAt: sync.sourceSavedAt ? sync.sourceSavedAt.toISOString() : null,
        // Timing log: only real edits count - not the first send after opening the page.
        changed,
        firstAfterLoad: !publishState.sentOnce,
        newestFile: sync.sourceNewestFile || ""
      })
    });
    if (resp.status === 401) throw new Error("publish key missing or wrong - open this page once with ?publishkey=YOUR-KEY");
    if (!resp.ok) throw new Error(await responseErrorText(resp));
    let ack = null;
    try { ack = await resp.json(); } catch (err) {}
    publishState.failures = 0;
    publishState.retryAt = 0;
    if (changed && publishState.sentOnce && sync.sourceSavedAt) {
      const lagS = Math.round((Date.parse(changedAt) - sync.sourceSavedAt.getTime()) / 1000);
      if (lagS >= 0) publishState.lastLag = "last change seen " + lagS + " s after the Excel was saved";
    }
    publishState.sentOnce = true;
    publishState.lastBody = dataText;
    // The server stamps changes with its own clock; heartbeats echo that stamp back.
    publishState.changedAt = ack && ack.changedAt ? ack.changedAt : changedAt;
    publishState.lastSentAt = Date.now();
    sync.publishStatus = "TVs updated " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + (publishState.lastLag ? " · " + publishState.lastLag : "");
  } catch (err) {
    // Opened as a local file, offline, or the backend is down - keep this screen
    // working, but say so, so nobody assumes the TVs are current when they are not.
    publishState.failures = (publishState.failures || 0) + 1;
    publishState.retryAt = Date.now() + Math.min(6e4, 5e3 * Math.pow(2, publishState.failures - 1));
    sync.publishStatus = "TVs NOT updated: " + (err && err.message ? err.message : String(err));
  } finally {
    publishState.inFlight = false;
    updateSyncUi();
  }
}

function wireSyncControls() {
  const folderBtn = document.getElementById("sync-folder-btn");
  const urlBtn = document.getElementById("sync-url-btn");
  const urlInput = document.getElementById("sync-url-input");
  const nameInput = document.getElementById("sync-name-input");
  const intervalInput = document.getElementById("sync-interval-input");
  const nowBtn = document.getElementById("sync-now-btn");
  const stopBtn = document.getElementById("sync-stop-btn");
  const dateInput = document.getElementById("date-input");

  if (folderBtn) {
    if (typeof window.showDirectoryPicker !== "function") {
      folderBtn.disabled = true;
      folderBtn.classList.add("opacity-40", "cursor-not-allowed");
      folderBtn.title = "This browser cannot read a folder. Use Chrome or Edge on Windows, or use a Feed URL.";
    } else {
      folderBtn.addEventListener("click", async () => {
        try {
          if (sync.needsPermission && sync.dirHandle) {
            const granted = await sync.dirHandle.requestPermission({ mode: "read" });
            if (granted === "granted") { startFolderSync(sync.dirHandle); return; }
          }
          const dir = await window.showDirectoryPicker({ id: "tarter-data", mode: "read" });
          startFolderSync(dir);
        } catch (err) {
          if (err && err.name === "AbortError") return;
          sync.lastError = err && err.message ? err.message : String(err);
          updateSyncUi();
        }
      });
    }
  }
  if (urlBtn && urlInput) {
    urlBtn.addEventListener("click", () => {
      const value = urlInput.value.trim();
      if (!value) { stopSync(true); return; }
      startUrlSync(value);
    });
    urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") urlBtn.click(); });
  }
  if (nameInput) {
    nameInput.value = lsGet(SYNC_LS.name) || "";
    nameInput.addEventListener("change", () => {
      lsSet(SYNC_LS.name, nameInput.value.trim() || null);
      if (sync.mode === "folder") { sync.signature = null; syncNow(true); }
    });
  }
  if (intervalInput) {
    const saved = lsGet(SYNC_LS.interval);
    if (saved) intervalInput.value = saved;
    intervalInput.addEventListener("change", () => {
      lsSet(SYNC_LS.interval, intervalInput.value);
      sync.intervalMs = readIntervalMs();
      if (sync.mode !== "off") scheduleNextSync();
      updateSyncUi();
    });
  }
  if (nowBtn) nowBtn.addEventListener("click", () => { if (sync.mode !== "off") { syncNow(true); } });

  // Browsers slow timers down to a crawl in a background tab, so someone who edits the
  // workbook and switches back would wait out a stale countdown. Check on return.
  const checkOnReturn = () => {
    if (sync.mode === "off" || sync.busy) return;
    if (Date.now() - sync.lastCheckAt < 5e3) return;
    syncNow(false);
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkOnReturn(); });
  window.addEventListener("focus", checkOnReturn);
  if (stopBtn) stopBtn.addEventListener("click", () => stopSync(true, "Stopped by operator"));
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      // On a weekend the automatic day is Friday, so picking Friday is not "manual".
      dateManuallySet = dateInput.value !== autoTargetISO();
      dateManualDay = todayISO();
      if (sync.mode !== "off") syncNow(true);
    });
  }
  setInterval(updateSyncUi, 1e3);
}

async function bootstrapAutoSync(snap) {
  wireSyncControls();
  // Polling can be carried by an exported TV page or overridden in the URL.
  // This keeps a TV on the intended cadence instead of silently falling back to the HTML default.
  const intervalSelect = document.getElementById("sync-interval-input");
  const queryPoll = Number(queryParam("poll") || queryParam("interval"));
  const snapPoll = snap && Number(snap.refreshMs);
  const requestedPoll = Number.isFinite(queryPoll) && queryPoll > 0 ? queryPoll : (Number.isFinite(snapPoll) && snapPoll > 0 ? snapPoll : 0);
  if (intervalSelect && requestedPoll >= SYNC_MIN_MS) {
    const supported = Array.from(intervalSelect.options).some((o) => Number(o.value) === requestedPoll);
    if (supported) intervalSelect.value = String(requestedPoll);
  }
  sync.intervalMs = readIntervalMs();
  // Precedence: URL override, then what an exported TV page carries, then what was saved.
  const fromQuery = queryParam("src") || queryParam("feed");
  const fromSnapshot = snap && snap.feedUrl ? snap.feedUrl : "";
  const saved = lsGet(SYNC_LS.url);
  const url = fromQuery || fromSnapshot || saved || "";
  if (url) {
    const urlInput = document.getElementById("sync-url-input");
    if (urlInput) urlInput.value = url;
    startUrlSync(url, { remember: !fromQuery && !fromSnapshot });
    return;
  }
  let stored = null;
  try { stored = await idbGet("dataFolder"); } catch (err) { stored = null; }
  if (!stored) { updateSyncUi(); return; }
  sync.dirHandle = stored;
  let permission = "prompt";
  try { permission = await stored.queryPermission({ mode: "read" }); } catch (err) { permission = "prompt"; }
  if (permission === "granted") {
    startFolderSync(stored, { remember: false });
  } else {
    // Chrome will not re-grant without a click, so surface the button instead of failing quietly.
    sync.needsPermission = true;
    sync.note = "Saved folder found — click Reconnect Folder to resume auto-sync.";
    updateSyncUi();
  }
}
