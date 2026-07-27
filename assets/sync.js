/* ============================================================
   TARTER YARD MAP — backend adapter (auth + live sync)
   ------------------------------------------------------------
   Talks to the Netlify Function at /api. If that API is not
   reachable (file:// preview, no functions deployed, offline),
   everything degrades to a purely local mode backed by
   localStorage, with full edit rights on that device only.
   ============================================================ */
(function (global) {
  "use strict";

  const LS_STATE = "tarter_yard_state_v6";
  const LS_ALERTS = "tarter_yard_alerts_v6";
  const LS_QUEUE = "tarter_yard_queue_v6";
  const LS_NAME = "tarter_yard_name";
  const POLL_MS = 8000;
  const PUSH_DEBOUNCE_MS = 1200;

  const listeners = { state: [], alerts: [], status: [] };
  const emit = (kind, payload) => listeners[kind].forEach((fn) => {
    try { fn(payload); } catch (e) { console.error(e); }
  });

  const S = {
    mode: "unknown",     // "remote" | "local"
    role: "local",       // "editor" | "viewer" | "local"
    name: "",
    stateRev: 0,
    alertsRev: 0,
    alerts: [],
    lastPushError: null,
    online: true,
  };

  /* -------------------------------------------------- local storage */

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* -------------------------------------------------- fetch wrapper */

  async function api(path, options) {
    const res = await fetch("/api/" + path, Object.assign({
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    }, options || {}));
    let body = null;
    try { body = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, body: body || {} };
  }

  /* -------------------------------------------------- session */

  /**
   * Figure out whether we have a backend and whether we are signed in.
   * Resolves to one of:
   *   {mode:"remote", authed:true,  role, name}
   *   {mode:"remote", authed:false}            -> caller shows the login screen
   *   {mode:"local"}                           -> no backend at all
   */
  async function probe() {
    try {
      const r = await api("me");
      if (r.ok && r.body.role) {
        S.mode = "remote"; S.role = r.body.role; S.name = r.body.name || "";
        return { mode: "remote", authed: true, role: S.role, name: S.name };
      }
      if (r.status === 401) {
        S.mode = "remote";
        return { mode: "remote", authed: false };
      }
      if (r.status === 503) {
        // Function is deployed but SESSION_SECRET is missing.
        S.mode = "remote";
        return { mode: "remote", authed: false, misconfigured: true };
      }
      S.mode = "local"; S.role = "local";
      return { mode: "local" };
    } catch (e) {
      S.mode = "local"; S.role = "local";
      return { mode: "local" };
    }
  }

  async function login(name, code) {
    const r = await api("login", { method: "POST", body: JSON.stringify({ name, code }) });
    if (r.ok) {
      S.mode = "remote"; S.role = r.body.role; S.name = r.body.name || name;
      try { localStorage.setItem(LS_NAME, S.name); } catch (e) {}
      return { ok: true, role: S.role, name: S.name };
    }
    return { ok: false, status: r.status, error: r.body.error || "unknown" };
  }

  async function logout() {
    try { await api("logout", { method: "POST" }); } catch (e) {}
    S.role = "local"; S.name = "";
  }

  function useLocalMode(name) {
    S.mode = "local";
    S.role = "local";
    S.name = name || lsGet(LS_NAME, "") || "";
  }

  /* -------------------------------------------------- map state */

  /**
   * Load the map. Returns {data, rev, source}. `source` is "remote",
   * "local" or "seed" so the caller knows whether to fall back to the
   * bundled default map.
   */
  async function loadState(seedData) {
    if (S.mode === "remote") {
      try {
        const r = await api("state");
        if (r.ok) {
          S.stateRev = r.body.rev || 0;
          if (r.body.data && Array.isArray(r.body.data.tiles)) {
            lsSet(LS_STATE, { rev: S.stateRev, data: r.body.data });
            return { data: r.body.data, rev: S.stateRev, source: "remote" };
          }
          // Server has no map yet. An editor seeds it from the bundled default.
          if (S.role === "editor" && seedData) {
            const pushed = await pushStateNow(seedData);
            if (pushed.ok) return { data: seedData, rev: S.stateRev, source: "seed" };
          }
          return { data: seedData, rev: S.stateRev, source: "seed" };
        }
      } catch (e) { /* fall through to local */ }
    }
    const local = lsGet(LS_STATE, null);
    if (local && local.data && Array.isArray(local.data.tiles)) {
      S.stateRev = local.rev || 0;
      return { data: local.data, rev: S.stateRev, source: "local" };
    }
    return { data: seedData, rev: 0, source: "seed" };
  }

  let pushTimer = null;
  let pendingData = null;

  /** Persist immediately: local always, remote when we are an editor. */
  async function pushStateNow(data) {
    lsSet(LS_STATE, { rev: S.stateRev, data });
    if (S.mode !== "remote" || S.role !== "editor") {
      return { ok: true, local: true };
    }
    emit("status", { pushing: true });
    try {
      const r = await api("state", {
        method: "PUT",
        body: JSON.stringify({ rev: S.stateRev, data }),
      });
      if (r.ok) {
        S.stateRev = r.body.rev;
        S.lastPushError = null;
        lsSet(LS_STATE, { rev: S.stateRev, data });
        emit("status", { pushing: false, saved: true });
        return { ok: true };
      }
      if (r.status === 409) {
        // Someone else saved first. Their version wins; hand it to the app.
        S.stateRev = r.body.rev || S.stateRev;
        emit("status", { pushing: false, conflict: true });
        if (r.body.data) emit("state", { data: r.body.data, rev: S.stateRev, reason: "conflict" });
        return { ok: false, conflict: true };
      }
      if (r.status === 401) {
        emit("status", { pushing: false, unauthorized: true });
        return { ok: false, unauthorized: true };
      }
      if (r.status === 403) {
        emit("status", { pushing: false, forbidden: true });
        return { ok: false, forbidden: true };
      }
      S.lastPushError = r.body.error || ("http_" + r.status);
      emit("status", { pushing: false, error: S.lastPushError });
      return { ok: false, error: S.lastPushError };
    } catch (e) {
      S.lastPushError = "offline";
      S.online = false;
      emit("status", { pushing: false, offline: true });
      return { ok: false, offline: true };
    }
  }

  /** Debounced save — call this on every edit. */
  function pushState(data) {
    pendingData = data;
    lsSet(LS_STATE, { rev: S.stateRev, data });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      const d = pendingData; pendingData = null;
      if (d) pushStateNow(d);
    }, PUSH_DEBOUNCE_MS);
  }

  /** Force any pending debounced save to go out right now. */
  function flush() {
    if (pendingData) {
      clearTimeout(pushTimer);
      const d = pendingData; pendingData = null;
      return pushStateNow(d);
    }
    return Promise.resolve({ ok: true });
  }

  /* -------------------------------------------------- alerts */

  function queued() { return lsGet(LS_QUEUE, []); }
  function setQueued(q) { lsSet(LS_QUEUE, q); }

  async function loadAlerts() {
    if (S.mode === "remote") {
      try {
        const r = await api("alerts");
        if (r.ok) {
          S.alertsRev = r.body.rev || 0;
          S.alerts = r.body.items || [];
          lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
          emit("alerts", S.alerts);
          return S.alerts;
        }
      } catch (e) { /* fall through */ }
    }
    const local = lsGet(LS_ALERTS, { rev: 0, items: [] });
    S.alertsRev = local.rev || 0;
    S.alerts = local.items || [];
    emit("alerts", S.alerts);
    return S.alerts;
  }

  function localAlertFrom(input) {
    return Object.assign({
      id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      by: S.name || "—",
      role: S.role,
      createdAt: new Date().toISOString(),
      status: "open",
      resolvedAt: null,
      resolvedBy: null,
    }, input);
  }

  /**
   * File a report. Always lands locally first so the user gets instant
   * feedback, then goes to the server; if the network fails it is queued
   * and retried on the next poll.
   */
  async function addAlert(input) {
    const optimistic = localAlertFrom(input);
    S.alerts = [optimistic].concat(S.alerts);
    lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
    emit("alerts", S.alerts);

    if (S.mode !== "remote") return { ok: true, local: true, alert: optimistic };

    try {
      const r = await api("alerts", { method: "POST", body: JSON.stringify({ alert: input }) });
      if (r.ok) {
        S.alertsRev = r.body.rev || S.alertsRev;
        // Swap the optimistic copy for the server's authoritative one.
        S.alerts = S.alerts.map((a) => (a.id === optimistic.id ? r.body.alert : a));
        lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
        emit("alerts", S.alerts);
        return { ok: true, alert: r.body.alert };
      }
      if (r.status === 401) return { ok: false, unauthorized: true, alert: optimistic };
    } catch (e) { /* queue below */ }

    const q = queued(); q.push(input); setQueued(q);
    return { ok: false, queued: true, alert: optimistic };
  }

  async function flushQueue() {
    if (S.mode !== "remote") return;
    let q = queued();
    if (!q.length) return;
    const rest = [];
    for (const item of q) {
      try {
        const r = await api("alerts", { method: "POST", body: JSON.stringify({ alert: item }) });
        if (!r.ok) rest.push(item);
      } catch (e) { rest.push(item); }
    }
    setQueued(rest);
    if (rest.length !== q.length) await loadAlerts();
  }

  async function setAlertStatus(id, status, remove) {
    // Optimistic local update.
    S.alerts = remove
      ? S.alerts.filter((a) => a.id !== id)
      : S.alerts.map((a) => (a.id === id
        ? Object.assign({}, a, {
          status,
          resolvedAt: status === "resolved" ? new Date().toISOString() : null,
          resolvedBy: status === "resolved" ? (S.name || "—") : null,
        })
        : a));
    lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
    emit("alerts", S.alerts);

    if (S.mode !== "remote") return { ok: true, local: true };
    try {
      const r = await api("alerts", {
        method: "PATCH",
        body: JSON.stringify({ id, status, remove: !!remove }),
      });
      if (r.ok) {
        S.alertsRev = r.body.rev || S.alertsRev;
        S.alerts = r.body.items || S.alerts;
        lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
        emit("alerts", S.alerts);
        return { ok: true };
      }
      if (r.status === 403) return { ok: false, forbidden: true };
      return { ok: false, error: r.body.error };
    } catch (e) {
      return { ok: false, offline: true };
    }
  }

  /* -------------------------------------------------- polling */

  let pollTimer = null;

  async function pollOnce() {
    if (S.mode !== "remote") return;
    if (document.hidden) return;
    try {
      const r = await api(`sync?srev=${S.stateRev}&arev=${S.alertsRev}`);
      if (r.status === 401) { emit("status", { unauthorized: true }); return; }
      if (!r.ok) return;
      S.online = true;

      if (r.body.state && r.body.state.data) {
        S.stateRev = r.body.state.rev || 0;
        lsSet(LS_STATE, { rev: S.stateRev, data: r.body.state.data });
        emit("state", {
          data: r.body.state.data,
          rev: S.stateRev,
          reason: "poll",
          updatedBy: r.body.state.updatedBy,
        });
      } else if (typeof r.body.srev === "number") {
        S.stateRev = r.body.srev;
      }

      if (r.body.alerts) {
        const before = S.alerts.filter((a) => a.status !== "resolved").length;
        S.alertsRev = r.body.alerts.rev || 0;
        S.alerts = r.body.alerts.items || [];
        lsSet(LS_ALERTS, { rev: S.alertsRev, items: S.alerts });
        const after = S.alerts.filter((a) => a.status !== "resolved").length;
        emit("alerts", S.alerts);
        if (after > before) emit("status", { newAlerts: after - before });
      } else if (typeof r.body.arev === "number") {
        S.alertsRev = r.body.arev;
      }

      await flushQueue();
    } catch (e) {
      S.online = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollOnce, POLL_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pollOnce(); });
    global.addEventListener("online", () => { S.online = true; pollOnce(); });
    global.addEventListener("offline", () => { S.online = false; });
    // Do not lose the last edit when the tab closes.
    global.addEventListener("pagehide", () => { flush(); });
  }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  /* -------------------------------------------------- public API */

  global.Sync = {
    state: S,
    probe, login, logout, useLocalMode,
    loadState, pushState, pushStateNow, flush,
    loadAlerts, addAlert, setAlertStatus, pollOnce, startPolling, stopPolling,
    onState: (fn) => listeners.state.push(fn),
    onAlerts: (fn) => listeners.alerts.push(fn),
    onStatus: (fn) => listeners.status.push(fn),
    get role() { return S.role; },
    get name() { return S.name; },
    get mode() { return S.mode; },
    canEdit: () => S.role === "editor" || S.role === "local",
    rememberedName: () => lsGet(LS_NAME, ""),
    clearLocalState: () => { try { localStorage.removeItem(LS_STATE); } catch (e) {} },
  };
})(window);
