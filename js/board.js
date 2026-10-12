// Daily Production Board TV page (board.html). Reads the same feed as the TVs
// (/api/feed-snapshot): the source PC adds a "board" block for the previous workday
// (js/board-data.js) next to the safety tile data. Nothing here reads Excel files.
// ?preview=1 shows sample numbers (the 09/22/2026 whiteboard) without a feed.
(function () {
  "use strict";

  var FEED_URL = "/api/feed-snapshot";
  var PREVIEW = /[?&]preview=1(&|$)/.test(location.search);
  var STALE_SOURCE_MS = 15 * 60 * 1000;

  var AREAS = [
    ["FAB", "Fabrication"], ["WELD", "Welding"], ["PAINT", "Paint Line"], ["MAINT", "Maintenance"],
    ["TANKS", "Tank Plant"], ["LOAD", "Loading/Yard"], ["INV", "Inventory"], ["ASSY", "Assembly"]
  ];
  var DEPTS = { FAB: 1, WELD: 1, PAINT: 1, TANKS: 1 };
  var ROWS = [
    ["ATTAIN", "Schedule Attainment"], ["QUALITY", "Quality"], ["EFF", "Efficiencies"], ["OT", "OT"],
    ["FIVE_S", "5S"], ["HEAD", "Headcount"], ["ISSUES", "Maint. Issues"]
  ];

  var timeZone = null;

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) {
    var n = typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  }
  function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  function pctClass(p) { return p >= 95 ? "good" : p >= 85 ? "warn" : "bad"; }
  function isoDay(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

  /** The plant's wall clock (the source PC's time zone, carried in the feed). */
  function plantParts(date) {
    var d = date || new Date();
    if (!timeZone) return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), min: d.getMinutes(), wd: d.getDay() };
    try {
      var p = {};
      new Intl.DateTimeFormat("en-US", { timeZone: timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
    } catch (err) {
      timeZone = null;
      return plantParts(d);
    }
  }
  function plantTodayISO() {
    var p = plantParts();
    return p.y + "-" + (p.m < 10 ? "0" : "") + p.m + "-" + (p.d < 10 ? "0" : "") + p.d;
  }
  function daysBetween(fromIso, toIso) {
    if (!isoDay(fromIso) || !isoDay(toIso)) return null;
    var n = Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 864e5);
    return n >= 0 ? n : null;
  }
  function timeText(iso) {
    if (!iso || !Number.isFinite(Date.parse(iso))) return "";
    var opts = { hour: "numeric", minute: "2-digit" };
    if (timeZone) opts.timeZone = timeZone;
    try { return new Date(iso).toLocaleTimeString("en-US", opts); } catch (err) { return ""; }
  }

  // ---- cells -------------------------------------------------------------------------
  // Each cell is { cls, html, src } where src is "auto" (department Excel) or "input"
  // (typed in Daily Board Input.xlsx).
  function pctCell(p, src) {
    p = num(p);
    if (p === null) return null;
    return { cls: pctClass(p), html: '<span class="v">' + Math.round(p) + "%</span>", src: src };
  }
  /** A typed value: a number is a percentage stored as a fraction (97% = 0.97). */
  function typedPct(v) {
    if (typeof v === "number") return pctCell(v * 100, "input");
    if (typeof v !== "string" || !v) return null;
    var t = v.trim();
    if (/^(yes|y|ok|✓|✔)$/i.test(t)) return { cls: "good", html: '<span class="v">✓</span>', src: "input" };
    if (/^(no|n|✗|✘|x)$/i.test(t)) return { cls: "bad", html: '<span class="v">✗</span>', src: "input" };
    var m = /^(\d+(?:\.\d+)?)\s*%?$/.exec(t);
    if (m) return pctCell(+m[1], "input");
    return { cls: "", html: '<span class="t">' + esc(t) + "</span>", src: "input" };
  }
  function headCell(present, expected, src) {
    present = num(present); expected = num(expected);
    if (present === null) return null;
    var cls = expected ? (present >= expected ? "good" : present / expected >= 0.8 ? "warn" : "bad") : "";
    return { cls: cls, html: '<span class="v">' + present + (expected !== null ? "/" + expected : "") + "</span>", src: src };
  }
  function typedHead(v) {
    if (typeof v === "number") return headCell(v, null, "input");
    var m = typeof v === "string" && /^\s*(\d+)\s*(?:\/|of)\s*(\d+)\s*$/i.exec(v);
    if (m) return headCell(+m[1], +m[2], "input");
    return typeof v === "string" && v ? { cls: "", html: '<span class="t">' + esc(v) + "</span>", src: "input" } : null;
  }
  function typedOt(v) {
    var n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (!Number.isFinite(n)) return null;
    return { cls: n === 0 ? "good" : "warn", html: '<span class="v">' + (Math.round(n * 10) / 10) + "</span>", src: "input" };
  }
  function typed5s(v) {
    if (typeof v !== "string" || !v) return null;
    var cls = /^good/i.test(v) ? "good" : /^improve/i.test(v) ? "warn" : /^critical/i.test(v) ? "bad" : "";
    return { cls: cls, html: '<span class="v" style="font-size:calc(var(--u)*3)">' + esc(v) + "</span>", src: "input" };
  }
  function typedText(v) {
    if (v === null || v === undefined || v === "") return null;
    var items = String(v).split(/\s*[,;\n]\s*/).filter(Boolean).slice(0, 4);
    return { cls: "", html: "<ul>" + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>", src: "input" };
  }
  function noData(reason) {
    return { cls: "", html: '<span class="nd" title="' + esc(reason || "") + '">NO DATA</span>', src: "auto" };
  }

  function cellFor(row, area, board, input) {
    var a = board.areas && board.areas[area];
    var ld = board.loading;
    var v = input ? input[row + "_" + area] : undefined;
    if (DEPTS[area] && (row === "ATTAIN" || row === "EFF" || row === "HEAD")) {
      if (!a || a.missing) return noData(a && a.missing);
      if (row === "ATTAIN") return pctCell(a.attainment, "auto");
      if (row === "EFF") return a.down ? { cls: "bad", html: '<span class="v">DOWN</span>', src: "auto" } : pctCell(a.efficiency, "auto");
      return headCell(a.present, a.expected, "auto");
    }
    if (area === "LOAD" && row === "QUALITY") return ld && num(ld.inFull) !== null ? pctCell(ld.inFull, "auto") : noData("No Load Sign Off tab for this day");
    if (area === "LOAD" && row === "EFF") {
      if (!ld || num(ld.loads) === null) return noData("No Load Sign Off tab for this day");
      return { cls: "", src: "auto", html: "<ul><li>Pcs/load · " + (num(ld.pcsPerLoad) !== null ? fmt(ld.pcsPerLoad) : "--") + "</li><li>Loads · " + fmt(ld.loads) + "</li><li>Short · " + fmt(num(ld.shorts) || 0) + "</li></ul>" };
    }
    if (row === "ATTAIN" || row === "QUALITY" || row === "EFF") return typedPct(v);
    if (row === "OT") return typedOt(v);
    if (row === "FIVE_S") return typed5s(v);
    if (row === "HEAD") return typedHead(v);
    if (row === "ISSUES") return typedText(v);
    return null;
  }

  // ---- render ------------------------------------------------------------------------
  function render(feed) {
    var board = feed.board;
    var wait = document.getElementById("wait");
    if (!board || !board.reportDate) {
      wait.hidden = false;
      document.getElementById("wait-why").textContent = "The source PC hasn't sent board data yet (it needs the dashboard version with the board).";
      return;
    }
    wait.hidden = true;
    var input = board.input && typeof board.input === "object" ? board.input : null;
    var today = plantTodayISO();

    var d = new Date(board.reportDate + "T12:00:00Z");
    document.getElementById("meta").innerHTML = "<b>" + esc(d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })) +
      "</b>Meeting 8:30 AM · 10–15 min";

    // Safety: recordable from TV Board Info (as on the TVs); first aid / incident typed as dates.
    var s = feed.safety || {};
    var recordable = isoDay(s.sinceISO) ? daysBetween(s.sinceISO, today) : num(s.days);
    var pills = [
      ["Recordable", recordable],
      ["First Aid", input ? daysBetween(input.LAST_FIRSTAID, today) : null],
      ["Incident", input ? daysBetween(input.LAST_INCIDENT, today) : null]
    ];
    document.getElementById("safety").innerHTML = pills.map(function (p) {
      return '<div class="pill"><b>' + (p[1] === null ? "--" : fmt(p[1])) + "</b><span>days without " + p[0] + "</span></div>";
    }).join("");
    var topic = document.getElementById("topic");
    topic.textContent = s.topic ? "Safety: " + s.topic : "Safety topic: none entered for today";
    topic.className = s.topic ? "topic" : "topic none";

    // A column whose LAST UPDATED date is before the day shown is dimmed: those typed
    // numbers belong to an older day.
    var stale = {};
    AREAS.forEach(function (ar) {
      var upd = input ? isoDay(input["UPDATED_" + ar[0]]) : null;
      stale[ar[0]] = !!input && (!upd || upd < board.reportDate);
    });

    var html = "<tr><th></th>" + AREAS.map(function (ar) {
      return "<th>" + esc(ar[1]) + (stale[ar[0]] ? "<small>NOT UPDATED</small>" : "") + "</th>";
    }).join("") + "</tr>";
    html += ROWS.map(function (r) {
      return '<tr><th class="row">' + esc(r[1]) + "</th>" + AREAS.map(function (ar) {
        var c = cellFor(r[0], ar[0], board, input);
        if (!c) return '<td class="empty"></td>';
        var cls = c.cls + (c.src === "input" && stale[ar[0]] ? " stale" : "");
        return '<td class="' + cls + '">' + c.html + '<span class="src">' + (c.src === "auto" ? "●" : "○") + "</span></td>";
      }).join("") + "</tr>";
    }).join("");
    document.getElementById("grid").innerHTML = html;

    // Legend + source health.
    var alerts = [];
    if (feed.sourceError) alerts.push(String(feed.sourceError));
    var beat = Date.parse(feed.heartbeatAt), server = Date.parse(feed.serverTime);
    if (Number.isFinite(beat) && Number.isFinite(server) && server - beat > STALE_SOURCE_MS && !PREVIEW) alerts.push("Source PC hasn't checked in since " + timeText(feed.heartbeatAt));
    if (!input) alerts.push("Daily Board Input.xlsx not found next to the department files");
    var legend = (alerts.length ? '<span class="alert">' + esc(alerts.join(" · ")) + "</span>" : "") +
      "<span>● from the department Excel files</span><span>○ typed in Daily Board Input</span>" +
      (board.inputSavedAt ? "<span>Input saved " + esc(timeText(board.inputSavedAt)) + "</span>" : "") +
      (feed.updatedAt ? "<span>Data " + esc(timeText(feed.updatedAt)) + "</span>" : "");
    document.getElementById("legend").innerHTML = legend;

    // Bottom strip.
    function pairs(prefix) {
      var out = [];
      for (var i = 1; i <= 6; i++) {
        var part = input ? input[prefix + "_PART_" + i] : null;
        var qty = input ? num(input[prefix + "_QTY_" + i]) : null;
        if (part || qty !== null) out.push([part || "", qty]);
      }
      return out;
    }
    function list(items, empty) {
      if (!items.length) return '<div class="kv"><div class="muted">' + esc(empty) + "</div></div>";
      return '<div class="kv">' + items.map(function (it, i) {
        return '<div><span><span class="n">' + (i + 1) + "</span>" + esc(it[0]) + "</span><b>" + (num(it[1]) !== null ? fmt(it[1]) : "") + "</b></div>";
      }).join("") + "</div>";
    }
    function total(items) {
      var t = items.reduce(function (s2, it) { return s2 + (num(it[1]) || 0); }, 0);
      return t ? " · " + fmt(t) : "";
    }
    function ordersLine(label, key) {
      var o = input ? num(input[key + "_ORDERS"]) : null, f = input ? num(input[key + "_FORECAST"]) : null;
      return "<div><span>" + label + "</span><span>" + (o !== null ? fmt(o) : "--") + " / " + (f !== null ? fmt(f) : "--") + "</span></div>";
    }
    var adh = num(board.adherence);
    var topSix = pairs("TOPSIX"), topTanks = pairs("TOPTANKS");
    var shorts = board.loading && Array.isArray(board.loading.topShorts) ? board.loading.topShorts.filter(function (x) { return Array.isArray(x); }).map(function (x) { return [String(x[0]), num(x[1])]; }) : [];
    document.getElementById("bottom").innerHTML =
      '<div class="card"><h2>Production needs</h2>' +
        '<div class="big ' + (adh !== null ? pctClass(adh) : "") + '">' + (adh !== null ? adh + "%" : "--") + "</div>" +
        '<div class="meta">Plant adherence · orders / forecast</div>' +
        '<div class="kv" style="margin-top:1vh">' + ordersLine("GFP", "GFP") + ordersLine("Tank", "TANK") + "</div></div>" +
      '<div class="card two"><div><h2>Top six' + total(topSix) + "</h2>" + list(topSix, "Not entered") + "</div>" +
        "<div><h2>Top shorts · week</h2>" + list(shorts.slice(0, 6), "No shorts this week") + "</div></div>" +
      '<div class="card"><h2>Top six tanks' + total(topTanks) + "</h2>" + list(topTanks, "Not entered") + "</div>";
  }

  // ---- feed polling ------------------------------------------------------------------
  function activeHours() {
    var p = plantParts();
    var min = p.h * 60 + p.min;
    return p.wd >= 1 && p.wd <= 5 && min >= 4 * 60 + 30 && min < 16 * 60;
  }
  var loadedAt = Date.now();
  function schedule() {
    // Reload once a day around 3 AM so a TV left on picks up new versions of this page.
    var p = plantParts();
    if (p.h === 3 && Date.now() - loadedAt > 3 * 3600 * 1000) { location.reload(); return; }
    setTimeout(poll, activeHours() ? 15000 : 300000);
  }
  function poll() {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
    fetch(FEED_URL, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (feed) {
        if (feed.timeZone && !timeZone) timeZone = feed.timeZone;
        render(feed);
      })
      .catch(function (err) {
        var wait = document.getElementById("wait");
        if (!wait.hidden) document.getElementById("wait-why").textContent = "No connection to the dashboard feed (" + (err && err.message ? err.message : err) + ").";
      })
      .then(function () { if (timer) clearTimeout(timer); schedule(); });
  }

  function sample() {
    var input = {
      LAST_FIRSTAID: "2026-09-08", LAST_INCIDENT: "2025-03-30",
      ATTAIN_MAINT: 0.57, ATTAIN_LOAD: 0.94, ATTAIN_ASSY: 1,
      QUALITY_FAB: 0.99, QUALITY_WELD: 0.48, QUALITY_PAINT: 0.97, QUALITY_TANKS: 0.9, QUALITY_INV: "Yes",
      EFF_INV: "Yes", EFF_ASSY: "Yes",
      OT_FAB: 0, OT_WELD: 0, OT_PAINT: 0, OT_MAINT: 0, OT_TANKS: 0, OT_LOAD: 0, OT_ASSY: 5,
      FIVE_S_FAB: "Good", FIVE_S_WELD: "Improve", FIVE_S_PAINT: "Good",
      HEAD_MAINT: "2/2", HEAD_LOAD: "7/8", HEAD_INV: "1/3", HEAD_ASSY: "1/1",
      ISSUES_MAINT: "FI 243, FI 195", ISSUES_LOAD: "FI 243",
      GFP_ORDERS: 5248, GFP_FORECAST: 3814, TANK_ORDERS: 313, TANK_FORECAST: 1219
    };
    AREAS.forEach(function (ar) { input["UPDATED_" + ar[0]] = "2026-09-22"; });
    input.UPDATED_INV = "2026-09-18";
    [["ECBL12", 3825], ["BHTB", 324], ["RFM", 164], ["EWBL66", 147], ["BXTR", 140], ["ECBL2T", 109]].forEach(function (x, i) { input["TOPSIX_PART_" + (i + 1)] = x[0]; input["TOPSIX_QTY_" + (i + 1)] = x[1]; });
    [["WT214", 244], ["UT226CL", 22], ["WT224", 18], ["GCT2CL", 12], ["GUT22", 10], ["GUT2", 7]].forEach(function (x, i) { input["TOPTANKS_PART_" + (i + 1)] = x[0]; input["TOPTANKS_QTY_" + (i + 1)] = x[1]; });
    return {
      safety: { topic: "PPE is not an option — it is required", sinceISO: "2025-06-29" },
      updatedAt: new Date().toISOString(),
      board: {
        reportDate: "2026-09-22",
        areas: {
          FAB: { attainment: 100, efficiency: 13, present: 4, expected: 6, actual: 3502, forecast: 3502 },
          WELD: { attainment: 60, efficiency: 19, present: 14, expected: 18, actual: 132, forecast: 220 },
          PAINT: { attainment: 65, efficiency: 63, present: 9, expected: 10, actual: 546, forecast: 840 },
          TANKS: { attainment: 0, efficiency: 0, present: 0, expected: 6, actual: 0, forecast: 55, down: true }
        },
        adherence: 60,
        loading: { loads: 5, pieces: 970, shorts: 58, inFull: 94, pcsPerLoad: 194, topShorts: [["EWBL66", 32], ["EWR4", 4], ["2SLG612", 3], ["2FSWG12", 3], ["6ERS", 2], ["EHB", 2]] },
        input: input,
        inputSavedAt: new Date().toISOString()
      }
    };
  }

  if (PREVIEW) render(sample());
  else poll();
})();
