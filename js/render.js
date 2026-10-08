// Drawing: department cards, rings, KPI tiles, loading strip.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

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
