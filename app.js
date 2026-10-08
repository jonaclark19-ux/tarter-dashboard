// Dashboard app (source PC and TVs). Loaded by index.html; kept out of the page so the
// Content-Security-Policy can allow scripts from this site only (no inline scripts).
(() => {
  // src/js/config.js
  // &schedule=off (testing / troubleshooting): fast checks around the clock, no weekend screen.
  var SCHEDULE_OFF = /[?&]schedule=off(&|$)/.test(location.search);
  var SHIFT_START_HOUR = 5;
  var SHIFT_END_HOUR = 15;
  var SHIFT_END_MINUTE = 30;
  // Shift times are plant wall-clock times. Every screen uses the plant's time zone -
  // the source PC's own, carried in the feed - instead of whatever zone its device
  // happens to be set to, so a TV box set up with the wrong zone still shows the right
  // SHIFT TIME LEFT, projection and clock. &tz=Area/City in the link overrides it.
  var plantTimeZone = null;
  var plantTzFormatter = null;
  var plantTzFromUrl = false;
  function setPlantTimeZone(tz) {
    if (!tz || tz === plantTimeZone) return;
    try {
      plantTzFormatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
      plantTimeZone = tz;
    } catch (err) {
      // Unknown zone name: keep using the device's own clock.
    }
  }
  /** Now, as a Date whose local fields (getHours() etc.) read the plant's wall clock. */
  function plantNow() {
    const real = new Date();
    if (!plantTzFormatter) return real;
    const p = {};
    for (const part of plantTzFormatter.formatToParts(real)) p[part.type] = part.value;
    return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second), real.getMilliseconds());
  }
  function deviceTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (err) { return null; }
  }
  (function () {
    const m = /[?&]tz=([^&]+)/.exec(location.search);
    if (m) { setPlantTimeZone(decodeURIComponent(m[1])); plantTzFromUrl = plantTimeZone !== null; }
  })();
  var EXPECTED_HEADCOUNT = { welding: 16, paint: 10, tanks: 7, fab: 4 };
  var WELD_BLOCK_STARTS = ["A", "E", "I", "M", "Q"];
  var FAB_BLOCK_STARTS = ["A", "F", "K", "P", "U"];
  // "UPLH Goal - 4.38", "UPLH Goal: 4.38 pcs", "UPLH GOAL .45", "UPLH Goal 4,38".
  var UPLH_GOAL_TEXT_RE = /uplh\s*goal\D*?(\d*[.,]?\d+)/i;
  function parseUplhGoalText(text) {
    const m = UPLH_GOAL_TEXT_RE.exec(String(text || "")) || /(\d*[.,]?\d+)\s*$/.exec(String(text || "").trim());
    if (!m) return null;
    const n = parseFloat(m[1].replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  var PAINT_COLOR_MAP = {
    BLACK: { name: "BLACK", hex: "#1A1A1A", gradient: "linear-gradient(90deg, #013449, #1A1A1A)" },
    GREEN: { name: "GREEN", hex: "#16A34A", gradient: "linear-gradient(90deg, #013449, #16A34A)" },
    BROWN: { name: "BROWN", hex: "#7C4A2D", gradient: "linear-gradient(90deg, #013449, #7C4A2D)" },
    RED: { name: "RED", hex: "#D32026", gradient: "linear-gradient(90deg, #013449, #D32026)" },
    BLUE: { name: "BLUE", hex: "#1D4ED8", gradient: "linear-gradient(90deg, #013449, #1D4ED8)" },
    WHITE: { name: "WHITE", hex: "#E5E5E5", gradient: "linear-gradient(90deg, #013449, #E5E5E5)" },
    GRAY: { name: "GRAY", hex: "#6B7280", gradient: "linear-gradient(90deg, #013449, #6B7280)" },
    GREY: { name: "GREY", hex: "#6B7280", gradient: "linear-gradient(90deg, #013449, #6B7280)" },
    YELLOW: { name: "YELLOW", hex: "#EAB308", gradient: "linear-gradient(90deg, #013449, #EAB308)" },
    ORANGE: { name: "ORANGE", hex: "#F97316", gradient: "linear-gradient(90deg, #013449, #F97316)" },
    TAN: { name: "TAN", hex: "#C1B087", gradient: "linear-gradient(90deg, #013449, #C1B087)" },
    BEIGE: { name: "BEIGE", hex: "#C1B087", gradient: "linear-gradient(90deg, #013449, #C1B087)" },
    GALV: { name: "GALV", hex: "#B0B7BD", gradient: "linear-gradient(90deg, #013449, #B0B7BD)" },
    "GALV.": { name: "GALV", hex: "#B0B7BD", gradient: "linear-gradient(90deg, #013449, #B0B7BD)" }
  };
  var ERROR_STRINGS = /* @__PURE__ */ new Set(["#DIV/0!", "#NAME?", "#REF!", "#VALUE!", "#N/A", "#NULL!", "#NUM!", "#SPILL!", "#CALC!", "#GETTING_DATA", "#FIELD!", "#BLOCKED!", "#CONNECT!", "#BUSY!", "#UNKNOWN!"]);
  var SHEET_DATE_RE = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/;
  var CELL_DATE_RE = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/;
  // One workbook per department, named for the department; the tabs inside are named
  // only with a date. Paint keeps one tab per day, the rest one tab per week (Monday).
  var DEPT_SOURCES = [
    { id: "fab", label: "FAB", fileMatch: /fab/i, cadence: "week" },
    { id: "welding", label: "WELDING", fileMatch: /weld/i, cadence: "week" },
    { id: "paint", label: "PAINT", fileMatch: /paint/i, cadence: "day" },
    { id: "tanks", label: "TANKS", fileMatch: /tank/i, cadence: "week" }
  ];
  var sampleDepartmentData = [
    {
      id: "fab",
      name: "FAB",
      status: "on_target",
      meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
      attainment: 84,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment: 79,
      headline: { icon: "\u{1F464}", active: 4, total: 4, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
      stats: [
        { label: "ACTUAL", value: "3502", tone: "default" },
        { label: "FORECAST", value: "4172", tone: "default" },
        { label: "UPLH", value: "38.2", tone: "default" },
        { label: "UPLH GOAL", value: "45.3", tone: "default" }
      ]
    },
    {
      id: "welding",
      name: "WELDING",
      status: "on_target",
      meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
      attainment: 84,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment: 88,
      headline: { icon: "\u{1F464}", active: 16, total: 16, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
      stats: [
        { label: "ACTUAL", value: "185", tone: "default" },
        { label: "FORECAST", value: "220", tone: "default" },
        { label: "UPLH", value: "3.8", tone: "default" },
        { label: "UPLH GOAL", value: "4.0", tone: "default" }
      ],
      notes: [{ type: "warning", label: "MATERIAL / ISSUES", content: "EHSPBR4W · 6GG16W", customColor: "#D97706" }]
    },
    {
      id: "paint",
      name: "PAINT",
      status: "at_risk",
      meta: "CURRENT DAY ONLY",
      attainment: 74,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment: 81,
      headline: { icon: "\u{1F464}", active: 8, total: 10, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
      stats: [
        { label: "PAINTED", value: "620", tone: "default" },
        { label: "SCHEDULED", value: "840", tone: "default" },
        { label: "UPLH", value: "77", tone: "default" },
        { label: "GOAL", value: "84", tone: "default" },
        { label: "DOWNTIME", value: "30 MINS", tone: "yellow" }
      ],
      notes: [{ type: "warning", label: "DOWNTIME LOG", content: "Change color 5:25am-5:55am \xB7 paintbooth motor 6:10am", customColor: "#D97706" }],
      currentColor: { name: "GREEN", hex: "#16A34A", gradient: "linear-gradient(90deg, #013449, #16A34A)" }
    },
    {
      id: "tanks",
      name: "TANKS",
      status: "at_risk",
      meta: "DAILY GRID + LAYERS A B C",
      attainment: 69,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment: 72,
      headline: { icon: "\u{1F464}", active: 4, total: 7, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
      stats: [
        { label: "PRODUCTION", value: "38", tone: "default" },
        { label: "SCHEDULED", value: "55", tone: "default" },
        { label: "UPLH", value: "3.2", tone: "default" },
        { label: "GOAL", value: "3.5", tone: "default" },
        { label: "WORKING ON", value: "SWT313", tone: "green" }
      ]
    }
  ];
  var overallAttainmentMock = { actual: 1719, target: 2274, percent: 76 };
  // Demo numbers follow the clock, so the sample board (source PC before it loads data,
  // ?preview=1) shows believable paces at any hour instead of 190% at 8 AM.
  var SAMPLE_PACE = { fab: 0.95, welding: 0.86, paint: 0.7, tanks: 1.04 };
  function sampleDepartmentsNow() {
    const frac = Math.max(0.05, shiftProjectionContext(todayISO()).fraction);
    return sampleDepartmentData.map((d) => {
      const c = JSON.parse(JSON.stringify(d));
      const goal = c.stats.find((x) => x.label === "UPLH GOAL" || x.label === "GOAL");
      const uplh = c.stats.find((x) => x.label === "UPLH");
      if (goal && uplh) uplh.value = String(Math.round(Number(goal.value) * (SAMPLE_PACE[c.id] || 1) * frac * 10) / 10);
      return c;
    });
  }

  // src/js/alertEngine.js
  var AlertEngine = class {
    constructor(dept, elapsedMinutes, totalShiftMinutes = 630) {
      this.dept = dept;
      this.elapsed = elapsedMinutes;
      this.elapsedHours = Math.max(0, this.elapsed / 60);
      this.remaining = Math.max(0, totalShiftMinutes - this.elapsed);
      this.hoursRemaining = this.remaining / 60;
      this.uplhCurrent = this._findStat(["UPLH"]);
      this.uplhGoal = this._findStat(["UPLH GOAL", "GOAL"]);
      this.uplhPace = uplhPaceNow(dept, this.uplhCurrent, this.uplhGoal);
      this.produced = this._findStat(["ACTUAL", "PAINTED", "PRODUCTION", "DONE QTY"]);
      this.scheduled = this._findStat(["FORECAST", "SCHEDULED", "TOTAL QTY"]);
      this.personnelActive = dept.headline && dept.headline.countsAsPersonnel ? dept.headline.active : null;
      this.personnelExpected = dept.headline && dept.headline.countsAsPersonnel ? dept.headline.total : null;
    }
    _findStat(labels) {
      if (!this.dept || !this.dept.stats) return null;
      for (const label of labels) {
        const stat = this.dept.stats.find((s) => s.label === label);
        if (stat !== void 0 && stat.value !== "N/A") {
          const val = parseFloat(stat.value);
          if (!isNaN(val)) return val;
        }
      }
      return null;
    }
    /**
     * One status per department, driven by the TO UPLH GOAL pace: green from PACE_GREEN,
     * amber from PACE_AMBER, red below. A crew shortage can raise it. The badge, the top
     * border, the card colors and the plant alerts all read this one answer.
     */
    diagnose() {
      const ok = { level: 1, tone: "green", color: "bg-slate-50 border-green-500 text-slate-500", animate: "", icon: "\u2713", title: "ON PACE", message: "ON PACE" };
      if (this.dept.placeholder || isDeptDown(this.dept)) return Object.assign({}, ok, { tone: "neutral", title: "", message: "" });
      const shift = shiftProjectionContext(selectedDateISO());
      // Live = the shift has started and isn't over (before 5:00 people are still arriving).
      const live = !shift.isHistorical && !shift.complete && shift.elapsedMinutes > 0;
      const pace = this.uplhPace;
      let st;
      if (this.uplhCurrent === null || this.uplhGoal === null || !(this.uplhGoal > 0)) {
        st = { level: 2, tone: "amber", color: "bg-amber-400 border-amber-400 text-amber-900", animate: "", icon: "?", title: "CHECK SHEET", message: "UPLH MISSING" };
      } else if (!pace || pace.pct === null) {
        st = Object.assign({}, ok, { tone: "neutral", title: "BUILDING", message: "BUILDING", level: 1 });
      } else if (this.scheduled > 0 && this.produced !== null && this.produced >= this.scheduled) {
        st = { level: 1, tone: "green", color: "bg-green-600 border-green-600 text-white", animate: "", icon: "\u2713", title: "GOAL MET", message: "GOAL MET", showBadge: true };
      } else if (pace.pct >= PACE_GREEN) {
        st = ok;
      } else if (pace.pct >= PACE_AMBER) {
        st = { level: 2, tone: "amber", color: "bg-amber-400 border-amber-400 text-amber-900", animate: "", icon: "\u25BC", title: "BEHIND PACE", message: "BEHIND PACE" };
      } else {
        // Red border and UPLH block only: no badge or pulse on the card for a slow pace.
        st = { level: 4, tone: "red", color: "bg-red-600 border-red-600 text-white", animate: "", icon: "\u2716", title: "CRITICAL", message: "CRITICAL PACE", noBadge: true };
      }
      const paceTone = st.tone;
      // Missing people only matter on a live shift; a weekend or past day never alerts.
      if (live && this.personnelActive !== null && this.personnelExpected > 0 && this.personnelActive < this.personnelExpected) {
        const missing = this.personnelExpected - this.personnelActive;
        const level = missing / this.personnelExpected >= 0.25 ? 4 : 3;
        if (level >= st.level) {
          st = { level, tone: level === 4 ? "red" : "orange", color: level === 4 ? "bg-red-600 border-red-600 text-white" : "bg-orange-500 border-orange-500 text-white", animate: level === 4 ? "animate-pulse-border" : "", icon: "\u26A0", title: "SHORTAGE", message: `${missing} MISSING`, missing };
        }
      }
      // The hero (UPLH) block is colored by the pace alone, even when a shortage owns the badge.
      st.paceTone = paceTone;
      return st;
    }
  };

  // src/js/render.js
  // Drawn, not an emoji: older Smart TV browsers show some emoji as empty boxes.
  var PERSON_ICON = '<svg width="0.9em" height="0.9em" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:-0.1em"><circle cx="12" cy="7.5" r="4.5"/><path d="M3 21c0-4.6 4-7.5 9-7.5s9 2.9 9 7.5z"/></svg>';
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function formatNumberUI(n) {
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  function getStatusLabel(status) {
    switch (status) {
      case "on_target":
        return "ON PACE";
      case "at_risk":
        return "RECOVERY REQ.";
      case "critical":
        return "HIGH RISK";
      case "building":
        return "BUILDING";
      default:
        return "UNKNOWN";
    }
  }
  function shiftProjectionContext(selectedDateISO) {
    const totalMinutes = (SHIFT_END_HOUR * 60 + SHIFT_END_MINUTE) - SHIFT_START_HOUR * 60;
    if (!selectedDateISO || selectedDateISO !== todayISO()) {
      return { elapsedMinutes: totalMinutes, remainingMinutes: 0, fraction: 1, isHistorical: true, complete: true };
    }
    const now = plantNow();
    const shiftStart = new Date(now);
    shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
    const shiftEnd = new Date(now);
    shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
    if (now <= shiftStart) return { elapsedMinutes: 0, remainingMinutes: totalMinutes, fraction: 0, isHistorical: false, complete: false };
    if (now >= shiftEnd) return { elapsedMinutes: totalMinutes, remainingMinutes: 0, fraction: 1, isHistorical: false, complete: true };
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - shiftStart.getTime()) / 6e4));
    return {
      elapsedMinutes,
      remainingMinutes: Math.max(0, totalMinutes - elapsedMinutes),
      fraction: Math.max(0, Math.min(1, elapsedMinutes / totalMinutes)),
      isHistorical: false,
      complete: false
    };
  }
  // Each department's Excel UPLH divides today's output by a full shift of labor hours,
  // so at 10 AM it reads ~half of goal even when the crew is right on pace. The TO GOAL
  // ring shows the pace at this hour instead: UPLH scaled to the share of the shift worked.
  // Pace thresholds shared by the TO UPLH GOAL ring, the card status and PLANT TO GOAL.
  var PACE_GREEN = 80, PACE_AMBER = 60;
  function clockLabel(d) {
    const h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM");
  }
  function selectedDateISO() {
    return typeof state !== "undefined" && state.result && state.result.selectedDate ? state.result.selectedDate : todayISO();
  }
  /** When this department's Excel was last saved, as a plant-clock Date (like plantNow()). */
  function deptSavedPlant(deptId) {
    const sources = typeof state !== "undefined" && state.result && Array.isArray(state.result.sources) ? state.result.sources : [];
    const src = sources.find((x) => x && x.id === deptId);
    const ms = src && src.savedAt ? Date.parse(src.savedAt) : NaN;
    if (!Number.isFinite(ms)) return null;
    return new Date(plantNow().getTime() - (Date.now() - ms));
  }
  function uplhPaceNow(dept, uplh, goal) {
    if (!dept || uplh === null || goal === null) return null;
    if (dept.placeholder || !(goal > 0)) return { pct: null, sub: "No goal" };
    const shift = shiftProjectionContext(selectedDateISO());
    if (shift.isHistorical || shift.complete) return { pct: Math.round(uplh / goal * 100), sub: "Full shift", final: true };
    // The Excel UPLH only moves when someone saves, so the pace is measured at the last
    // save, not at the current minute: an 8:00 save viewed at 11:00 still reads "at 8:00".
    const now = plantNow();
    const shiftStart = new Date(now); shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
    let asOf = now;
    const saved = deptSavedPlant(dept.id);
    if (saved && saved >= shiftStart && saved < now) asOf = saved;
    // Runs from the start of the shift (the first minutes swing a lot - that's accepted).
    if (now < shiftStart) return { pct: null, sub: "From " + SHIFT_START_HOUR + " AM" };
    const elapsed = Math.max(1, Math.floor((asOf - shiftStart) / 6e4));
    const totalMinutes = (SHIFT_END_HOUR * 60 + SHIFT_END_MINUTE) - SHIFT_START_HOUR * 60;
    const paceUplh = uplh / Math.min(1, elapsed / totalMinutes);
    const idle = Math.floor((now - asOf) / 6e4);
    return {
      live: true,
      stale: idle >= FRESHNESS_STALE_MIN,
      uplh: paceUplh,
      pct: Math.round(paceUplh / goal * 100),
      sub: clockLabel(asOf)
    };
  }
  // A department is "down" when its sheet says 0 people present (typed as 0, not left
  // blank). Its card gets a NOT RUNNING cover and it stays out of the plant KPIs and
  // alerts, so a planned shutdown doesn't read as a shortage.
  function isDeptDown(d) {
    return !!(d && !d.placeholder && d.headline && d.headline.down === true);
  }
  function calculateDashboardKpis(departments) {
    departments = departments.filter((d) => !isDeptDown(d));
    // A blank headcount cell ("--" on the card) stays out of the plant total.
    const personnelDepts = departments.filter((d) => d.headline && d.headline.countsAsPersonnel && d.headline.active !== null && d.headline.active !== void 0);
    const totalPresent = personnelDepts.reduce((sum, d) => sum + (d.headline.active || 0), 0);
    const totalExpected = personnelDepts.reduce((sum, d) => sum + (d.headline.total || 0), 0);
    const totalDepts = departments.length;
    const liveMode = typeof state !== "undefined" && !!state.result;

    let overallActual = 0, overallTarget = 0;
    departments.forEach((d) => {
      const engine = new AlertEngine(d, 0);
      if (engine.produced !== null && engine.scheduled !== null && engine.scheduled > 0) {
        overallActual += engine.produced;
        overallTarget += engine.scheduled;
      }
    });

    // Never substitute demo numbers into a live dashboard. If comparable live totals are
    // missing, the KPI says N/A and the data warning explains the source problem.
    const overall = overallTarget > 0
      ? { actual: Math.round(overallActual), target: Math.round(overallTarget), percent: Math.round(overallActual / overallTarget * 100) }
      : liveMode
        ? { actual: null, target: null, percent: null }
        : overallAttainmentMock;

    // Plant TO GOAL: the plain average of the departments' TO UPLH GOAL rings, so every
    // department counts the same (summed units let FAB's thousands of parts outweigh a
    // 135-unit TANKS day). Each one is capped at PACE_CAP so one bad goal cell can't push
    // the plant to 500%, and the lowest department is named so a red one can't hide.
    const PACE_CAP = 150;
    const paces = departments.filter((d) => !d.placeholder).map((d) => ({ name: d.name, pace: new AlertEngine(d, 0).uplhPace })).filter((x) => x.pace);
    const paced = paces.filter((x) => x.pace.pct !== null);
    let projectedEndAttainment = paced.length ? Math.round(paced.reduce((sum, x) => sum + Math.min(PACE_CAP, x.pace.pct), 0) / paced.length) : null;
    let projectionCaption = "No UPLH data";
    if (paced.length) projectionCaption = "Avg of " + paced.length + " dept" + (paced.length === 1 ? "" : "s") + (paced[0].pace.final ? " \xB7 full shift" : "");
    else if (paces.length) projectionCaption = "Building \xB7 " + paces[0].pace.sub.replace(/^From/, "from");
    let projectionDetail = "";
    if (!liveMode) {
      projectionDetail = "Demo data only";
    } else if (paced.length > 1) {
      const low = paced.reduce((a, x) => (x.pace.pct < a.pace.pct ? x : a));
      projectionDetail = "Lowest: " + low.name + " " + low.pace.pct + "%";
    }

    let attainmentStatus = "building";
    if (projectedEndAttainment !== null) {
      attainmentStatus = "on_target";
      if (projectedEndAttainment < PACE_AMBER) attainmentStatus = "critical";
      else if (projectedEndAttainment < PACE_GREEN) attainmentStatus = "at_risk";
    }
    return {
      attainment: { percent: projectedEndAttainment, caption: projectionCaption, detail: projectionDetail },
      attainmentStatus,
      employees: { present: totalPresent, expected: totalExpected },
      departments: { total: totalDepts },
      overall
    };
  }
  function getShiftRemaining() {
    const now = plantNow();
    const shiftEnd = new Date(now);
    shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
    if (now > shiftEnd) return "ENDED";
    // Before the shift starts the tile shows the whole shift, not "11h" counting from 4 AM.
    const shiftStart = new Date(now);
    shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
    const from = now < shiftStart ? shiftStart : now;
    const minutes = Math.floor((shiftEnd.getTime() - from.getTime()) / 6e4);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h + "h " + String(m).padStart(2, "0") + "m";
  }
  function setTextIfChanged(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  function updateShiftKpi() {
    setTextIfChanged(document.getElementById("shift-time-left"), getShiftRemaining());
  }
  function renderTopKpis(departments) {
    const kpis = calculateDashboardKpis(departments);
    const isBuilding = kpis.attainmentStatus === "building";
    const attColor = isBuilding ? "text-slate-500" : kpis.attainmentStatus === "on_target" ? "text-green-600" : kpis.attainmentStatus === "at_risk" ? "text-amber-700" : "text-red-600";
    const attBg = isBuilding ? "bg-slate-100 text-slate-600 border-slate-200" : kpis.attainmentStatus === "on_target" ? "bg-green-100 text-green-700 border-green-200" : kpis.attainmentStatus === "at_risk" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200";
    const projectedValue = kpis.attainment.percent === null ? '<span class="text-2xl xl:text-3xl">N/A</span>' : kpis.attainment.percent + '<span class="text-lg xl:text-xl ml-0.5 opacity-70">%</span>';
    const overallAvailable = Number.isFinite(kpis.overall.percent) && Number.isFinite(kpis.overall.actual) && Number.isFinite(kpis.overall.target);
    const overallValue = overallAvailable ? kpis.overall.percent + '<span class="text-lg xl:text-xl ml-0.5 opacity-70">%</span>' : '<span class="text-2xl xl:text-3xl">N/A</span>';
    const overallCaption = overallAvailable ? kpis.overall.actual.toLocaleString() + " of " + kpis.overall.target.toLocaleString() + " Units" : "Live totals unavailable";
    const html = `
    <!-- KPI 1 -->
    <div class="bg-white rounded-xl px-4 py-3 shadow-soft border border-slate-100 relative overflow-hidden flex flex-col justify-between group">
      <div class="flex justify-between items-start mb-1 gap-2 flex-wrap">
        <h3 class="text-[10px] xl:text-[11px] font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
           <svg class="w-3.5 h-3.5 text-slate-300" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
           Plant To Goal
        </h3>
        <span class="px-1.5 py-0.5 text-[8px] xl:text-[9px] font-black tracking-wider rounded uppercase border ${attBg}">${getStatusLabel(kpis.attainmentStatus)}</span>
      </div>
      <div class="flex items-end gap-3 min-w-0">
        <div class="text-3xl xl:text-4xl font-black ${attColor} tracking-tighter metric-num shrink-0">${projectedValue}</div>
        <div class="min-w-0 pb-0.5">
          <p class="text-[10px] xl:text-xs font-semibold text-slate-600 leading-tight">${escapeHtml(kpis.attainment.caption || "")}</p>
          <p class="text-[9px] xl:text-[10px] font-medium text-slate-400 leading-tight mt-0.5">${escapeHtml(kpis.attainment.detail || "")}</p>
        </div>
      </div>
    </div>

    <!-- KPI 2 -->
    <div class="bg-white rounded-xl px-4 py-3 shadow-soft border border-slate-100 relative overflow-hidden flex flex-col justify-between">
      <div class="flex justify-between items-start mb-1 gap-2 flex-wrap">
        <h3 class="text-[10px] xl:text-[11px] font-bold text-slate-400 tracking-widest uppercase">Employees Present</h3>
        <svg class="w-4 h-4 text-slate-300" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
      </div>
      <div class="flex items-baseline gap-2">
        <div class="text-3xl xl:text-4xl font-black ${kpis.employees.present < kpis.employees.expected ? "text-red-500" : "text-green-600"} tracking-tighter metric-num">${kpis.employees.present}<span class="text-xl text-slate-300 font-bold ml-1">/${kpis.employees.expected}</span></div>
        <p class="text-[10px] xl:text-xs font-semibold text-slate-500">Active personnel</p>
      </div>
    </div>

    <!-- KPI 3 -->
    <div class="bg-white rounded-xl px-4 py-3 shadow-soft border border-slate-100 relative overflow-hidden flex flex-col justify-between">
      <div class="flex justify-between items-start mb-1 gap-2 flex-wrap">
        <h3 class="text-[10px] xl:text-[11px] font-bold text-slate-400 tracking-widest uppercase">Current Attainment</h3>
      </div>
      <div class="flex items-baseline gap-2">
        <div class="text-3xl xl:text-4xl font-black text-tarter-navy tracking-tighter metric-num">${overallValue}</div>
        <p class="text-[10px] xl:text-xs font-semibold text-slate-500">${overallCaption}</p>
      </div>
    </div>

    <!-- KPI 4 -->
    <div class="rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(79,70,229,0.15)] border-2 border-indigo-100 relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-[#1E293B] to-tarter-navy">
      <div class="flex justify-between items-start mb-1 relative z-10 gap-2 flex-wrap">
        <h3 class="text-[10px] xl:text-[11px] font-bold text-white/80 tracking-widest uppercase">Shift Time Left</h3>
        <svg class="w-4 h-4 text-tarter-beige" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
      <div class="relative z-10 flex items-baseline gap-2">
        <div class="text-3xl xl:text-4xl font-black text-white tracking-tighter metric-num drop-shadow-md whitespace-nowrap" id="shift-time-left">--:--</div>
        <p class="text-[10px] xl:text-xs font-semibold text-tarter-beige/90">${String(SHIFT_START_HOUR > 12 ? SHIFT_START_HOUR - 12 : SHIFT_START_HOUR)}:00 AM – ${String(SHIFT_END_HOUR - 12)}:${String(SHIFT_END_MINUTE).padStart(2, "0")} PM</p>
      </div>
    </div>
  `;
    const row = document.getElementById("top-kpis");
    if (LAYOUT_V2) {
      // Low, horizontal tiles: big number, then title and one detail line beside it.
      const safety = renderSafetyTile(state && state.result ? state.result.safety : null);
      const caption = String(kpis.attainment.caption || "").replace(/^Projected (?=[\d,]+ units)/, "");
      const shiftWindow = `${String(SHIFT_START_HOUR > 12 ? SHIFT_START_HOUR - 12 : SHIFT_START_HOUR)}:00 AM \u2013 ${String(SHIFT_END_HOUR - 12)}:${String(SHIFT_END_MINUTE).padStart(2, "0")} PM`;
      const short = kpis.employees.present < kpis.employees.expected;
      row.innerHTML = safety + `
      <div class="kpi2">
        <div class="kpi2-num metric-num ${attColor}">${projectedValue}</div>
        <div class="kpi2-text"><div class="kpi2-title">Plant to goal</div><div class="kpi2-sub">${escapeHtml(caption)}</div>${kpis.attainment.detail ? `<div class="kpi2-sub">${escapeHtml(kpis.attainment.detail)}</div>` : ""}</div>
      </div>
      <div class="kpi2">
        <div class="kpi2-num metric-num ${short ? "text-red-500" : "text-green-600"}">${Number(kpis.employees.present) || 0}<span class="kpi2-of">/${Number(kpis.employees.expected) || 0}</span></div>
        <div class="kpi2-text"><div class="kpi2-title">Active personnel</div><div class="kpi2-sub">Present / expected</div></div>
      </div>
      <div class="kpi2 kpi2-dark">
        <div class="kpi2-num metric-num" id="shift-time-left">--:--</div>
        <div class="kpi2-text"><div class="kpi2-title">Shift left</div><div class="kpi2-sub">${shiftWindow}</div></div>
      </div>`;
      row.style.gridTemplateColumns = safety ? "1.35fr repeat(3, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))";
    } else {
      row.innerHTML = html;
    }
    updateShiftKpi();
  }
  function attStoplightColor(v) {
    if (v <= 35) return "#DC2626";
    if (v <= 75) return "#F59E0B";
    return "#16A34A";
  }
  // Pace is already time-adjusted: green from PACE_GREEN, amber from PACE_AMBER, red below.
  function paceStoplightColor(v) {
    if (v < PACE_AMBER) return "#DC2626";
    if (v < PACE_GREEN) return "#D97706"; // darker amber: readable from across the floor
    return "#16A34A";
  }
  function progressRing(value, size, colorFn) {
    const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
    const stroke = LAYOUT_V2 ? Math.round(size / 9) : size >= 56 ? 6 : 5;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct / 100;
    // A zero-length arc with round caps still paints a dot, so 0 (and "--") draws no arc.
    const color = value === null || pct <= 0 ? "none" : (colorFn || attStoplightColor)(value);
    const fontSize = LAYOUT_V2 ? Math.round(size / 4.2) : size >= 56 ? 15 : 13;
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="flex-shrink-0 -rotate-90" style="transform:rotate(-90deg)">
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="${stroke}"></circle>
        <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" style="transition: stroke-dasharray 0.8s ease"></circle>
        <text x="${cx}" y="${cx}" transform="rotate(90 ${cx} ${cx})" text-anchor="middle" dominant-baseline="central"
          font-size="${fontSize}" font-weight="900" fill="#013449" class="metric-num">${value === null ? "--" : value > 200 ? ">200%" : value + "%"}</text>
      </svg>`;
  }
  function renderAttainmentRow(data, pace) {
    const hasWeek = !!pace || data.weekAttainment !== null && data.weekAttainment !== void 0 && !Number.isNaN(data.weekAttainment);
    // With the TO GOAL ring, DAY keeps only the room it needs so "TO GOAL" fits unclipped.
    const cell = (value, label, sub, colorFn, grow = true) => `
      <div class="flex items-center gap-2.5 ${grow ? "flex-1" : "flex-shrink-0"} min-w-0">
        <div class="ring-slot flex-shrink-0" data-size-lg="56" data-size-sm="48">${progressRing(value, LAYOUT_V2 ? 84 : 56, colorFn)}</div>
        <div class="min-w-0">
           <div class="text-[10px] xl:text-xs font-black text-slate-600 tracking-widest uppercase whitespace-nowrap leading-tight" style="line-height:1.15">${label}</div>
           <div class="text-[9px] xl:text-[10px] font-semibold text-slate-400 leading-tight" style="margin-top:2px">${sub}</div>
        </div>
      </div>`;
    // Labels are fixed markup; the <br> keeps them two short lines beside the ring.
    // DAILY ATT. climbs all day, so its color compares it with what was expected by now
    // (attainment / share of the shift worked), on the same 80 / 60 scale as the pace.
    const shiftNow = shiftProjectionContext(selectedDateISO());
    const dayColor = (v) => (shiftNow.fraction > 0 ? paceStoplightColor(Math.round(v / shiftNow.fraction)) : "#475569");
    const dayCell = cell(data.attainment, "DAILY<br>ATT.", "", pace ? dayColor : null, !pace);
    // A symbol next to the time, so the status doesn't rest on red vs green alone.
    const paceMark = !pace || pace.pct === null ? "" : pace.pct >= PACE_GREEN ? "\u2713 " : pace.pct >= PACE_AMBER ? "\u25BC " : "\u2716 ";
    const weekCell = pace ? cell(pace.pct, "TO UPLH<br>GOAL", paceMark + pace.sub, paceStoplightColor) : hasWeek ? cell(data.weekAttainment, "WEEK", "Mon\u2013now") : "";
    const divider = hasWeek ? `<div class="w-px self-stretch bg-slate-200 mx-1 my-1"></div>` : "";
    return `
      <div class="mb-6 px-1 shrink-0">
        ${LAYOUT_V2 ? "" : `<div class="text-[9px] xl:text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">ATTAINMENT</div>`}
        <div class="flex items-center gap-2">
          ${dayCell}${divider}${weekCell}
        </div>
      </div>`;
  }
  function renderDeptCard(data) {
    try {
      const engine = new AlertEngine(data, 0);
      const diagnosis = engine.diagnose();
      let topBorderClass = "border-t-slate-200";
      if (diagnosis.level === 1) topBorderClass = diagnosis.tone === "neutral" ? "border-t-slate-200" : "border-t-green-500";
      if (diagnosis.level === 2) topBorderClass = "border-t-amber-400";
      if (diagnosis.level === 3) topBorderClass = "border-t-orange-500";
      if (diagnosis.level === 4) topBorderClass = "border-t-red-600 " + diagnosis.animate;
      if (diagnosis.level === 5) topBorderClass = "border-t-slate-800";
      if (data.placeholder) topBorderClass = "border-t-slate-300";
      let heroHtml = "";
      let statsHtml = `<div class="grid grid-cols-2 gap-3 mb-5">`;
      let badgeHtml = "";
      if ((diagnosis.level > 1 || diagnosis.showBadge) && !diagnosis.noBadge) {
        badgeHtml = `
        <div class="absolute top-4 right-4 px-3 py-1.5 rounded-md text-[10px] font-black tracking-widest uppercase shadow-md flex items-center gap-1.5 z-10 ${diagnosis.color}">
          <span aria-hidden="true">${diagnosis.icon}</span> ${escapeHtml(diagnosis.message)}
        </div>
      `;
      }
      const hasUplh = engine.uplhCurrent !== null && engine.uplhGoal !== null;
      if (hasUplh) {
        const uplhNum = engine.uplhCurrent;
        const goalNum = engine.uplhGoal;
        const uplhPct = goalNum > 0 ? Math.min(100, uplhNum / goalNum * 100) : 0;
        // Colored by the department status (time-adjusted pace), not by the raw full-day
        // UPLH, so an on-pace crew doesn't look like it is failing at 8 AM.
        const tone = data.placeholder ? "neutral" : diagnosis.paceTone || diagnosis.tone;
        const toneCls = {
          neutral: ["bg-slate-50 border-slate-200", "text-slate-400", "text-slate-500", "bg-slate-300"],
          green: ["bg-slate-50 border-slate-200", "text-tarter-navy", "text-slate-500", "bg-green-500"],
          amber: ["bg-amber-50 border-amber-200", "text-amber-700", "text-amber-700", "bg-amber-400"],
          orange: ["bg-orange-50 border-orange-200", "text-orange-700", "text-orange-700", "bg-orange-500"],
          red: ["bg-red-50 border-red-200", "text-red-700", "text-red-700", "bg-red-600"]
        }[tone] || ["bg-slate-50 border-slate-200", "text-tarter-navy", "text-slate-500", "bg-green-500"];
        const [blockBg, textColor, labelColor, barBg] = toneCls;
        heroHtml = `
        <div class="${blockBg} border rounded-xl p-4 mb-5 relative overflow-hidden shrink-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-[10px] xl:text-xs font-bold ${labelColor} tracking-widest uppercase">UPLH TODAY</span>
          </div>
          <div class="flex items-end gap-2 mb-3 flex-wrap">
            <div class="text-4xl 2xl:text-5xl font-black ${textColor} metric-num leading-none">${formatNumberUI(uplhNum)}</div>
            <div class="text-xl 2xl:text-3xl font-black text-green-600 mb-1 whitespace-nowrap">/ ${formatNumberUI(goalNum)} <span class="text-[11px] xl:text-sm tracking-widest">UPLH GOAL</span></div>
          </div>
          <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div class="h-full ${barBg} rounded-full bg-stripes" style="width: ${uplhPct}%"></div>
          </div>
        </div>
      `;
        heroHtml += renderAttainmentRow(data, engine.uplhPace);
      } else {
        const isAttGood = data.attainment >= 76;
        const isAttOk = data.attainment >= 36 && !isAttGood;
        const blockBg = isAttGood ? "bg-slate-50 border-slate-200" : isAttOk ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
        const textColor = isAttGood ? "text-tarter-navy" : isAttOk ? "text-amber-700" : "text-red-700";
        const labelColor = isAttGood ? "text-slate-500" : isAttOk ? "text-amber-700" : "text-red-700";
        const barBg = isAttGood ? "bg-green-600" : isAttOk ? "bg-amber-500" : "bg-red-600";
        heroHtml = `
        <div class="${blockBg} border rounded-xl p-4 mb-5 relative overflow-hidden shrink-0">
          <div class="flex justify-between items-center mb-1">
            <span class="text-[10px] xl:text-xs font-bold ${labelColor} tracking-widest uppercase">REAL TIME</span>
          </div>
          <div class="flex items-end gap-2 mb-3 flex-wrap">
            <div class="text-4xl 2xl:text-5xl font-black ${textColor} metric-num leading-none">${data.attainment}<span class="text-2xl 2xl:text-3xl opacity-70">%</span></div>
            <div class="text-xl 2xl:text-3xl font-black text-green-600 mb-1 whitespace-nowrap">/ 100% <span class="text-[11px] xl:text-sm tracking-widest">GOAL</span></div>
          </div>
          <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div class="h-full ${barBg} rounded-full bg-stripes transition-all duration-1000" style="width: ${Math.min(100, data.attainment)}%"></div>
          </div>
        </div>
        <div class="text-[10px] xl:text-xs font-bold text-slate-400 tracking-widest uppercase mb-5 truncate shrink-0">${escapeHtml(data.attainmentLabel)}</div>
      `;
        if (data.weekAttainment !== null && data.weekAttainment !== void 0 && !Number.isNaN(data.weekAttainment)) {
          heroHtml += `
        <div class="flex items-center gap-2.5 mb-5 px-1 shrink-0">
          ${progressRing(data.weekAttainment, 48)}
          <div class="text-[9px] xl:text-[10px] font-bold text-slate-500 tracking-widest uppercase">WEEK ATTAINMENT<br><span class="text-slate-400 normal-case tracking-normal">Mon\u2013now</span></div>
        </div>
      `;
        }
      }
      const hasNotes = Array.isArray(data.notes) && data.notes.length > 0;
      let v2Downtime = null;
      data.stats.forEach((s) => {
        if (hasUplh && (s.label === "UPLH" || s.label === "UPLH GOAL" || s.label === "GOAL")) return;
        if (LAYOUT_V2) {
          if (s.label === "DOWNTIME") { v2Downtime = s.value; return; }
          if (s.label === "WORKING ON" && hasNotes) return;
          s = Object.assign({}, s, { label: V2_STAT_LABELS[s.label] || s.label });
        }
        let valColor = "text-tarter-navy";
        if (s.tone === "green") valColor = "text-green-600";
        if (s.tone === "yellow") valColor = "text-amber-600";
        if (s.tone === "red") valColor = "text-red-600";
        const displayValue = typeof s.value === "number" ? formatNumberUI(s.value) : escapeHtml(s.value);
        const isWide = ["WORKING ON", "DOWNTIME"].includes(s.label);
        const colSpanClass = isWide ? "col-span-2" : "";
        statsHtml += `
        <div class="bg-slate-50 border border-slate-100 rounded-lg p-3 shadow-sm min-w-0 ${colSpanClass}${isWide ? " stat-wide" : ""}">
          <div class="stat-lbl text-[9px] xl:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate">${escapeHtml(s.label)}</div>
          <div class="stat-val text-base xl:text-lg font-black ${valColor} metric-num leading-tight">${displayValue}</div>
        </div>
      `;
      });
      statsHtml += `</div>`;
      // v2: downtime / material notes sit right under ACTUAL / SCHEDULED on every card.
      let notesHtml = `<div class="${LAYOUT_V2 ? "card-notes" : "mt-auto"} flex flex-col gap-3 shrink-0">`;
      let notes = data.notes || [];
      if (LAYOUT_V2 && v2Downtime !== null && v2Downtime !== "" && v2Downtime !== 0) {
        const i = notes.findIndex((n) => /DOWNTIME/i.test(n.label || ""));
        notes = notes.slice();
        if (i === -1) notes.unshift({ type: "warning", label: "DOWNTIME \u00B7 " + v2Downtime, content: "", customColor: "#D97706" });
        else notes[i] = Object.assign({}, notes[i], { label: notes[i].label + " \u00B7 " + v2Downtime });
      }
      if (notes.length) {
        notes.forEach((note) => {
          let bg = "bg-slate-50", border = "border-slate-200", title = "text-slate-600", text = "text-slate-700";
          if (note.type === "warning") {
            bg = "bg-amber-50";
            border = "border-amber-400";
            title = "text-amber-700";
            text = "text-amber-900";
          }
          if (note.type === "info") {
            bg = "bg-blue-50";
            border = "border-blue-400";
            title = "text-blue-700";
            text = "text-blue-900";
          }
          notesHtml += `
          <div class="${bg} border-l-[5px] ${border} p-4 rounded-r-xl shadow-sm">
            <div class="text-[10px] font-black ${title} tracking-widest uppercase mb-1" style="color: ${note.customColor ? escapeHtml(note.customColor) : ""}">${escapeHtml(note.label)}</div>
            ${note.content ? `<div class="note-text text-xs xl:text-sm font-semibold ${text} leading-tight">${escapeHtml(note.content)}</div>` : ""}
          </div>
        `;
        });
      }
      if (data.currentColor) {
        notesHtml += `
        <div class="rounded-xl p-3 xl:p-4 text-white text-center shadow-lg" style="background: ${escapeHtml(data.currentColor.gradient || data.currentColor.hex)}">
          <div class="text-[9px] xl:text-[10px] opacity-80 tracking-widest uppercase font-bold mb-1.5">CURRENTLY PAINTING</div>
          <div class="text-xl xl:text-2xl font-black tracking-widest flex items-center justify-center gap-3 truncate">
            <span class="inline-block w-4 h-4 xl:w-5 xl:h-5 rounded-sm border-2 border-white shadow-sm shrink-0" style="background-color: ${escapeHtml(data.currentColor.hex)}"></span>
            ${escapeHtml(data.currentColor.name)}
          </div>
        </div>
      `;
      }
      notesHtml += `</div>`;
      let overlayHtml = "";
      if (diagnosis.level === 5) {
        overlayHtml = `
      <div class="absolute inset-0 bg-slate-100/90 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center text-center p-6 border-t-[6px] border-slate-800 rounded-2xl">
          <div class="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg" aria-hidden="true">\u2716</div>
          <h2 class="text-xl font-black text-slate-800 uppercase tracking-widest mb-2">${escapeHtml(diagnosis.title)}</h2>
          <p class="text-sm font-bold text-slate-600">${escapeHtml(diagnosis.message)}</p>
      </div>`;
      }
      if (isDeptDown(data)) {
        overlayHtml = `
      <div class="dept-down-overlay" data-dept-down="${escapeHtml(data.id)}">
          <div class="dept-down-icon" aria-hidden="true"><svg width="44" height="44" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></div>
          <div class="dept-down-title">Not running</div>
          <div class="dept-down-sub">${escapeHtml(data.name)} is down today</div>
          <div class="dept-down-pill">0 personnel present</div>
      </div>`;
      }
      const personnelIsShort = data.headline.countsAsPersonnel && data.headline.active !== null && data.headline.active < data.headline.total;
      const personnelColor = personnelIsShort ? "text-red-600" : "text-tarter-navy";
      return `
      <div class="bg-white rounded-2xl shadow-md border border-slate-200 p-5 xl:p-6 flex flex-col relative overflow-hidden border-t-[6px] ${topBorderClass} transition-all h-full">
        ${overlayHtml}
        ${badgeHtml}

        ${LAYOUT_V2 ? `
        <div class="card-head shrink-0">
            <div class="dept-name font-black text-tarter-navy tracking-tight uppercase truncate">${escapeHtml(data.name)}</div>
            <div class="card-subrow">
              <div class="card-pill flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg shadow-inner shrink-0">
                <span class="text-slate-500 shrink-0" aria-hidden="true">${PERSON_ICON}</span>
                <span class="font-black ${personnelColor} metric-num shrink-0">${data.headline.active === null || data.headline.active === void 0 ? "--" : Number(data.headline.active)}/${Number(data.headline.total) || 0}</span>
              </div>
              ${renderFreshness(data.id)}
            </div>
        </div>` : `
        <div class="pr-24 xl:pr-28 mb-4 shrink-0">
            <div class="text-xl xl:text-2xl font-black text-tarter-navy tracking-tight mb-1 uppercase truncate">${escapeHtml(data.name)}</div>
            <p class="text-[9px] xl:text-[10px] font-bold tracking-widest text-slate-400 uppercase break-words leading-tight">${escapeHtml(data.meta)}</p>
            ${renderFreshness(data.id)}
        </div>

        <div class="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 mb-5 inline-flex self-start shadow-inner shrink-0 max-w-full">
          <span class="text-slate-500 text-xs xl:text-sm shrink-0" aria-hidden="true">${PERSON_ICON}</span>
          <span class="text-sm xl:text-base font-black ${personnelColor} metric-num shrink-0">${data.headline.active === null || data.headline.active === void 0 ? "--" : Number(data.headline.active)}/${Number(data.headline.total) || 0}</span>
          <span class="text-[8px] xl:text-[9px] font-bold text-slate-500 tracking-widest uppercase leading-tight ml-1 truncate">${escapeHtml(data.headline.label)}</span>
        </div>`}

        ${heroHtml}
        ${statsHtml}
        ${notesHtml}
      </div>
    `;
    } catch (err) {
      console.error(`Error rendering card for ${data.name}:`, err);
      return `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 flex flex-col items-center justify-center">
        <svg class="w-10 h-10 mb-2" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        <div class="font-bold text-sm uppercase tracking-wider">RENDER ERROR</div>
        <div class="text-xs opacity-70">${escapeHtml(data.name)}</div>
    </div>`;
    }
  }
  // Departments that keep their normal card, all zeros, when their Excel has no data
  // for the day (missing tab, error cells) instead of the NO DATA placeholder. Display
  // only: the zeros never count toward the plant KPIs.
  var ZERO_CARD_DEPTS = ["tanks"];
  function zeroDept(m) {
    return {
      id: m.id,
      name: m.name || String(m.id).toUpperCase(),
      status: "on_target",
      attainment: 0,
      attainmentLabel: "DAILY ATTAINMENT",
      headline: { icon: "\u{1F464}", active: 0, total: EXPECTED_HEADCOUNT[m.id] || 0, label: "PRESENT / EXPECTED" },
      stats: [
        { label: "PRODUCTION", value: 0, tone: "default" },
        { label: "SCHEDULED", value: 0, tone: "default" },
        { label: "UPLH", value: 0, tone: "default" },
        { label: "GOAL", value: 0, tone: "default" }
      ],
      notes: [{ type: "info", label: "NO DATA YET", content: m.reason || "Check the Excel sheet", customColor: "#64748B" }],
      placeholder: true
    };
  }
  function renderDeptGrid(departments, missing) {
    const cards = departments.map((d) => ({ id: d.id, html: renderDeptCard(d) }));
    for (const m of missing || []) {
      if (m && m.id && !cards.some((c) => c.id === m.id)) cards.push({ id: m.id, html: ZERO_CARD_DEPTS.indexOf(m.id) !== -1 ? renderDeptCard(zeroDept(m)) : renderMissingCard(m) });
    }
    const order = DEPT_SOURCES.map((d) => d.id);
    const rank = (id) => { const i = order.indexOf(id); return i === -1 ? order.length : i; };
    cards.sort((a, b) => rank(a.id) - rank(b.id));
    // Rebuilt every minute, but only written to the page when something actually changed.
    const grid = document.getElementById("dept-grid");
    const html = cards.map((c) => c.html).join("");
    if (grid.__lastHtml !== html) { grid.innerHTML = html; grid.__lastHtml = html; }
  }
  // "EXCEL SAVED 10:42 AM" under each department name, turning red when an area has
  // not touched its workbook for an hour during today's shift - so a department that
  // stopped logging is visible on the floor, not only in the numbers.
  var FRESHNESS_STALE_MIN = 120;
  function renderFreshness(deptId) {
    const sources = state && state.result && Array.isArray(state.result.sources) ? state.result.sources : [];
    const src = sources.find((x) => x && x.id === deptId);
    const savedMs = src && src.savedAt ? Date.parse(src.savedAt) : NaN;
    if (!Number.isFinite(savedMs)) return "";
    const opts = { hour: "numeric", minute: "2-digit" };
    if (plantTimeZone) opts.timeZone = plantTimeZone;
    let when;
    try { when = new Date(savedMs).toLocaleTimeString("en-US", opts); } catch (err) { when = new Date(savedMs).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
    const now = plantNow();
    const shiftStart = new Date(now); shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
    const shiftEnd = new Date(now); shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
    const idleMin = Math.floor((Date.now() - savedMs) / 6e4);
    const inShift = now >= shiftStart && now <= shiftEnd && (now - shiftStart) / 6e4 >= FRESHNESS_STALE_MIN;
    const isToday = state.result && state.result.selectedDate === todayISO();
    const savedToday = new Date(savedMs).toDateString() === new Date().toDateString();
    const stale = isToday && inShift && idleMin >= FRESHNESS_STALE_MIN;
    if (stale) {
      const h = Math.floor(idleMin / 60), m = idleMin % 60;
      const span = h ? h + "H " + String(m).padStart(2, "0") + "M" : m + "M";
      return `<p class="freshness stale" style="margin-top:6px;font-size:12px;font-weight:900;letter-spacing:.08em;color:#fff;background:#dc2626;display:inline-block;padding:3px 8px;border-radius:4px;text-transform:uppercase">\u26A0 ${LAYOUT_V2 ? "No update" : "No Excel update for"} ${escapeHtml(span)}</p>`;
    }
    return `<p class="freshness" style="margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#5b6b80;text-transform:uppercase">${LAYOUT_V2 ? "Saved" : "Excel saved"} ${escapeHtml(when)}${savedToday ? "" : " \u00B7 " + escapeHtml(new Date(savedMs).toLocaleDateString("en-US", plantTimeZone ? { month: "short", day: "numeric", timeZone: plantTimeZone } : { month: "short", day: "numeric" }))}</p>`;
  }
  function renderDataDayBadge() {
    const badge = document.getElementById("data-day-badge");
    if (!badge) return;
    const day = state.result && state.result.selectedDate;
    if (!day || day === todayISO()) { badge.style.display = "none"; return; }
    const d = new Date(day + "T12:00:00");
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const today = plantNow().getDay();
    badge.textContent = (today === 0 || today === 6 ? "Weekend \u00B7 " : "") + "Showing " + label;
    badge.style.display = "block";
  }
  function renderSafetyTile(safety) {
    const days = safetyDays(safety);
    if (days === null && !(safety && safety.topic)) return "";
    return `
    <div class="safety-tile${days !== null && days < 7 ? " safety-alert" : ""}">
      <div class="safety-days metric-num">${days === null ? "\u2013" : days.toLocaleString("en-US")}</div>
      <div class="safety-label">Days without<br>incidents</div>
      ${safety && safety.topic ? `<div class="safety-topic"><span class="safety-tag">TODAY'S TOPIC</span><span class="safety-text">${escapeHtml(safety.topic)}</span></div>` : ""}
    </div>`;
  }
  // Loading strip: real numbers once the loading workbook exists; until then the
  // preview shows clearly-labelled sample numbers so the layout can be judged.
  var LOADING_SAMPLE = { weekStart: "2026-09-28", trailersWeek: 14, trailersToday: 3, piecesWeek: 2681, shortsWeek: 61, fulfillment: 0.977, shorts: [["WFGGSC4", 12], ["EWG4T", 6], ["6EG16E", 4], ["WFGGSC14", 3], ["ECG16T", 2], ["LAWOB8", 2], ["HSFR12", 1], ["2W66", 1]], sample: true };
  // Weekly trailer goal (the loading workbook has no goal column). &loadgoal=N in a
  // link overrides it.
  var LOADING_WEEKLY_GOAL = (function () { const m = /[?&]loadgoal=(\d+)/.exec(location.search); return m ? Number(m[1]) : 16; })();
  function renderLoadingBar() {
    const el = document.getElementById("loading-bar");
    if (!el) return;
    if (!LAYOUT_V2) { el.style.display = "none"; return; }
    const d = (state && state.result && state.result.loading) || (LAYOUT_PREVIEW ? LOADING_SAMPLE : null);
    if (!d) { el.style.display = "none"; el.innerHTML = ""; return; }
    const goal = LOADING_WEEKLY_GOAL;
    // The % shows the real figure (21 of 16 = 131%); only the bar stops at full.
    const pct = goal ? Math.round(d.trailersWeek / goal * 100) : null;
    const week = new Date(d.weekStart + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const shorts = Array.isArray(d.shorts) ? d.shorts : [];
    const fulfil = typeof d.fulfillment === "number" ? Math.round(d.fulfillment * 1000) / 10 : null;
    el.style.display = "block";
    el.innerHTML = `
      <div class="loading-strip">
        <div class="loading-trailers">
          <div class="loading-title">LOADING</div>
          <div class="loading-sub">Week of ${escapeHtml(week)}${d.sample ? " \u00B7 sample data" : ""}</div>
          <div class="loading-count"><span class="lbl">TRAILERS</span><span class="num metric-num">${formatNumberUI(d.trailersWeek)}</span>${goal ? `<span class="goal">/ ${formatNumberUI(goal)}</span><span class="pct">${pct}%</span>` : `<span class="goal">today ${formatNumberUI(d.trailersToday || 0)}</span>`}</div>
          ${goal ? `<div class="loading-track"><div style="width:${Math.min(100, pct)}%"></div></div>` : ""}
        </div>
        <div class="loading-shorts">
          <div class="loading-shorts-total"><div class="lbl">TOTAL SHORTS</div><div class="num metric-num">${formatNumberUI(d.shortsWeek)}<span class="unit">PCS</span></div><div class="sub">this week${fulfil !== null ? " \u00B7 " + fulfil + "% filled" : ""}</div></div>
          <div class="loading-shorts-top">
          <div class="loading-shorts-head">TOP ${Math.min(6, shorts.length) || 6} SHORT PRODUCTS \u00B7 PCS</div>
          <div class="loading-shorts-list">${shorts.length ? shorts.slice(0, 6).map(([name, qty]) => `<div class="short-item"><span>${escapeHtml(String(name))}</span><b>${formatNumberUI(qty)}</b></div>`).join("") : `<div class="short-none">No short products this week</div>`}</div>
          </div>
        </div>
      </div>`;
  }
  var V2_STAT_LABELS = { FORECAST: "SCHEDULED", PAINTED: "ACTUAL", PRODUCTION: "ACTUAL" };
  function renderMissingCard(m) {
    return `
      <div class="bg-white rounded-2xl shadow-md border border-slate-200 p-5 xl:p-6 flex flex-col relative overflow-hidden border-t-[6px] border-t-slate-800 h-full" data-missing-dept="${escapeHtml(m.id)}">
        <div class="text-xl xl:text-2xl font-black text-tarter-navy tracking-tight mb-1 uppercase truncate">${escapeHtml(m.name || m.id)}</div>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:32px 8px">
          <div style="font-size:44px;line-height:1;color:#b42318" aria-hidden="true">\u26A0</div>
          <div style="font-size:28px;font-weight:900;letter-spacing:.08em;color:#b42318">NO DATA</div>
          <div style="font-size:17px;font-weight:800;letter-spacing:.05em;color:#334155;text-transform:uppercase;line-height:1.35">${escapeHtml(m.reason || "Check the Excel sheet")}</div>
        </div>
      </div>`;
  }
  function renderFooterAlert(departments) {
    departments = departments.filter((d) => !isDeptDown(d));
    let highestAlert = null;
    let criticalCount = 0;
    // Worst department first: highest level, then most people missing, then lowest pace.
    const badness = (a) => [a.level, a.missing || 0, -(a.pacePct === null || a.pacePct === undefined ? 999 : a.pacePct)];
    const worse = (a, b) => { const x = badness(a), y = badness(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    departments.forEach((d) => {
      const engine = new AlertEngine(d, 0);
      const diagnosis = engine.diagnose();
      if (diagnosis.level >= 4) criticalCount++;
      const cand = { ...diagnosis, deptName: d.name, pacePct: engine.uplhPace ? engine.uplhPace.pct : null };
      if (!highestAlert || worse(cand, highestAlert)) highestAlert = cand;
    });
    let alertText = '<svg class="w-5 h-5 text-green-500" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg> PLANT OPERATING NORMALLY';
    let bg = "bg-green-100", color = "text-green-800 border border-green-200";
    if (highestAlert && highestAlert.level > 1) {
      if (highestAlert.level >= 4) {
        bg = "bg-red-600";
        color = "text-white shadow-lg border-transparent";
        alertText = `<svg class="w-5 h-5 animate-pulse" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      ${criticalCount} DEPT(S) REQUIRE IMMEDIATE ACTION \xB7 TOP PRIORITY: ${escapeHtml(highestAlert.deptName)} - ${escapeHtml(highestAlert.title)}`;
      } else {
        bg = "bg-orange-500";
        color = "text-white shadow-md border-transparent";
        alertText = `\u26A0 ATTENTION REQUIRED: ${escapeHtml(highestAlert.deptName)} \xB7 ${escapeHtml(highestAlert.title)} \xB7 ${escapeHtml(highestAlert.message)}`;
      }
    }
    const el = document.getElementById("footer-alert-badge");
    el.className = `px-5 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase flex items-center gap-3 transition-all duration-500 ${bg} ${color}`;
    el.innerHTML = alertText;
  }

  // src/js/dateUtils.js
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function toISO(y, m, d) {
    return y + "-" + pad2(m) + "-" + pad2(d);
  }
  function parseSheetDateISO(sheetName) {
    const m = SHEET_DATE_RE.exec(sheetName);
    if (!m) return null;
    const month = parseInt(m[1], 10), day = parseInt(m[2], 10), year = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return toISO(year, month, day);
  }
  function isoToUTCDate(iso) {
    const parts = iso.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }
  // SheetJS builds date cells at the browser's local midnight (plus any time of day), so the
  // calendar day is read with local getters: UTC ones moved "10/6 11:45 PM" to 10/7.
  function excelDateCellToISO(value) {
    return toISO(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  function weekdayIndex(iso) {
    return (isoToUTCDate(iso).getUTCDay() + 6) % 7;
  }
  function weekMondayISO(iso) {
    const d = isoToUTCDate(iso);
    d.setUTCDate(d.getUTCDate() - weekdayIndex(iso));
    return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  function compareISO(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  /**
   * The day a cell stands for, e.g. the "8/5/26" that heads each day-block.
   * Excel's own formatted text is preferred over the date object, which can slip a
   * day depending on the machine's timezone.
   */
  function cellDayISO(cell) {
    if (!cell || cell.v === void 0 || cell.v === null) return null;
    const text = String(cell.w !== void 0 ? cell.w : cell.v instanceof Date ? "" : cell.v).trim();
    const m = CELL_DATE_RE.exec(text);
    if (m) {
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2e3;
      const month = parseInt(m[1], 10), day = parseInt(m[2], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return toISO(year, month, day);
    }
    if (cell.v instanceof Date) return excelDateCellToISO(cell.v);
    return null;
  }
  function addDaysISO(iso, days) {
    const d = isoToUTCDate(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  // src/js/xlsxHelpers.js
  function getCell(sheet, addr) {
    return sheet[addr];
  }
  function cellIsError(cell) {
    return !!cell && cell.t === "e";
  }
  function getRawText(cell) {
    if (!cell) return "";
    return cell.w ? String(cell.w) : String(cell.v || "");
  }
  function cellText(cell) {
    if (!cell || cellIsError(cell)) return null;
    if (cell.v === void 0 || cell.v === null) return null;
    if (cell.v instanceof Date) return null;
    return String(cell.v);
  }
  /** People present: a number, or "4/5" read as 4. Blank or text stays null ("--"). */
  function cellHeadcount(cell, warnings, context) {
    const raw = getRawText(cell).trim();
    const frac = /^(\d+)\s*\/\s*\d+$/.exec(raw);
    if (frac) return Number(frac[1]);
    return cellNumber(cell, warnings, context);
  }
  function cellNumber(cell, warnings, context) {
    if (!cell || cell.v === void 0 || cell.v === null) return null;
    if (cellIsError(cell)) {
      const errText = cell.w || "formula error";
      if (warnings) warnings.push("Formula error " + errText + " treated as missing data - " + context);
      return null;
    }
    if (typeof cell.v === "number") return cell.v;
    if (typeof cell.v === "string") {
      const s = cell.v.trim();
      if (s === "") return null;
      if (ERROR_STRINGS.has(s)) {
        if (warnings) warnings.push("Formula error " + s + " treated as missing data - " + context);
        return null;
      }
      const n = Number(s);
      if (!Number.isNaN(n)) return n;
      // Numbers typed as text: "1,250", "$1,200", "85%".
      const cleaned = s.replace(/[\s\u00A0$,]/g, "");
      const pct = /^(-?\d*\.?\d+)%$/.exec(cleaned);
      if (pct) return parseFloat(pct[1]) / 100;
      if (/^-?\d*\.?\d+$/.test(cleaned)) return parseFloat(cleaned);
      if (warnings) warnings.push('Expected a number but found text "' + cell.v + '" - ' + context);
      return null;
    }
    return null;
  }
  function cellDateISO(cell) {
    if (!cell || cell.v === void 0 || cell.v === null) return null;
    if (cell.v instanceof Date) return excelDateCellToISO(cell.v);
    return null;
  }
  function colOffset(letter, offset) {
    if (typeof XLSX === "undefined") return letter;
    return XLSX.utils.encode_col(XLSX.utils.decode_col(letter) + offset);
  }
  /**
   * Address of the value next to a label: scans rows fromRow..toRow, columns A..lastCol,
   * for a text cell matching labelRe and returns the first non-empty cell up to 3 columns
   * to its right (a text cell there is another label, so it stops). null when not found.
   */
  function findLabeledValue(sheet, labelRe, fromRow, toRow, lastCol) {
    const last = XLSX.utils.decode_col(lastCol || "Z");
    for (let r = fromRow; r <= toRow; r++) {
      for (let c = 0; c <= last; c++) {
        const t = getRawText(getCell(sheet, XLSX.utils.encode_col(c) + r)).trim();
        if (!t || !labelRe.test(t)) continue;
        for (let k = 1; k <= 3; k++) {
          const addr = XLSX.utils.encode_col(c + k) + r;
          const cell = getCell(sheet, addr);
          if (!cell || cell.v === void 0 || cell.v === null || cell.v === "") continue;
          if (typeof cell.v === "string" && /[A-Za-z]/.test(cell.v) && !ERROR_STRINGS.has(cell.v.trim()) && !/^\s*\d+\s*\/\s*\d+\s*$/.test(cell.v)) break;
          return addr;
        }
      }
    }
    return null;
  }
  function expectHeaderNear(sheet, addr, expectedSubstrings, warnings, context) {
    const header = getRawText(getCell(sheet, addr)).toLowerCase().trim();
    const expected = Array.isArray(expectedSubstrings) ? expectedSubstrings : [expectedSubstrings];
    if (!header) {
      warnings.push('Expected header near "' + expected.join("/") + '" at ' + addr + " but the cell is empty - " + context + ". Sheet layout may have changed.");
      return false;
    }
    const matches = expected.some((s) => header.includes(s.toLowerCase()));
    if (!matches) {
      warnings.push('Expected header near "' + expected.join("/") + '" at ' + addr + ' but found "' + getRawText(getCell(sheet, addr)) + '" - ' + context + ". Sheet layout may have changed - check columns weren't inserted/reordered.");
    }
    return matches;
  }

  // src/js/blocks.js
  /**
   * A weekly sheet lays each day out as a block of columns side by side, with the
   * day's date sitting under a label ("UPLH Goal - 4.67", "DATE"). Finding the block
   * by reading that date beats counting columns: FAB's blocks are 5 columns apart but
   * WELDING's first block is 6 wide, and either could change again.
   */
  function findDateBlocks(sheet, labelRe) {
    if (!sheet || typeof XLSX === "undefined") return [];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const blocks = [];
    const lastRow = Math.min(range.e.r, range.s.r + 24);
    const lastCol = Math.min(range.e.c, range.s.c + 60);
    for (let r = range.s.r; r <= lastRow; r++) {
      for (let c = range.s.c; c <= lastCol; c++) {
        const iso = cellDayISO(getCell(sheet, XLSX.utils.encode_cell({ r, c })));
        if (!iso) continue;
        if (r === range.s.r) continue;
        const label = getRawText(getCell(sheet, XLSX.utils.encode_cell({ r: r - 1, c })));
        if (!labelRe.test(label.trim())) continue;
        blocks.push({ iso, col: XLSX.utils.encode_col(c), labelRow: r, valueRow: r + 1 });
      }
    }
    return blocks;
  }
  /**
   * Forecast/actual for one day-block. Uses the sheet's own DAILY row when it has one,
   * otherwise adds up the part rows — these workbooks list parts and no total row.
   */
  function readBlockTotals(sheet, block, range, opts, warnings) {
    let forecast = null, actual = null, sawDaily = false;
    let computedForecast = 0, computedActual = 0, rows = 0;
    const shortages = [];
    const fabIssueMap = new Map();
    const firstDataRow = block.valueRow + 2;
    for (let rowNum = firstDataRow; rowNum <= range.e.r + 1; rowNum++) {
      const partName = cellText(getCell(sheet, colOffset(block.col, 0) + rowNum));
      const forecastCell = getCell(sheet, colOffset(block.col, 1) + rowNum);
      const actualCell = getCell(sheet, colOffset(block.col, 2) + rowNum);
      const deltaOrStatusCell = getCell(sheet, colOffset(block.col, 3) + rowNum);
      const attainmentOrStatusCell = getCell(sheet, colOffset(block.col, 4) + rowNum);
      if (partName && partName.trim().toUpperCase() === "DAILY") {
        sawDaily = true;
        forecast = cellNumber(forecastCell, warnings, opts.name + " DAILY forecast");
        actual = cellNumber(actualCell, warnings, opts.name + " DAILY actual");
        break;
      }
      if (partName && partName.trim() !== "") {
        const partLabel = partName.trim();
        const partUpper = partLabel.toUpperCase();
        const forecastN = cellNumber(forecastCell, null, "");
        const actualN = cellNumber(actualCell, null, "");
        const actualRaw = getRawText(actualCell).trim();
        if (opts.id === "fab" && forecastN !== null && actualN === null && actualRaw && !cellIsError(actualCell)) {
          const normalizedIssue = actualRaw.replace(/\s+/g, " ").trim();
          if (!/^(?:-|—|n\/?a|na)$/i.test(normalizedIssue)) {
            const issueKey = normalizedIssue.toUpperCase();
            const issue = fabIssueMap.get(issueKey) || { message: normalizedIssue, parts: [] };
            if (issue.parts.indexOf(partLabel) === -1) issue.parts.push(partLabel);
            fabIssueMap.set(issueKey, issue);
          }
        }
        // TOTAL / SUBTOTAL / SCRAP rows are not parts: adding them would double the day.
        if (forecastN !== null && !/^(SUB\s*)?TOTAL|^SCRAP/.test(partUpper)) {
          computedForecast += forecastN;
          computedActual += actualN !== null ? actualN : 0;
          rows++;
        }
        const textToSearch = [forecastCell, actualCell, deltaOrStatusCell, attainmentOrStatusCell]
          .map((cell) => getRawText(cell))
          .join(" ")
          .toLowerCase();
        if (textToSearch.includes("material") && !partUpper.startsWith("SCRAP") && !partUpper.includes("TOTAL")) {
          if (shortages.indexOf(partLabel) === -1) shortages.push(partLabel);
        }
      }
    }
    if ((forecast === null || actual === null) && computedForecast > 0) {
      if (sawDaily && warnings) warnings.push(opts.name + ": the DAILY row did not hold usable numbers - totalled the part rows instead.");
      forecast = computedForecast;
      actual = computedActual;
    }
    return { forecast, actual, shortages, rows, issues: Array.from(fabIssueMap.values()) };
  }
  function blockForDate(blocks, dateISO) {
    return blocks.find((b) => b.iso === dateISO) || null;
  }
  /** Blocks from Monday through the selected day, in order — used for the week bar. */
  function blocksThroughDate(blocks, selectedDateISO) {
    const monday = weekMondayISO(selectedDateISO);
    return blocks
      .filter((b) => compareISO(b.iso, monday) >= 0 && compareISO(b.iso, selectedDateISO) <= 0)
      .sort((a, b) => compareISO(a.iso, b.iso));
  }

  // src/js/extractors/fab.js
  function detectFabWorkers(sheet) {
    if (typeof XLSX === "undefined") return null;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const safeRaw = (r, c) => {
      if (r < range.s.r || r > range.e.r || c < range.s.c || c > range.e.c) return "";
      return getRawText(getCell(sheet, XLSX.utils.encode_cell({ r, c })));
    };
    for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const header = safeRaw(r, c).toLowerCase().trim();
        if (header.includes("employe") || header.includes("worker") || header.includes("personnel")) {
          for (let rr = r + 1; rr <= range.e.r; rr++) {
            const cellVal = safeRaw(rr, c).trim();
            if (cellVal) {
              const mRatio = cellVal.match(/(\d+)\s*\/\s*(\d+)/);
              if (mRatio) return { active: parseInt(mRatio[1], 10), total: EXPECTED_HEADCOUNT.fab };
              const mNum = cellVal.match(/(\d+)/);
              if (mNum) return { active: parseInt(mNum[1], 10), total: EXPECTED_HEADCOUNT.fab };
            }
          }
        }
      }
    }
    return null;
  }
  // New format = dated day-blocks headed "UPLH Goal ...", found anywhere on the sheet, so a
  // title row added above them doesn't silently switch to the old single-block reader.
  function isNewBlockFormat(sheet) {
    const a1 = getRawText(getCell(sheet, "A1")).toLowerCase();
    return a1.includes("uplh goal") || findDateBlocks(sheet, /uplh\s*goal/i).length > 0;
  }
  function buildNewBlockFormat(sheet, selectedDateISO, warnings, opts) {
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    let weekday = Math.min(4, weekdayIndex(selectedDateISO));
    // Locate the day by the date printed in the block instead of counting columns:
    // FAB's blocks sit 5 columns apart, WELDING's first one is 6 wide.
    const dateBlocks = findDateBlocks(sheet, /uplh\s*goal/i);
    let block = blockForDate(dateBlocks, selectedDateISO);
    if (!block && dateBlocks.length) {
      // Showing yesterday's block as today would be wrong on the TV with no hint, so the
      // card reports the missing day instead.
      warnings.push(opts.name + ": no block dated " + selectedDateISO + " on this sheet.");
      return null;
    }
    if (!block) {
      // Guessing fixed columns could put another day's numbers on today's card with
      // nothing on the TV to say so, so the card is NO DATA with the reason instead.
      warnings.push(opts.name + ": no block dated " + selectedDateISO + " on this sheet (no dated day-blocks found - check the dates under UPLH Goal).");
      return null;
    }
    const blockStart = block.col;
    const labelRow = String(block.labelRow);
    const valueRow = String(block.valueRow);
    expectHeaderNear(sheet, blockStart + labelRow, ["uplh goal"], warnings, opts.name + " UPLH goal header");
    expectHeaderNear(sheet, colOffset(blockStart, 1) + labelRow, ["operator", "welder", "employe", "present"], warnings, opts.name + " headcount header");
    const present = cellHeadcount(getCell(sheet, colOffset(blockStart, 1) + valueRow), warnings, opts.name + " headcount");
    const attainmentRaw = cellNumber(getCell(sheet, colOffset(blockStart, 2) + valueRow), warnings, opts.name + " scheduled adherence");
    const uplh = cellNumber(getCell(sheet, colOffset(blockStart, 3) + valueRow), warnings, opts.name + " UPLH");
    const headerText = cellText(getCell(sheet, blockStart + labelRow)) || "";
    const uplhGoal = parseUplhGoalText(headerText);
    if (uplhGoal === null) warnings.push(opts.name + ': could not read the UPLH goal from "' + headerText + '".');
    const totals = readBlockTotals(sheet, block, range, opts, warnings);
    let forecast = totals.forecast, actual = totals.actual;
    const materialShortageParts = totals.shortages;
    const notes = [];
    if (opts.id === "fab") {
      const issueLines = (totals.issues || []).map((issue) => issue.message + (issue.parts.length ? " — " + issue.parts.join(" · ") : ""));
      const shortageOnly = materialShortageParts.filter((part) => !(totals.issues || []).some((issue) => issue.parts.indexOf(part) !== -1));
      if (shortageOnly.length) issueLines.push("MATERIAL — " + shortageOnly.join(" · "));
      if (issueLines.length) notes.push({ type: "warning", label: "DOWNTIME / ISSUES", content: issueLines.join(" | "), customColor: "#D97706" });
    } else if (opts.id === "welding" && materialShortageParts.length) {
      notes.push({ type: "warning", label: "MATERIAL / ISSUES", content: materialShortageParts.join(" · "), customColor: "#D97706" });
    }
    const expected = opts.expected;
    let attainmentPct;
    if (forecast !== null && forecast > 0 && actual !== null) {
      attainmentPct = Math.round(actual / forecast * 100);
    } else {
      attainmentPct = Math.round((attainmentRaw || 0) * 100);
      warnings.push(opts.name + ": DAILY actual/forecast row not found - attainment falls back to the sheet's scheduled adherence cell.");
    }
    const stats = [
      { label: "ACTUAL", value: actual !== null ? actual : "N/A", tone: "default" },
      { label: "FORECAST", value: forecast !== null ? forecast : "N/A", tone: "default" },
      { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
      { label: "UPLH GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" }
    ];
    // Operational downtime/material issues stay in the bottom notes area.
    // Week bar: add up Monday through the selected day from the blocks themselves,
    // since these sheets carry no weekly DAILY row.
    let weekAttainment = null;
    if (dateBlocks.length) {
      let weekForecast = 0, weekActual = 0;
      for (const dayBlock of blocksThroughDate(dateBlocks, selectedDateISO)) {
        const dayTotals = dayBlock.col === block.col ? { forecast, actual } : readBlockTotals(sheet, dayBlock, range, opts, null);
        if (dayTotals.forecast !== null && dayTotals.forecast > 0) {
          weekForecast += dayTotals.forecast;
          weekActual += dayTotals.actual !== null ? dayTotals.actual : 0;
        }
      }
      if (weekForecast > 0) weekAttainment = Math.round(weekActual / weekForecast * 100);
    } else {
      // Only reachable for FAB: every other department returns above when no dated
      // block was found, so these fixed columns are always FAB's own.
      weekAttainment = weekAttainmentFromBlocks(sheet, FAB_BLOCK_STARTS, weekday, range);
    }
    const dept = {
      id: opts.id,
      name: opts.name,
      status: statusFromAttainment(attainmentPct),
      meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
      attainment: attainmentPct,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment,
      headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
      stats,
      notes: notes.length ? notes : void 0
    };
    return { dept, workers: { active: present, total: expected, down: present === 0 } };
  }
  function buildFabLegacy(sheet, sheetName, selectedDateISO, warnings) {
    const weekStart = weekMondayISO(selectedDateISO);
    const weekEnd = addDaysISO(weekStart, 6);
    if (typeof XLSX === "undefined") return null;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const workers = detectFabWorkers(sheet) || void 0;
    if (!workers) {
      warnings.push('FAB: no "Employees/Workers/Personnel" header found in the first 10 rows - headcount defaulted to 0/' + EXPECTED_HEADCOUNT.fab + ".");
    }
    let jobsDone = 0, totalActive = 0, workingJobs = 0, doneQty = 0, totalQty = 0;
    const seen = /* @__PURE__ */ new Set();
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const statusText = cellText(getCell(sheet, "A" + rowNum));
      const statusNorm = statusText ? statusText.trim().toUpperCase() : "";
      const completionISO = cellDateISO(getCell(sheet, "C" + rowNum));
      const partText = cellText(getCell(sheet, "B" + rowNum)) || "";
      const qty = cellNumber(getCell(sheet, "D" + rowNum), warnings, "FAB " + sheetName + " row " + rowNum + " QTY");
      if (partText.toUpperCase().includes("TOTAL") || statusNorm.includes("TOTAL")) continue;
      if (completionISO && completionISO >= weekStart && completionISO <= weekEnd) {
        const sig = partText + "|" + completionISO + "|" + statusNorm + "|" + (qty === null ? "" : qty);
        if (!seen.has(sig)) {
          seen.add(sig);
          totalActive += 1;
          if (qty !== null) {
            totalQty += qty;
            if (statusNorm === "DONE") doneQty += qty;
          }
          if (statusNorm === "DONE") jobsDone += 1;
          else if (statusNorm === "WORKING") workingJobs += 1;
        }
      }
      const tankPart = cellText(getCell(sheet, "I" + rowNum));
      const tankQty = cellNumber(getCell(sheet, "J" + rowNum), [], "");
      const tankDateISO = cellDateISO(getCell(sheet, "K" + rowNum));
      const tankStatusText = cellText(getCell(sheet, "L" + rowNum));
      const tankStatusNorm = tankStatusText ? tankStatusText.trim().toUpperCase() : "";
      if (tankDateISO && tankDateISO >= weekStart && tankDateISO <= weekEnd) {
        if (tankPart && (tankPart.toUpperCase().includes("TOTAL") || tankStatusNorm.includes("TOTAL"))) continue;
        const sigTank = "TANK|" + (tankPart || "") + "|" + tankDateISO + "|" + tankStatusNorm + "|" + (tankQty === null ? "" : tankQty);
        if (!seen.has(sigTank)) {
          seen.add(sigTank);
          if (tankQty !== null) {
            totalQty += tankQty;
            if (tankStatusNorm === "DONE") doneQty += tankQty;
          }
        }
      }
    }
    const attainment = totalQty > 0 ? Math.round(doneQty / totalQty * 100) : 0;
    const stats = [
      { label: "DONE QTY", value: doneQty, tone: "green" },
      { label: "TOTAL QTY", value: totalQty, tone: "default" },
      { label: "DONE JOBS", value: jobsDone + "/" + totalActive, tone: "default" },
      { label: "WORKING", value: workingJobs, tone: "yellow" }
    ];
    const headline = workers ? { icon: "\u{1F464}", active: workers.active, total: workers.total, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: workers.down === true || (workers.down === void 0 && workers.active === 0) } : { icon: "\u{1F464}", active: 0, total: EXPECTED_HEADCOUNT.fab, label: "PRESENT / EXPECTED (N/A)", countsAsPersonnel: true };
    const dept = {
      id: "fab",
      name: "FAB",
      status: statusFromAttainment(attainment),
      meta: "JOBS + TANK BASES",
      attainment,
      attainmentLabel: "WEEK ATTAINMENT",
      headline,
      stats,
      legacyFab: true
    };
    return { dept, workers: workers || void 0 };
  }
  function buildFab(wb, selectedDateISO, warnings) {
    const sheetName = selectWeeklySheet(wb, "fab", selectedDateISO, warnings, "FAB");
    if (!sheetName) return null;
    return buildFabFromSheet(wb.Sheets[sheetName], sheetName, selectedDateISO, warnings);
  }
  function buildFabFromSheet(sheet, sheetName, selectedDateISO, warnings) {
    if (!sheet || typeof XLSX === "undefined") return null;
    if (isNewBlockFormat(sheet)) {
      return buildNewBlockFormat(sheet, selectedDateISO, warnings, { id: "fab", name: "FAB", expected: EXPECTED_HEADCOUNT.fab });
    }
    return buildFabLegacy(sheet, sheetName, selectedDateISO, warnings);
  }

  // src/js/extractors/welding.js
  function buildWelding(wb, selectedDateISO, warnings) {
    const sheetName = selectWeeklySheet(wb, "weld", selectedDateISO, warnings, "WELDING");
    if (!sheetName) return null;
    return buildWeldingFromSheet(wb.Sheets[sheetName], selectedDateISO, warnings);
  }
  function buildWeldingFromSheet(sheet, selectedDateISO, warnings) {
    if (!sheet || typeof XLSX === "undefined") return null;
    if (isNewBlockFormat(sheet)) {
      const result = buildNewBlockFormat(sheet, selectedDateISO, warnings, { id: "welding", name: "WELDING", expected: EXPECTED_HEADCOUNT.welding });
      return result ? result.dept : null;
    }
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    let weekday = weekdayIndex(selectedDateISO);
    if (weekday > 4) {
      warnings.push("WELDING: selected date falls on a weekend - showing Monday's block instead.");
      weekday = 0;
    }
    const blockStart = WELD_BLOCK_STARTS[weekday];
    expectHeaderNear(sheet, colOffset(blockStart, 1) + "1", ["welder", "employe", "present"], warnings, "WELDING headcount header");
    const present = cellHeadcount(getCell(sheet, colOffset(blockStart, 1) + "2"), warnings, "WELDING welders");
    const attainmentRaw = cellNumber(getCell(sheet, colOffset(blockStart, 2) + "2"), warnings, "WELDING attainment");
    const uplh = cellNumber(getCell(sheet, colOffset(blockStart, 3) + "2"), warnings, "WELDING UPLH");
    const headerText = cellText(getCell(sheet, colOffset(blockStart, 3) + "1")) || "";
    const uplhGoal = parseUplhGoalText(headerText);
    let forecast = null, actual = null;
    const materialShortageParts = [];
    for (let r = range.s.r + 3; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const labelA = cellText(getCell(sheet, "A" + rowNum));
      if (labelA && labelA.trim().toUpperCase() === "DAILY") {
        forecast = cellNumber(getCell(sheet, colOffset(blockStart, 1) + rowNum));
        actual = cellNumber(getCell(sheet, colOffset(blockStart, 2) + rowNum));
      }
      const partName = cellText(getCell(sheet, colOffset(blockStart, 0) + rowNum));
      const actualText = cellText(getCell(sheet, colOffset(blockStart, 2) + rowNum)) || "";
      const forecastText = cellText(getCell(sheet, colOffset(blockStart, 1) + rowNum)) || "";
      const statusText = cellText(getCell(sheet, colOffset(blockStart, 3) + rowNum)) || "";
      const textToSearch = (actualText + " " + forecastText + " " + statusText).toLowerCase();
      if (partName && textToSearch.includes("material") && !partName.toUpperCase().startsWith("SCRAP")) {
        const p = partName.trim();
        if (!materialShortageParts.includes(p)) materialShortageParts.push(p);
      }
    }
    const expected = EXPECTED_HEADCOUNT.welding;
    let attainmentPct;
    if (forecast !== null && forecast > 0 && actual !== null) {
      attainmentPct = Math.round(actual / forecast * 100);
    } else {
      attainmentPct = Math.round((attainmentRaw || 0) * 100);
      warnings.push("WELDING: DAILY actual/forecast row not found - attainment falls back to the sheet's UPLH-based attainment cell.");
    }
    const stats = [
      { label: "ACTUAL", value: actual !== null ? actual : "N/A", tone: "default" },
      { label: "FORECAST", value: forecast !== null ? forecast : "N/A", tone: "default" },
      { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
      { label: "UPLH GOAL", value: uplhGoal, tone: "default" }
    ];
    const notes = materialShortageParts.length > 0
      ? [{ type: "warning", label: "MATERIAL / ISSUES", content: materialShortageParts.join(" · "), customColor: "#D97706" }]
      : [];
    const weekAttainment = weekAttainmentFromBlocks(sheet, WELD_BLOCK_STARTS, weekday, range);
    return {
      id: "welding",
      name: "WELDING",
      status: statusFromAttainment(attainmentPct),
      meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
      attainment: attainmentPct,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment,
      headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
      stats,
      notes: notes.length ? notes : void 0
    };
  }

  // src/js/extractors/paint.js
  function paintDayTotals(sheet) {
    if (!sheet || typeof XLSX === "undefined") return null;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    let totalsRow = null;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const cellE = getCell(sheet, "E" + rowNum);
      if (cellE && cellE.v !== void 0 && cellE.v !== null && cellE.v !== "") totalsRow = rowNum;
    }
    if (!totalsRow) return null;
    const scheduled = cellNumber(getCell(sheet, "B" + totalsRow), [], "");
    const produced = cellNumber(getCell(sheet, "Q" + totalsRow), [], "");
    return { scheduled, produced };
  }
  /** Week bar for paint when each day is its own tab in the paint workbook. */
  function paintWeekFromSheets(sheetsByISO, selectedDateISO) {
    const monday = weekMondayISO(selectedDateISO);
    let sumSched = 0, sumProd = 0, days = 0;
    for (let d = 0; d <= weekdayIndex(selectedDateISO) && d < 5; d++) {
      const dayISO = addDaysISO(monday, d);
      if (compareISO(dayISO, selectedDateISO) > 0) break;
      const totals = paintDayTotals(sheetsByISO[dayISO]);
      if (totals && totals.scheduled !== null && totals.scheduled > 0) {
        sumSched += totals.scheduled;
        sumProd += totals.produced !== null ? totals.produced : 0;
        days++;
      }
    }
    if (days === 0 || sumSched <= 0) return null;
    return Math.round(sumProd / sumSched * 100);
  }
  function paintWeekAttainment(wb, selectedDateISO) {
    const monday = weekMondayISO(selectedDateISO);
    const sheets = findSheetsForDept(wb, "paint");
    let sumSched = 0, sumProd = 0, days = 0;
    for (let d = 0; d <= weekdayIndex(selectedDateISO) && d < 5; d++) {
      const dayISO = addDaysISO(monday, d);
      if (compareISO(dayISO, selectedDateISO) > 0) break;
      const match = sheets.find((s) => s.dateISO === dayISO);
      if (!match) continue;
      const totals = paintDayTotals(wb.Sheets[match.name]);
      if (totals && totals.scheduled !== null && totals.scheduled > 0) {
        sumSched += totals.scheduled;
        sumProd += totals.produced !== null ? totals.produced : 0;
        days++;
      }
    }
    if (days === 0 || sumSched <= 0) return null;
    return Math.round(sumProd / sumSched * 100);
  }
  function buildPaint(wb, selectedDateISO, warnings) {
    const sheetName = selectPaintSheet(wb, selectedDateISO, warnings);
    if (!sheetName) return null;
    return buildPaintFromSheet(wb.Sheets[sheetName], paintWeekAttainment(wb, selectedDateISO), selectedDateISO, warnings);
  }
  // The color in the booth is the one where painted pieces (column Q) were entered
  // last: when numbers start going into another color, the line has changed color.
  // The source remembers each color's painted total between reads of the sheet, so a
  // color whose total went up becomes the current one wherever it sits on the sheet.
  // With nothing to compare yet (first read after a reload) it takes the lowest color
  // on the sheet that has painted pieces, then the top color if none has started.
  var paintColorMemory = { date: null, done: {}, current: null };
  function pickPaintColor(dateISO, sections) {
    const mem = paintColorMemory;
    if (mem.date !== dateISO) { mem.date = dateISO; mem.done = {}; mem.current = null; }
    const top = sections[0].name;
    // A color listed twice on the sheet counts as one, placed at its lowest listing.
    const merged = [];
    for (const s of sections) {
      const i = merged.findIndex((m) => m.name === s.name);
      const prev = i === -1 ? 0 : merged.splice(i, 1)[0].done;
      merged.push({ name: s.name, done: prev + s.done });
    }
    sections = merged;
    const firstRead = Object.keys(mem.done).length === 0;
    const grew = firstRead ? [] : sections.filter((s) => s.done > (mem.done[s.name] || 0));
    const started = sections.filter((s) => s.done > 0);
    let current;
    if (grew.length) current = grew[grew.length - 1].name;
    else if (mem.current && sections.some((s) => s.name === mem.current && s.done > 0)) current = mem.current;
    else if (started.length) current = started[started.length - 1].name;
    else current = top;
    mem.done = {};
    for (const s of sections) mem.done[s.name] = s.done;
    mem.current = current;
    return current;
  }
  function buildPaintFromSheet(sheet, weekAttainmentPct, selectedDateISO, warnings) {
    if (!sheet || typeof XLSX === "undefined") return null;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    // The header values are found by their labels on the top rows, so an inserted column
    // doesn't shift them; G1/I1/K1/O1 are the fallback when a label isn't there.
    const headerAddr = (re, fallback, what) => {
      const addr = findLabeledValue(sheet, re, 1, 3, "Z");
      if (!addr) warnings.push("PAINT: " + what + " label not found - using " + fallback + ".");
      return addr || fallback;
    };
    const presentAddr = headerAddr(/employe|present|worker/i, "G1", "EMPLOYEES");
    const goalAddr = headerAddr(/uplh\s*goal|goal\s*uplh/i, "I1", "UPLH GOAL");
    const uplhAddr = headerAddr(/^(?:daily\s*)?uplh\b(?!.*goal)/i, "K1", "UPLH");
    const pctAddr = findLabeledValue(sheet, /(?:%|pct|percent)\s*(?:to\s*)?goal/i, 1, 3, "Z") || "O1";
    const present = cellHeadcount(getCell(sheet, presentAddr), warnings, "PAINT employees");
    const uplhGoal = cellNumber(getCell(sheet, goalAddr), warnings, "PAINT UPLH goal");
    const uplh = cellNumber(getCell(sheet, uplhAddr), warnings, "PAINT daily UPLH");
    const pctToGoal = cellNumber(getCell(sheet, pctAddr), warnings, "PAINT pct to goal");
    let totalsRow = null;
    let scheduled = null, actual = null, productionPct = null;
    // The totals row is the one labelled TOTAL in column A; "the last row with anything in
    // column E" is only the fallback, since a note typed below the totals would win it.
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      if (/^total\b/i.test((cellText(getCell(sheet, "A" + rowNum)) || "").trim()) && (cellNumber(getCell(sheet, "B" + rowNum), null, "") !== null || cellNumber(getCell(sheet, "Q" + rowNum), null, "") !== null)) totalsRow = rowNum;
    }
    if (!totalsRow) for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const cellE = getCell(sheet, "E" + rowNum);
      if (cellE && cellE.v !== void 0 && cellE.v !== null && cellE.v !== "") {
        totalsRow = rowNum;
      }
    }
    if (totalsRow) {
      scheduled = cellNumber(getCell(sheet, "B" + totalsRow), warnings, "PAINT scheduled total");
      actual = cellNumber(getCell(sheet, "Q" + totalsRow), warnings, "PAINT produced total");
      productionPct = cellNumber(getCell(sheet, "R" + totalsRow), warnings, "PAINT production pct");
    } else {
      warnings.push("PAINT: could not find a totals row (column E never populated) - scheduled/produced totals unavailable.");
    }
    // DAILY ATT. = painted / scheduled, like every other card.
    let attainmentPct = 0;
    if (scheduled > 0 && actual !== null) attainmentPct = Math.round(actual / scheduled * 100);
    else if (productionPct !== null) attainmentPct = Math.round(productionPct * 100);
    else if (pctToGoal !== null) {
      attainmentPct = Math.round(pctToGoal * 100);
      warnings.push("PAINT: no painted/scheduled totals - DAILY ATT. uses the sheet's % to goal.");
    }
    const NON_COLOR_LABELS = /* @__PURE__ */ new Set(["DOWNTIME", "DOWNTIME:", "SCRAP", "SCRAP:", "REASON", "REASON:", "TOTAL", "TOTAL:"]);
    const sectionScanLimit = totalsRow || range.e.r + 1;
    const sectionStarts = [];
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      if (rowNum >= sectionScanLimit) break;
      const aText = cellText(getCell(sheet, "A" + rowNum));
      const bCell = getCell(sheet, "B" + rowNum);
      const bEmpty = !bCell || bCell.v === void 0 || bCell.v === null;
      if (aText && /[A-Z]/.test(aText) && aText.trim() === aText.trim().toUpperCase() && bEmpty && !NON_COLOR_LABELS.has(aText.trim())) {
        const colorName = aText.trim();
        if (PAINT_COLOR_MAP[colorName] || colorName === "GALV.") {
          sectionStarts.push({ row: rowNum, name: colorName });
        }
      }
    }
    let currentColorName = null;
    if (sectionStarts.length > 0) {
      const sectionTotals = sectionStarts.map((section, i) => {
        const start = section.row;
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].row : totalsRow || range.e.r + 1;
        let sectionTotal = 0, sectionSched = 0, sectionDone = 0, hasSched = false;
        for (let rr = start; rr < end; rr++) {
          const qVal = cellNumber(getCell(sheet, "Q" + rr), [], "");
          const fVal = cellNumber(getCell(sheet, "F" + rr), [], "");
          const bVal = cellNumber(getCell(sheet, "B" + rr), [], "");
          if (qVal !== null) sectionTotal += qVal;
          else if (fVal !== null) sectionTotal += fVal;
          if (qVal !== null && qVal > 0) sectionDone += qVal;
          if (bVal !== null && bVal > 0) { hasSched = true; sectionSched += bVal; }
        }
        return { name: section.name, total: sectionTotal, scheduled: sectionSched, done: sectionDone, hasSched };
      });
      currentColorName = pickPaintColor(selectedDateISO, sectionTotals);
    }
    let downtimeMins = 0;
    const downtimeMessages = [];
    let inDowntime = false;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const cellA = cellText(getCell(sheet, "A" + rowNum)) || "";
      const aNorm = cellA.trim().toUpperCase();
      if (aNorm.includes("DOWNTIME")) {
        inDowntime = true;
        continue;
      }
      if (inDowntime) {
        if (aNorm === "SCRAP" || aNorm.startsWith("TOTAL") || aNorm === "SCRAP:") {
          inDowntime = false;
          continue;
        }
        if (aNorm === "" || aNorm === "REASON" || aNorm === "REASON:") continue;
        const fullText = (cellA + " " + (cellText(getCell(sheet, "B" + rowNum)) || "") + " " + (cellText(getCell(sheet, "C" + rowNum)) || "") + " " + (cellText(getCell(sheet, "Q" + rowNum)) || "")).trim();
        // Every range on the row counts: "6:45–7:00", "9:10 - 9:40 and 1:00-1:20", "9:10am to 9:40am".
        const ranges = Array.from(fullText.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:-|\u2013|\u2014|to)\s*(\d{1,2}):(\d{2})\s*(am|pm)?/gi));
        if (ranges.length) {
          const toMin = (h, m, ap) => { h = parseInt(h, 10) % 12; if (ap && /pm/i.test(ap)) h += 12; else if (!ap && h < SHIFT_START_HOUR) h += 12; return h * 60 + parseInt(m, 10); };
          for (const t of ranges) {
            let diff = toMin(t[4], t[5], t[6] || t[3]) - toMin(t[1], t[2], t[3]);
            if (diff < 0) diff += 12 * 60;
            if (diff < 12 * 60) downtimeMins += diff;
          }
          downtimeMessages.push(fullText);
        } else if (fullText.length > 3) {
          downtimeMessages.push(fullText);
        }
      }
    }
    const expected = EXPECTED_HEADCOUNT.paint;
    const currentColor = currentColorName ? PAINT_COLOR_MAP[currentColorName] || { name: currentColorName, hex: "#888888", gradient: "linear-gradient(90deg, #013449, #888888)" } : void 0;
    const stats = [
      { label: "PAINTED", value: actual !== null ? actual : "N/A", tone: "default" },
      { label: "SCHEDULED", value: scheduled !== null ? scheduled : "N/A", tone: "default" },
      { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
      { label: "GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" }
    ];
    const notes = [];
    if (downtimeMessages.length > 0) {
      stats.push({ label: "DOWNTIME", value: downtimeMins > 0 ? downtimeMins + " MINS" : "ACTIVE", tone: downtimeMins > 0 ? "yellow" : "default" });
      notes.push({ type: "warning", label: "DOWNTIME LOG", content: downtimeMessages.join(" \xB7 "), customColor: "#D97706" });
    }
    const weekAttainment = weekAttainmentPct;
    return {
      id: "paint",
      name: "PAINT",
      status: statusFromAttainment(attainmentPct),
      meta: "CURRENT DAY ONLY",
      attainment: attainmentPct,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment,
      headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
      stats,
      notes: notes.length ? notes : void 0,
      currentColor
    };
  }

  // src/js/extractors/tanks.js
  function buildTanks(wb, selectedDateISO, warnings) {
    const sheetName = selectWeeklySheet(wb, "tank", selectedDateISO, warnings, "TANKS");
    if (!sheetName) return null;
    return buildTanksFromSheet(wb.Sheets[sheetName], selectedDateISO, warnings);
  }
  function buildTanksFromSheet(sheet, selectedDateISO, warnings) {
    if (!sheet || typeof XLSX === "undefined") return null;
    // Tanks stacks two rows of day-blocks (Mon-Wed on row 1, Thu-Fri on row 15), so the
    // day is found by its date under the "DATE" label rather than by a fixed map.
    const tankBlocks = findDateBlocks(sheet, /^date:?$/i);
    let tankBlock = blockForDate(tankBlocks, selectedDateISO);
    if (!tankBlock && tankBlocks.length) {
      // Same rule as FAB/WELDING: never show another day's block as today.
      warnings.push("TANKS: no block dated " + selectedDateISO + " on this sheet.");
      return null;
    }
    if (!tankBlock) {
      // Same rule as FAB/WELDING: no guessed columns.
      warnings.push("TANKS: no block dated " + selectedDateISO + " on this sheet (no dated day-blocks found - check the dates under DATE).");
      return null;
    }
    const headerRow = tankBlock.labelRow, colStart = tankBlock.col;
    const valueRow = headerRow + 1;
    // The SCHEDULED PROD. / TOTAL PROD. rows are found by their labels, so an added part
    // row moves them down instead of reading the wrong cells. Fixed offsets are the fallback.
    let scheduledProdRow = headerRow + 10;
    let totalProdRow = headerRow + 11;
    let foundSched = false, foundTotal = false;
    for (let r = headerRow + 3; r <= headerRow + 25; r++) {
      for (let off = 0; off <= 5; off++) {
        const t = getRawText(getCell(sheet, colOffset(colStart, off) + r)).trim();
        if (!foundSched && /^scheduled\s*prod/i.test(t)) { scheduledProdRow = r; foundSched = true; }
        else if (!foundTotal && /^total\s*prod/i.test(t)) { totalProdRow = r; foundTotal = true; }
      }
    }
    if (!foundSched || !foundTotal) warnings.push("TANKS: SCHEDULED PROD. / TOTAL PROD. labels not found - using the default rows.");
    // Header columns by label (EMPLOYEES / ATTAINMENT / UPLH / UPLH GOAL), value on the row
    // below; the usual positions 1-4 are the fallback.
    const headerCol = (re, fallback, what) => {
      for (let off = 0; off <= 7; off++) {
        if (re.test(getRawText(getCell(sheet, colOffset(colStart, off) + headerRow)).trim())) return off;
      }
      warnings.push("TANKS: " + what + " header not found - using the default column.");
      return fallback;
    };
    const presentCol = headerCol(/employe|present|worker/i, 1, "EMPLOYEES");
    const attCol = headerCol(/attain|%\s*(?:to\s*)?(?:goal|sched)/i, 2, "ATTAINMENT");
    const uplhCol = headerCol(/^(?:daily\s*)?uplh\b(?!.*goal)/i, 3, "UPLH");
    const goalCol = headerCol(/uplh\s*goal|goal\s*uplh/i, 4, "UPLH GOAL");
    const present = cellHeadcount(getCell(sheet, colOffset(colStart, presentCol) + valueRow), warnings, "TANKS employee count");
    const attainmentRaw = cellNumber(getCell(sheet, colOffset(colStart, attCol) + valueRow), warnings, "TANKS attainment");
    const uplh = cellNumber(getCell(sheet, colOffset(colStart, uplhCol) + valueRow), warnings, "TANKS UPLH");
    const uplhGoal = cellNumber(getCell(sheet, colOffset(colStart, goalCol) + valueRow), warnings, "TANKS UPLH goal");
    let scheduled = cellNumber(getCell(sheet, colOffset(colStart, 5) + scheduledProdRow), warnings, "TANKS scheduled prod");
    let production = cellNumber(getCell(sheet, colOffset(colStart, 5) + totalProdRow), warnings, "TANKS total prod");
    let calcTankSched = 0;
    let calcTankProd = 0;
    let currentPart = "UNKNOWN";
    for (let r = headerRow + 3; r < Math.min(scheduledProdRow, totalProdRow); r++) {
      const partName = cellText(getCell(sheet, colOffset(colStart, 0) + r));
      if (!partName || partName.trim().toUpperCase().startsWith("SCRAP") || partName.trim().toUpperCase().includes("TOTAL")) continue;
      const sVal = cellNumber(getCell(sheet, colOffset(colStart, 1) + r), [], "");
      const pVal = cellNumber(getCell(sheet, colOffset(colStart, 5) + r), [], "");
      if (sVal) calcTankSched += sVal;
      if (pVal) calcTankProd += pVal;
      if (partName.trim() && currentPart === "UNKNOWN") {
        const s = sVal || 0;
        const p = pVal || 0;
        if (s > 0 && p < s) {
          currentPart = partName.trim();
        }
      }
    }
    if (scheduled === null || scheduled === 0) scheduled = calcTankSched;
    if (production === null || production === 0) production = calcTankProd;
    const weekScheduled = cellNumber(getCell(sheet, "Q15"), warnings, "TANKS week scheduled");
    const weekProduced = cellNumber(getCell(sheet, "Q17"), warnings, "TANKS week produced");
    let weekPct = null;
    if (weekScheduled && weekProduced !== null) {
      weekPct = Math.round(weekProduced / weekScheduled * 100);
    }
    const expected = EXPECTED_HEADCOUNT.tanks;
    // DAILY ATT. means the same on every card: production / scheduled. The sheet's own
    // cell is only the fallback when the totals are missing.
    const attainmentPct = scheduled > 0 && production !== null ? Math.round(production / scheduled * 100) : Math.round((attainmentRaw || 0) * 100);
    if (currentPart === "UNKNOWN" && (scheduled > 0 && production >= scheduled || attainmentPct >= 100)) {
      currentPart = "\u2713 COMPLETE";
    }
    const notes = [];
    const tankIssueTexts = [];
    const tankRange = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    const notesFrom = Math.min(scheduledProdRow, totalProdRow);
    for (let r = notesFrom; r <= Math.min(notesFrom + 3, tankRange.e.r + 1); r++) {
      for (let offset = 0; offset <= 5; offset++) {
        const raw = getRawText(getCell(sheet, colOffset(colStart, offset) + r)).trim();
        if (!raw || /^(?:DOWNTIME|REASON|SCHEDULED PROD\.?|TOTAL PROD\.?):?$/i.test(raw)) continue;
        if (!/[A-Za-z0-9]/.test(raw)) continue;
        if (/^-?\d+(?:\.\d+)?%?$/.test(raw) || ERROR_STRINGS.has(raw.toUpperCase()) || /^#[A-Z\/0!?_]+[!?]?$/.test(raw)) continue;
        if (tankIssueTexts.indexOf(raw) === -1) tankIssueTexts.push(raw);
      }
    }
    if (tankIssueTexts.length) notes.push({ type: "warning", label: "DOWNTIME / REASON", content: tankIssueTexts.join(" · "), customColor: "#D97706" });
    const stats = [
      { label: "PRODUCTION", value: production !== null ? production : "N/A", tone: "default" },
      { label: "SCHEDULED", value: scheduled !== null ? scheduled : "N/A", tone: "default" },
      { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
      { label: "GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" },
      { label: "WORKING ON", value: currentPart, tone: "green" }
    ];
    return {
      id: "tanks",
      name: "TANKS",
      status: statusFromAttainment(attainmentPct),
      meta: "DAILY GRID + LAYERS A B C",
      attainment: attainmentPct,
      attainmentLabel: "DAILY ATTAINMENT",
      weekAttainment: weekPct !== null ? weekPct : void 0,
      headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
      stats,
      notes: notes.length ? notes : void 0
    };
  }

  // src/js/parser.js
  function statusFromAttainment(attainment) {
    if (attainment >= 80) return "on_target";
    if (attainment >= 60) return "at_risk";
    return "critical";
  }
  function weekAttainmentFromBlocks(sheet, blockStarts, uptoWeekday, range) {
    if (!sheet || typeof XLSX === "undefined") return null;
    if (!range) range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
    let dailyRow = null;
    for (let r = range.s.r + 3; r <= range.e.r; r++) {
      const rowNum = r + 1;
      const labelA = cellText(getCell(sheet, "A" + rowNum));
      if (labelA && labelA.trim().toUpperCase() === "DAILY") {
        dailyRow = rowNum;
        break;
      }
    }
    if (dailyRow === null) return null;
    let sumActual = 0, sumForecast = 0, daysCounted = 0;
    for (let d = 0; d <= uptoWeekday && d < blockStarts.length; d++) {
      const bs = blockStarts[d];
      const forecast = cellNumber(getCell(sheet, colOffset(bs, 1) + dailyRow), [], "");
      const actual = cellNumber(getCell(sheet, colOffset(bs, 2) + dailyRow), [], "");
      if (forecast !== null && forecast > 0) {
        sumForecast += forecast;
        sumActual += actual !== null ? actual : 0;
        daysCounted++;
      }
    }
    if (daysCounted === 0 || sumForecast <= 0) return null;
    return Math.round(sumActual / sumForecast * 100);
  }
  function findSheetsForDept(wb, prefix) {
    const out = [];
    for (const name of wb.SheetNames) {
      if (name.trim().toLowerCase().startsWith(prefix)) {
        const dateISO = parseSheetDateISO(name);
        if (dateISO) out.push({ name, dateISO });
      }
    }
    out.sort((a, b) => compareISO(a.dateISO, b.dateISO));
    return out;
  }
  function selectWeeklySheet(wb, prefix, selectedDateISO, warnings, label) {
    const monday = weekMondayISO(selectedDateISO);
    const sheets = findSheetsForDept(wb, prefix);
    const found = sheets.find((s) => s.dateISO === monday);
    if (!found) {
      warnings.push(label + ": no sheet found for week starting " + monday + ".");
      return null;
    }
    return found.name;
  }
  function selectPaintSheet(wb, selectedDateISO, warnings) {
    const sheets = findSheetsForDept(wb, "paint");
    const found = sheets.find((s) => s.dateISO === selectedDateISO);
    if (!found) {
      warnings.push("PAINT: no sheet found with name-date matching " + selectedDateISO + ".");
      return null;
    }
    return found.name;
  }
  /** Which department a file belongs to, read off its name. */
  // Department by the file's own name (not its folder). A name that fits two departments
  // ("Tank Paint Colors.xlsx") or looks like a copy / backup / OneDrive conflict copy
  // belongs to none, so it can't replace the real workbook just by being newer.
  var COPY_FILE_RE = /(^|[\s_-])(copy|backup|bak|old)([\s_.-]|$)|^copy of |\(\d+\)\.\w+$|-(desktop|laptop|pc)-[a-z0-9]+/i;
  var ARCHIVE_DIR_RE = /(^|\/)(archive|archived|old|backup|backups)[^/]*\//i;
  function deptsForFileName(fileName) {
    const path = String(fileName || "");
    const base = path.split("/").pop();
    if (ARCHIVE_DIR_RE.test(path) || COPY_FILE_RE.test(base)) return [];
    return DEPT_SOURCES.filter((d) => d.fileMatch.test(base));
  }
  function deptForFileName(fileName) {
    const hits = deptsForFileName(fileName);
    return hits.length === 1 ? hits[0] : null;
  }
  /**
   * The tab for a day. Tabs are named only with a date ("8.5.2026"), so an exact
   * name match wins over one that merely contains the date ("12.15.2025.1").
   */
  function sheetNameForDate(sheetNames, dateISO) {
    const matches = sheetNames.filter((name) => parseSheetDateISO(name) === dateISO);
    if (matches.length === 0) return null;
    const exact = matches.find((name) => {
      const m = SHEET_DATE_RE.exec(name);
      return m && name.trim() === m[0];
    });
    return exact || matches[0];
  }
  /**
   * Reads one department workbook. Sheet names are listed first and only the needed
   * tabs are parsed — the welding book alone is 2.4 MB across 300+ tabs, so unchanged
   * workbooks are reused between the 10-second checks.
   */
  function readDeptWorkbook(source, buffer, selectedDateISO, warnings) {
    const names = XLSX.read(buffer, { type: "array", bookSheets: true }).SheetNames || [];
    const wantISO = source.cadence === "day" ? selectedDateISO : weekMondayISO(selectedDateISO);
    const wanted = [];
    let mainName = sheetNameForDate(names, wantISO);
    // Weekly tab not named exactly for Monday (holiday Monday, tab dated the Sunday or the
    // first workday): take the latest tab dated from that Sunday up to the selected day.
    if (!mainName && source.cadence === "week") {
      const from = addDaysISO(weekMondayISO(selectedDateISO), -1);
      const near = names.map((n) => ({ n, iso: parseSheetDateISO(n) })).filter((x) => x.iso && compareISO(x.iso, from) >= 0 && compareISO(x.iso, selectedDateISO) <= 0);
      near.sort((a, b) => compareISO(a.iso, b.iso));
      if (near.length) mainName = near[near.length - 1].n;
    }
    if (mainName) wanted.push(mainName);
    // Paint's week bar needs Monday through today, each on its own tab.
    const weekNames = {};
    if (source.cadence === "day") {
      const monday = weekMondayISO(selectedDateISO);
      for (let d = 0; d < 5; d++) {
        const dayISO = addDaysISO(monday, d);
        if (compareISO(dayISO, selectedDateISO) > 0) break;
        const dayName = sheetNameForDate(names, dayISO);
        if (dayName) {
          weekNames[dayISO] = dayName;
          if (wanted.indexOf(dayName) === -1) wanted.push(dayName);
        }
      }
    }
    if (!mainName) {
      const dated = names.filter((n) => parseSheetDateISO(n)).slice(-6).join(", ");
      warnings.push(source.label + ": no tab named " + wantISO + (source.cadence === "week" ? " (the Monday of that week)" : "") + " in " + source.fileName + ". Most recent dated tabs: " + (dated || "none") + ".");
      return null;
    }
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, sheets: wanted });
    const weekSheets = {};
    for (const iso of Object.keys(weekNames)) weekSheets[iso] = wb.Sheets[weekNames[iso]];
    return { sheet: wb.Sheets[mainName], sheetName: mainName, weekSheets };
  }
  function buildDeptFromSheet(source, loaded, selectedDateISO, warnings) {
    if (source.id === "fab") return buildFabFromSheet(loaded.sheet, loaded.sheetName, selectedDateISO, warnings);
    if (source.id === "welding") return buildWeldingFromSheet(loaded.sheet, selectedDateISO, warnings);
    if (source.id === "tanks") return buildTanksFromSheet(loaded.sheet, selectedDateISO, warnings);
    if (source.id === "paint") return buildPaintFromSheet(loaded.sheet, paintWeekFromSheets(loaded.weekSheets, selectedDateISO), selectedDateISO, warnings);
    return null;
  }

  /**
   * Builds the dashboard from one workbook per department. Falls back to the older
   * layout — every department inside a single workbook, tabs prefixed with the
   * department name — for any file whose name matches no department.
   */
  async function buildDashboardFromFiles(files, selectedDateISO) {
    await ensureXlsx();
    const warnings = [];
    const departments = [];
    const sourcesUsed = [];
    const parsed = {};
    let fabWorkers;
    const unmatched = [];

    for (const file of files) {
      const source = deptForFileName(file.fileName);
      if (!source) { unmatched.push(file); continue; }
      const labelled = Object.assign({ fileName: file.fileName }, source);
      // Unchanged workbook: reuse what was parsed last time instead of re-reading
      // megabytes on every 10-second check for a file nobody touched.
      if (file.cached) {
        departments.push(file.cached.dept);
        sourcesUsed.push({ id: source.id, label: source.label, fileName: file.fileName, sheetName: file.cached.sheetName, savedAt: isoOrNull(file.modifiedAt) });
        if (file.cached.workers) fabWorkers = file.cached.workers;
        parsed[file.fileName] = file.cached;
        for (const w of file.cached.warnings || []) warnings.push(w);
        continue;
      }
      try {
        const before = warnings.length;
        const loaded = readDeptWorkbook(labelled, file.buffer, selectedDateISO, warnings);
        if (!loaded) continue;
        const built = buildDeptFromSheet(labelled, loaded, selectedDateISO, warnings);
        const dept = built && built.dept ? built.dept : built;
        if (!dept) continue;
        if (built && built.workers) fabWorkers = built.workers;
        departments.push(dept);
        sourcesUsed.push({ id: source.id, label: source.label, fileName: file.fileName, sheetName: loaded.sheetName, savedAt: isoOrNull(file.modifiedAt) });
        parsed[file.fileName] = {
          signature: file.signature || null,
          date: selectedDateISO,
          dept,
          sheetName: loaded.sheetName,
          workers: built && built.workers ? built.workers : null,
          warnings: warnings.slice(before)
        };
      } catch (err) {
        console.error(source.label + " error:", err);
        warnings.push("Fatal error parsing " + source.label + " from " + file.fileName + ": " + err.message);
      }
    }

    for (const file of unmatched) {
      const legacy = await buildDashboardData(file.buffer, selectedDateISO);
      for (const dept of legacy.departments) {
        if (!departments.some((d) => d.id === dept.id)) {
          departments.push(dept);
          sourcesUsed.push({ id: dept.id, label: dept.name, fileName: file.fileName, sheetName: "(combined workbook)" });
        }
      }
      if (legacy.fabWorkers) fabWorkers = legacy.fabWorkers;
      for (const w of legacy.warnings) warnings.push(w);
    }

    // A department with no card would just leave a hole on the TVs; send a placeholder
    // that says what is missing so people on the floor know whom to tell.
    const missing = [];
    for (const source of DEPT_SOURCES) {
      if (!departments.some((d) => d.id === source.id)) {
        const mine = warnings.filter((w) => w.indexOf(source.label + ":") === 0);
        const specific = mine.find((w) => /no (tab named|block dated)/.test(w)) || mine[0];
        const hadFile = files.some((f) => { const d = deptForFileName(f.fileName); return d && d.id === source.id; });
        warnings.push(source.label + ": no data. Expected a file whose name contains \"" + source.fileMatch.source + "\" in the connected folder.");
        missing.push({ id: source.id, name: source.label, reason: missingReason(specific, hadFile) });
      }
    }
    if (departments.length === 0) {
      throw new Error("None of the " + files.length + " file(s) produced data for " + selectedDateISO + ".");
    }
    const order = DEPT_SOURCES.map((d) => d.id);
    departments.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return { selectedDate: selectedDateISO, selectedWeekStart: weekMondayISO(selectedDateISO), departments, missing, warnings, fabWorkers, sources: sourcesUsed, parsed };
  }
  // ---- Board layout v2 (safety tile, loading bar, uniform cards) ----
  // Default layout. ?classic=1 brings back the previous one; ?preview=1 also fills the
  // loading strip with labelled sample numbers when there is no loading data.
  var LAYOUT_V2 = !/[?&]classic=1(&|$)/.test(location.search);
  var LAYOUT_PREVIEW = /[?&]preview=1(&|$)/.test(location.search);
  if (LAYOUT_V2) document.documentElement.classList.add("v2");

  // ---- TV Board Info.xlsx: safety days + daily toolbox topic ----
  var BOARD_INFO_RE = /tv\s*board\s*info/i;
  /**
   * "Toolbox Topics": column A a date, column B that day's topic.
   * "Days Without A Recordable": a cell like =TODAY()-DATE(2025,6,31). Excel only
   * recalculates TODAY() when someone opens and saves the file, so the start date is
   * read out of the formula and the TVs count the days themselves. A plain number
   * typed in instead is used as-is.
   */
  function parseBoardInfo(buffer) {
    const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellFormula: true });
    const out = { topics: [], sinceISO: null, days: null };
    const topicSheetName = wb.SheetNames.find((n) => /topic/i.test(n)) || wb.SheetNames[0];
    const ts = topicSheetName && wb.Sheets[topicSheetName];
    if (ts && ts["!ref"]) {
      const range = XLSX.utils.decode_range(ts["!ref"]);
      for (let r = range.s.r; r <= range.e.r; r++) {
        const iso = cellDayISO(ts[XLSX.utils.encode_cell({ r, c: 0 })]);
        const topicCell = ts[XLSX.utils.encode_cell({ r, c: 1 })];
        const topic = topicCell && topicCell.v !== void 0 && topicCell.v !== null ? String(topicCell.w !== void 0 ? topicCell.w : topicCell.v).trim() : "";
        if (iso && topic) out.topics.push({ iso, topic });
      }
    }
    const daysSheetName = wb.SheetNames.find((n) => /days?\s*without|recordable|accident/i.test(n));
    const ds = daysSheetName && wb.Sheets[daysSheetName];
    if (ds && ds["!ref"]) {
      const range = XLSX.utils.decode_range(ds["!ref"]);
      const cells = [];
      for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ds[XLSX.utils.encode_cell({ r, c })];
        if (cell) cells.push(cell);
      }
      // 1) The =TODAY()-<start> formula: its start date keeps the count live every day.
      //    Start as DATE(y,m,d), DATEVALUE("m/d/y") or a cell holding the date.
      for (const cell of cells) {
        if (!cell.f || !/TODAY\(\)/i.test(cell.f)) continue;
        let iso = null;
        const dm = /DATE\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)/i.exec(cell.f);
        const dv = /DATEVALUE\(\s*"(\d{1,2})\/(\d{1,2})\/(\d{2,4})"\s*\)/i.exec(cell.f);
        const ref = /TODAY\(\)\s*-\s*\$?([A-Z]{1,3})\$?(\d+)/i.exec(cell.f);
        if (dm) iso = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]))).toISOString().slice(0, 10); // DATE(2025,6,31) = July 1, as in Excel
        else if (dv) iso = new Date(Date.UTC(Number(dv[3].length === 2 ? "20" + dv[3] : dv[3]), Number(dv[1]) - 1, Number(dv[2]))).toISOString().slice(0, 10);
        else if (ref) iso = cellDayISO(ds[(ref[1] + ref[2]).toUpperCase()]);
        if (iso) { out.sinceISO = iso; break; }
      }
      // 2) Otherwise a fixed count: a formula's result first, then a plain number that
      //    isn't a year typed as a title ("2026").
      if (!out.sinceISO) {
        const isCount = (c) => typeof c.v === "number" && Number.isFinite(c.v) && c.v >= 0;
        const pick = cells.find((c) => c.f && isCount(c)) || cells.find((c) => isCount(c) && !(Number.isInteger(c.v) && c.v >= 1900 && c.v <= 2100 && !c.f));
        if (pick) out.days = Math.floor(pick.v);
      }
    }
    return out;
  }
  /** What the TVs get: today's topic and either the start date or a fixed day count. */
  function safetyFor(board, dateISO) {
    if (!board) return null;
    let hit = board.topics.find((t) => t.iso === dateISO);
    // A topic typed with the wrong year (e.g. 1/26/2025 in the 2026 list) still counts -
    // recognised by a neighbouring row that is in this year. A real entry from last year
    // in a multi-year list (neighbours also last year) is not brought back.
    if (!hit) {
      const year = dateISO.slice(0, 4);
      const i = board.topics.findIndex((t, k) => t.iso.slice(5) === dateISO.slice(5) && t.iso.slice(0, 4) !== year
        && [board.topics[k - 1], board.topics[k + 1]].some((n) => n && n.iso.slice(0, 4) === year));
      if (i !== -1) hit = board.topics[i];
    }
    if (!hit && !board.sinceISO && board.days === null) return null;
    return { topic: hit ? hit.topic : null, sinceISO: board.sinceISO, days: board.days, savedAt: isoOrNull(board.savedAt) };
  }
  // ---- Loading: "<letter> Load Sign Off <Month> <year>.xlsx", one tab per day ("9-28-26") ----
  var LOADING_FILE_RE = /load\s*sign\s*off/i;
  var MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  /** Which sign-off workbook covers a given day: the name carries the month and year. */
  function loadingFileFor(cands, iso) {
    // "Oct", "Sept", "September" all count for the month.
    const month = MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
    const year = iso.slice(0, 4);
    const monthRe = new RegExp("(^|[^a-z])" + month.slice(0, 3) + "[a-z]*([^a-z]|$)", "i");
    return cands.find((c) => monthRe.test(c.name.split("/").pop()) && c.name.indexOf(year) !== -1) || null;
  }
  /** Short products written in COMMENTS, e.g. "SO1347500 EWBL66-2,GUT22-1." -> EWBL66 x2, GUT22 x1. */
  function parseShortProducts(text) {
    const out = [];
    const clean = String(text || "").toUpperCase().replace(/SO\s*\d{5,}/g, " ");
    // The quantity is the LAST "-N" of each item, so a code with hyphens of its own
    // ("RRB-10-2") is RRB-10 x2, not RRB x10.
    for (const token of clean.replace(/\s*-\s*/g, "-").split(/[,;\s]+/)) {
      const m = /^([A-Z0-9-]*[A-Z][A-Z0-9-]*?)-(\d{1,4})\.?$/.exec(token);
      if (m) out.push([m[1], Number(m[2])]);
    }
    return out;
  }
  function parseLoadSignOff(buffer) {
    const wb = XLSX.read(buffer, { type: "array" });
    const days = [];
    const text = (c) => (c && c.v !== void 0 && c.v !== null ? String(c.w !== void 0 ? c.w : c.v).trim() : "");
    const num = (c) => { const n = parseFloat(text(c).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
    for (const name of wb.SheetNames) {
      const m = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(name.trim());
      if (!m) continue;
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
      if (d.getUTCMonth() !== Number(m[1]) - 1) continue; // "9-31-26" and other impossible dates
      const iso = d.toISOString().slice(0, 10);
      const sh = wb.Sheets[name];
      if (!sh || !sh["!ref"]) continue;
      const range = XLSX.utils.decode_range(sh["!ref"]);
      const at = (r, c) => sh[XLSX.utils.encode_cell({ r, c })];
      // Summary block: a label, its value one to three rows below in the same column.
      const totals = {};
      let endRow = range.e.r;
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const t = text(at(r, c)).toLowerCase();
          if (!t) continue;
          if (t === "total tarter") endRow = Math.min(endRow, r - 1);
          const key = t === "total loads" ? "loads" : t === "total loaded" ? "pieces" : t === "total short" ? "shorts" : null;
          if (!key) continue;
          for (let k = 1; k <= 3; k++) { const v = num(at(r + k, c)); if (v !== null) { totals[key] = v; break; } }
        }
      }
      // Load rows: anchored on the "% Full" cell - pieces two columns left, shorts one
      // left, comments one right - because some tabs are shifted a column.
      let loads = 0, pieces = 0, shorts = 0;
      const products = [];
      for (let r = range.s.r; r <= endRow; r++) {
        for (let c = range.s.c + 2; c <= range.e.c; c++) {
          if (!/^\d{1,3}(\.\d+)?%$/.test(text(at(r, c)))) continue;
          const p = num(at(r, c - 2));
          if (!p) break;
          const sh2 = num(at(r, c - 1)) || 0;
          loads += 1; pieces += p; shorts += sh2;
          if (sh2 > 0) for (const item of parseShortProducts(text(at(r, c + 1)))) products.push(item);
          break;
        }
      }
      days.push({
        iso,
        loads: totals.loads !== undefined ? totals.loads : loads,
        pieces: totals.pieces !== undefined ? totals.pieces : pieces,
        shorts: totals.shorts !== undefined ? totals.shorts : shorts,
        products
      });
    }
    return days;
  }
  /** Monday through the selected day: trailers, pieces, shorts and the short products. */
  function loadingFor(books, dateISO) {
    // A day present in two workbooks (end of one month's file, start of the next) counts once.
    const byDay = new Map();
    for (const b of books || []) if (b && Array.isArray(b.days)) for (const d of b.days) if (d && d.iso && !byDay.has(d.iso)) byDay.set(d.iso, d);
    const all = Array.from(byDay.values());
    if (!all.length) return null;
    const monday = weekMondayISO(dateISO);
    const friday = addDaysISO(monday, 4);
    const days = all.filter((d) => d.iso >= monday && d.iso <= dateISO && d.iso <= friday).sort((a, b) => (a.iso < b.iso ? -1 : 1));
    const sum = (k) => days.reduce((t, d) => t + (d[k] || 0), 0);
    const today = days.find((d) => d.iso === dateISO);
    const byProduct = new Map();
    for (const d of days) for (const [name, qty] of d.products || []) byProduct.set(name, (byProduct.get(name) || 0) + qty);
    const piecesWeek = sum("pieces"), shortsWeek = sum("shorts");
    return {
      weekStart: monday,
      trailersWeek: sum("loads"),
      trailersToday: today ? today.loads : 0,
      piecesWeek,
      shortsWeek,
      fulfillment: piecesWeek > 0 ? (piecesWeek - shortsWeek) / piecesWeek : null,
      shorts: Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24)
    };
  }
  function safetyDays(safety) {
    if (!safety) return null;
    if (safety.sinceISO) {
      const t = todayISO();
      const days = Math.round((Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.parse(safety.sinceISO + "T00:00:00Z")) / 864e5);
      return days >= 0 ? days : null;
    }
    return typeof safety.days === "number" ? safety.days : null;
  }

  function isoOrNull(ms) {
    return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  /** Short, TV-sized reason for a department card that has no data. */
  function missingReason(warning, hadFile) {
    const m = warning && /no tab named (\d{4})-(\d{2})-(\d{2})/.exec(warning);
    if (m) return "Tab " + Number(m[2]) + "." + Number(m[3]) + "." + m[1] + " missing in the Excel";
    const b = warning && /no block dated (\d{4})-(\d{2})-(\d{2})/.exec(warning);
    if (b) {
      const day = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3])).toLocaleDateString("en-US", { weekday: "short" });
      return "No " + day + " " + Number(b[2]) + "/" + Number(b[3]) + " block in the Excel";
    }
    if (!hadFile) return "Excel file not found";
    return "Check the Excel sheet";
  }

  async function buildDashboardData(arrayBuffer, selectedDateISO) {
    const warnings = [];
    await ensureXlsx();
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const departments = [];
    let fabWorkers;
    try {
      const fabResult = buildFab(wb, selectedDateISO, warnings);
      if (fabResult) {
        departments.push(fabResult.dept);
        fabWorkers = fabResult.workers;
      }
    } catch (err) {
      console.error("FAB Error:", err);
      warnings.push("Fatal error parsing FAB: " + err.message);
    }
    try {
      const welding = buildWelding(wb, selectedDateISO, warnings);
      if (welding) departments.push(welding);
    } catch (err) {
      console.error("WELDING Error:", err);
      warnings.push("Fatal error parsing WELDING: " + err.message);
    }
    try {
      const paint = buildPaint(wb, selectedDateISO, warnings);
      if (paint) departments.push(paint);
    } catch (err) {
      console.error("PAINT Error:", err);
      warnings.push("Fatal error parsing PAINT: " + err.message);
    }
    try {
      const tanks = buildTanks(wb, selectedDateISO, warnings);
      if (tanks) departments.push(tanks);
    } catch (err) {
      console.error("TANKS Error:", err);
      warnings.push("Fatal error parsing TANKS: " + err.message);
    }
    if (departments.length === 0) throw new Error("No department sheets could be parsed from this workbook for the selected date.");
    return { selectedDate: selectedDateISO, selectedWeekStart: weekMondayISO(selectedDateISO), departments, warnings, fabWorkers };
  }

  // src/js/main-artifact.js
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
    const tvAlert = feedDown ? "\u26A0 NO CONNECTION TO SERVER \xB7 DATA FROM " + dataFrom
      : sourceOffline ? "\u26A0 SOURCE PC OFFLINE \xB7 DATA FROM " + lastSeen
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

  // src/js/autoSync.js — keeps the workbook flowing in without anyone clicking Upload.
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

  setInterval(updateClock, 1e3);
  updateClock();
  setInterval(render, 6e4);
  var todayInit = plantNow();
  document.getElementById("date-input").value = `${todayInit.getFullYear()}-${String(todayInit.getMonth() + 1).padStart(2, "0")}-${String(todayInit.getDate()).padStart(2, "0")}`;
  render();
  bootstrapAutoSync(TV_SNAPSHOT);
  var tvRequested = queryParam("tv");
  if (TV_SNAPSHOT || tvRequested === "1" || tvRequested === "true") enterTvMode(TV_SNAPSHOT);
})();

